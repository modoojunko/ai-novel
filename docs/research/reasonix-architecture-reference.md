# Reasonix Agent 架构分析 — ai-novel 可借鉴的设计方案

> 分析时间: 2026-07-15
> 分析来源: [Reasonix](https://github.com/esengine/DeepSeek-Reasonix) (Go 编写，DeepSeek 原生的 AI 编码 Agent)

---

## 前言

Reasonix 是一个专为 DeepSeek 模型深度优化的 AI 编码 Agent，其核心设计理念是 **config-driven + cache-first + multi-frontend**。虽然它是一个编码 Agent，与 ai-novel 的小说写作场景不同，但它的很多架构设计模式对 ai-novel 有很高的参考价值——尤其是在 **token 成本控制、工作流可靠性、多端复用** 等方面。

---

## 一、架构总览

### Reasonix 核心分层

```
Config (reasonix.toml)
  → Boot (internal/boot/) — 一次组装，多前端共享
    → Controller (internal/control/) — 传输无关的会话驱动
      → Agent (internal/agent/) — 主运行循环
        → Provider + Tool.Registry + Session
          → Coordinator (双模型: Planner + Executor)
```

### 与 ai-novel 的对比映射

| Reasonix 概念 | ai-novel 对应 | 差距 |
|---|---|---|
| `internal/agent/Agent` | `write/chapter_writer.py` | 更成熟的循环控制 |
| `internal/control/Controller` | `workflow/engine.py` | Controller 是事件驱动的，engine 是线性管道 |
| `internal/tool/` 工具系统 | `prompt/assembler.py` | 没有工具注册表的概念 |
| `internal/evidence/` 证据账本 | `workflow/gates.py` | gates 缺乏证据链追踪 |
| `internal/provider/` 提供者 | `ai_client.py` | 已有多 provider 支持，但缺缓存策略 |

---

## 二、最值得借鉴的 8 个方案

### 方案 1：Cache-first Prompt 组装（💰 节省 token 费用）

**Reasonix 做法：**
保持系统 prompt + 早期历史的**字节绝对稳定**，让 DeepSeek 的自动前缀缓存保持命中。一旦前缀变了，缓存全丢。关键代码见 `internal/agent/agent.go:36-37` 和 `REASONIX.md` 中的 "Cache-first" 约定。

**ai-novel 现状：**
`prompt/assembler.py` 每次写作都重新拼 prompt，组装结果因包含章节编号、当前进度等动态内容而每次不同，缓存命中率接近零。

**改造方案：**

将 prompt 拆为三段式结构：

```
[稳定前缀]  → 角色定义 + 写作规范 + 风格指南
             只随版本升级变化，session 内不变
             → DeepSeek prefix cache 命中

[半稳定中缀] → 世界观设定 + 卷纲 + 角色状态
             切换卷/重要设定变更时才重建
             → 卷内各章共享缓存

[可变后缀]   → 当前章节纲 + 具体写作指令
             每章不同，无法缓存
             → 只占总 prompt 的 20-30%
```

**代码改动点：**

```python
# 在 prompt/assembler.py 中增加缓存感知
class CacheAwarePromptAssembler:
    def __init__(self):
        self._last_prefix_hash = ""
        self._last_middle_hash = ""
        self._prefix = ""
        self._middle = ""
    
    def assemble(self, project, chapter):
        # 只重建有变化的部分
        new_prefix = self._build_prefix(project)
        new_middle = self._build_middle(project, chapter.volume_id)
        
        if hash(new_prefix) != self._last_prefix_hash:
            self._prefix = new_prefix
            self._last_prefix_hash = hash(new_prefix)
        if hash(new_middle) != self._last_middle_hash:
            self._middle = new_middle
            self._last_middle_hash = hash(new_middle)
        
        suffix = self._build_suffix(chapter)
        return self._prefix + "\n" + self._middle + "\n" + suffix
```

**预期收益：**
- 同一卷内各章写作：prefix + middle 走缓存 → 节省 60-70% prompt token
- 同一章多次修改：prefix + middle + 部分 suffix 走缓存 → 节省 70-80%
- 整体 API 费用降低 40-60%（取决于写作长度）

---

### 方案 2：证据账本（Evidence Ledger）

**Reasonix 做法：**
`evidence.Ledger`（`internal/evidence/`）记录每轮所有工具调用的结果。`finalReadinessCheck()` 在 final answer 前检查：
- 是否有未完成的 todo
- 变更后是否执行了验证命令
- 是否做了 review
- 是否有完整的 sign-off（complete_step）

**ai-novel 现状：**
`workflow/gates.py` 的 Phase Gate 目前是**有/无检查**，只验证文件是否存在或字段是否填写，缺乏"完成度证据"链跟踪。

**改造方案：**

```python
# 新增 writing_evidence.py
@dataclass
class ChapterEvidence:
    """单章的创作证据链"""
    chapter_id: str
    outline_approved: bool = False
    anti_ai_passed: bool = False
    quality_score: float = 0.0
    review_summary: str | None = None
    referenced_settings: list[str] = field(default_factory=list)
    version_count: int = 0
    writer_notes: list[str] = field(default_factory=list)

class EvidenceLedger:
    """跨阶段的证据账本"""
    
    def __init__(self):
        self._store: dict[str, ChapterEvidence] = {}
    
    def record(self, chapter_id: str, **updates):
        """记录一条证据"""
        if chapter_id not in self._store:
            self._store[chapter_id] = ChapterEvidence(chapter_id=chapter_id)
        for k, v in updates.items():
            setattr(self._store[chapter_id], k, v)
    
    def check_readiness(self, chapter_id: str) -> list[str]:
        """检查章节是否可以归档——返回缺失项的列表"""
        ev = self._store.get(chapter_id)
        if not ev:
            return ["无任何创作记录"]
        missing = []
        if not ev.outline_approved:
            missing.append("章纲未审批")
        if not ev.anti_ai_passed:
            missing.append("反 AI 检测未通过")
        if ev.quality_score < 0.6:
            missing.append(f"质量分 {ev.quality_score:.2f} 低于阈值 0.6")
        return missing
```

---

### 方案 3：事件驱动架构（Event-driven Controller）

**Reasonix 做法：**
`control.Controller` 是传输无关的会话驱动，所有输出走 `event.Sink` 类型化事件流。CLI TUI / Desktop / HTTP/SSE 三种前端共享同一个 Controller，**业务逻辑与前端渲染完全解耦**。

```go
// Reasonix 的事件类型
type Event struct {
    Kind    Kind  // TurnStarted, Reasoning, Text, ToolDispatch, ToolResult, Usage, ...
    Text    string
    Tool    Tool
    Usage   *Usage
    // ...
}
```

**ai-novel 现状：**
FastAPI route handler 直接写业务逻辑，SSE 流和 REST API 混在一起。如果将来要加小程序或纯 Web 端，需要重复写业务逻辑。

**改造方案：**

```python
# 定义事件类型
@dataclass
class NovelEvent:
    kind: Literal[
        "chapter.writing.started",
        "chapter.segment.written", 
        "chapter.writing.completed",
        "phase.transitioning",
        "phase.transitioned",
        "quality.check.passed",
        "quality.check.failed",
        "token.balance.low",
        "setting.referenced",
    ]
    project_id: str
    chapter_id: str | None = None
    detail: dict = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

# 事件发射接口
class EventSink(Protocol):
    def emit(self, event: NovelEvent): ...

# workflow/engine.py 改为事件驱动
class NovelWorkflow:
    def __init__(self, sink: EventSink):
        self._sink = sink
    
    async def transition(self, project_id, user_id, from_phase, to_phase):
        self._sink.emit(NovelEvent(
            "phase.transitioning",
            project_id=project_id,
            detail={"from": from_phase, "to": to_phase}
        ))
        # ... 实际业务逻辑 ...
        self._sink.emit(NovelEvent(
            "phase.transitioned",
            project_id=project_id,
            detail={"from": from_phase, "to": to_phase, "success": True}
        ))
```

**好处：** 前端从 pywebview 扩展到 Web/小程序时，业务逻辑零改动，只要加新的 EventSink 实现。

---

### 方案 4：多阶段上下文压缩

**Reasonix 做法：**
`internal/agent/compact.go` 实现多阶段压缩策略，缓解长 session 的上下文膨胀问题：

| 水位 | 动作 | 行为 |
|------|------|------|
| 窗口的 50% | softCompactRatio | 仅通知，不操作 |
| 窗口的 60% | toolResultSnipRatio | 裁剪过时的工具输出 |
| 窗口的 80% | compactRatio | 调用 LLM 摘要压缩早期历史 |
| 窗口的 90% | compactForceRatio | 强制压缩（摘要格式固定模版） |

压缩摘要的固定模板：

```
## Standing facts & constraints — 保持原样
## Goal — 用户意图
## Decisions & rationale — 关键决策不动
## Files & code — 具体事实
## Commands & outcomes — 命令结果
## Pending & next step — 下一步
```

**ai-novel 场景：** 长篇小说写到 50 章后，prompt 中「卷纲 + 已有章节概要 + 设定」的体量会撑爆上下文窗口。

**改造方案：**

```python
class ContextCompressor:
    """多阶段上下文压缩"""
    
    COMPRESSION_STAGES = [
        (0.5, "NOTICE"),       # 仅提醒
        (0.65, "SNIP"),        # 裁剪不活跃的设定引用
        (0.8, "SUMMARIZE"),    # LLM 摘要早期章节
        (0.92, "FORCE"),       # 强制压缩到 50%
    ]
    
    SUMMARY_TEMPLATE = """\
## 核心设定（不变）
{core_settings}

## 情节进展
{plot_summary}

## 关键决策（不变）
{key_decisions}

## 活跃伏笔
{active_foreshadowing}

## 最近 {n} 章原文（保持原样）
{recent_chapters}

## 前面章节摘要（压缩）
{older_summary}
"""
```

预期效果：写第 100 章时，前 90 章被压缩为结构化摘要，保留关键信息但 token 开销从数十万降到数千。

---

### 方案 5：双模型协作（Planner + Writer）

**Reasonix 做法：**
`internal/agent/coordinator.go` 的 `Coordinator` 运行两个模型：

```
用户输入
  │
  ├── Planner（只读工具 + 小模型/Flash）
  │    独立 session，独立缓存前缀
  │    输出：可执行的计划
  │
  └── Executor（完整 Agent + 大模型/Pro）
       独立 session，独立缓存前缀
       执行 Planner 的计划
```

两个 session 分离的关键好处：
- 规划轮次不会污染执行缓存的上下文
- 规划失败只需要重跑 planner，不浪费 writer 的 token
- 各 session 的 prompt 前缀高度稳定

**ai-novel 落地方式：**

```
用户点"写下一章"
  │
  ├── Planner（deepseek-v4-flash）
  │   输入：卷纲 + 前情概要 + 章节核心事件
  │   输出：本章情绪走向 + 冲突设计 + 伏笔安排 + 场景节奏
  │   成本：≈500 tokens/次
  │
  ├── Writer（deepseek-v4-pro）
  │   输入：planner 规划 + 写作规范 + 风格指南
  │   输出：正文
  │   成本：≈2000-5000 tokens/次
  │   收益：prompt 更聚焦，上下文更小
  │
  └── Reviewer（deepseek-v4-flash）
      输入：正文 + 反 AI 规则
      输出：质量评分 + 具体修改建议
```

---

### 方案 6：子代理深度管理

**Reasonix 做法：**
`internal/agent/task.go` 的子代理系统有这些防护：

1. **深度限制（maxSubagentDepth）**：默认 2 层，超过后移除递归工具
2. **工具过滤**：每层递 Dec 减少可用工具集
   - 子代理不能使用后台任务工具（wait/bash_output/kill_shell）
   - 深度达到上限子代理不能使用递归工具（task/run_skill）
   - bash 包装为 `foregroundOnlyBash`，禁止后台执行
3. **只读子代理**：`readOnlyBash` 运行时强制 plan-mode 安全的命令，bash schema 也修改为只读

```go
// SubagentToolRegistryForDepth 的核心逻辑
exclude = subagentAlwaysHiddenTools  // parallel_tasks, install_skill
if childDepth >= maxDepth:
    exclude += subagentRecursiveTools  // task, run_skill 等
exclude += subagentJobTools            // wait, bash_output, kill_shell
```

**ai-novel 场景：** 如果 writer agent 能调用其他子 agent（比如 writer → editor → reader），必须有防护机制防止无限嵌套和权限越界。

```python
# 在调度子 agent 时
class SubagentGuard:
    MAX_DEPTH = 3
    
    @dataclass
    class Context:
        depth: int
        allowed_actions: list[str]  # writer: 只能读写章节文件
        parent_id: str
    
    def spawn(self, role: str, task: str, parent_ctx: Context | None):
        ctx = Context(
            depth=(parent_ctx.depth + 1) if parent_ctx else 0,
            allowed_actions=self._allowed_for_role(role, parent_ctx),
            parent_id=parent_ctx.id if parent_ctx else ""
        )
        if ctx.depth > self.MAX_DEPTH:
            raise GuardError(f"子 agent 嵌套深度超过限制 ({self.MAX_DEPTH})")
        # 限制工具集
        if "write" in ctx.allowed_actions:
            # writer 不能删设定、不能改卷纲
            disallow = ["edit_setting", "delete_chapter", "replan_volume"]
        return await self._execute(ctx, task)
```

---

### 方案 7：Storm Breaker + Loop Guard（防止死循环）

**Reasonix 做法：**
`agent.go` 中的 `stormSig` 和 `blockedTurnStreak` 检测模型卡住：

- `stormSig`：追踪连续相同的失败模式（相同的 tool + 相同的错误/阻止原因）
- `stormCount`：重置条件——任何成功的操作
- `blockedTurnStreak`：连续多轮所有工具都被阻止
- 超过阈值 → 风暴断路器介入，让模型报告阻塞因素而非继续重试

```go
// 风暴信号是 (tool, error/blocker) 的元组，忽略参数变化
// 因为模型通常会换写法但本质做同一件事
```

**ai-novel 场景：**

```python
class WriteLoopGuard:
    """写作循环保护"""
    
    def __init__(self):
        self._repeat_patterns: dict[str, int] = {}  # 重复模式计数
        self._last_content_hash: str = ""
        self._stuck_count: int = 0
        self._MAX_REPEAT = 3
        self._MAX_STUCK = 5
    
    async def check(self, new_content: str) -> GuardDecision:
        # 检测1：开头重复（AI 反复重写相同的东西）
        h = hash(new_content[:200])
        if h == self._last_content_hash:
            self._stuck_count += 1
        else:
            self._stuck_count = 0
            self._last_content_hash = h
        
        # 检测2：同质化（连续写的段落结构/句式雷同）
        pattern = self._extract_pattern(new_content)
        self._repeat_patterns[pattern] = self._repeat_patterns.get(pattern, 0) + 1
        if self._repeat_patterns[pattern] >= self._MAX_REPEAT:
            return GuardDecision("NOTIFY", f"检测到重复的写作模式（{pattern}），建议切换角度或调整温度")
        
        if self._stuck_count >= self._MAX_STUCK:
            return GuardDecision("PAUSE", "多次产出相似内容，推荐保存后切换思路或使用推演沙盘")
        
        return GuardDecision("CONTINUE")
```

---

### 方案 8：声明式工作流配置

**Reasonix 做法：**
全 TOML 声明式配置——providers、agent、tools、plugins 全部在 `reasonix.toml` 中声明。添加新模型不需要改代码，只需要加配置条目。

**ai-novel 落地：**
在项目目录下加 `workflow.yaml`，让用户不改代码即可定制写作流程：

```yaml
# data/projects/{id}/workflow.yaml — 声明式写作工作流
phases:
  - name: settings
    prompt: settings/{type}.j2
    gate: check_settings_complete
    
  - name: outline
    agents:
      - role: volume_planner
        model: deepseek-v4-flash
        prompt: outline/volume_plan.j2
      - role: chapter_planner
        model: deepseek-v4-flash
        prompt: outline/chapter_plan.j2
    gate: check_outline_approved
    
  - name: write
    agents:
      - role: planner
        model: deepseek-v4-flash
        cost: cheap  # 不计入写作 token 消耗
      - role: writer
        model: deepseek-v4-pro
        prompt: write/prose.j2
    gate: check_quality
    quality_threshold: 0.6
    
  - name: review
    agents:
      - role: anti_ai
        prompt: review/anti_ai.j2
      - role: reader
        prompt: review/reader.j2
    gate: check_all_clear
```

---

## 三、落地优先级矩阵

| 方案 | 投入 | 收益 | 风险 | 建议时机 |
|------|------|------|------|----------|
| **1. Cache-first Prompt** | 🟢 低 | 💰 节省 40-60% token | 低 — 纯前端改造 | **现在** |
| **2. Evidence Ledger** | 🟢 低 | ✅ 质量可视化 | 低 — 增量加 | **现在** |
| **7. Loop Guard** | 🟢 低 | 🔄 防止死循环 | 低 — 独立模块 | **现在** |
| **4. 上下文压缩** | 🟡 中 | 📐 支持千章小说 | 中 — 摘要质量依赖 LLM | 下一轮 |
| **6. 子代理深度管理** | 🟡 中 | 🛡️ 多 Agent 安全 | 中 — 需要设计 Agent 协议 | 下一轮 |
| **3. 事件驱动架构** | 🔴 高 | 🎭 多前端复用 | 中 — 重构量大 | 架构升级时 |
| **5. 双模型协作** | 🔴 高 | 🤖 质量+成本双优 | 高 — 需要实验验证 | 架构升级时 |
| **8. 声明式工作流** | 🔴 高 | 🧩 高度灵活 | 中 — 需要设计 Schema | 有用户需求时 |

---

## 四、关键代码映射（方便开发时参考）

| Reasonix 文件 | 核心设计 | ai-novel 对应 |
|---|---|---|
| `internal/agent/agent.go` | Agent 主循环、final readiness、风暴检测 | `write/chapter_writer.py` |
| `internal/agent/compact.go` | 多阶段压缩策略 | — |
| `internal/agent/coordinator.go` | 双模型 Planner + Executor | — |
| `internal/agent/task.go` | 子代理系统、工具过滤、深度限制 | — |
| `internal/agent/session.go` | 线程安全的会话历史、版本控制 | 类比 `db.py` + `chapters/` |
| `internal/evidence/` | 证据账本、可验证交付链 | `workflow/gates.py` |
| `internal/control/controller.go` | 事件驱动 Controller | `workflow/engine.py` |
| `internal/provider/provider.go` | Provider 接口、工厂注册、消息规范化 | `ai_client.py` |
| `internal/event/` | 类型化事件流 | — |
| `internal/config/` | TOML 声明式配置 | — |
| `internal/tool/` | 工具注册表、ReadOnly 门控 | — |
| `REASONIX.md` | 缓存稳定前缀内存声明 | `CLAUDE.md` |

---

## 五、总结

Reasonix 给 ai-novel 最大的启发是三个层面：

1. **战术层面（立即做）**
   - Cache-first prompt 组装直接省 token 费用
   - Evidence ledger 提升工作流的可观察性
   - Loop guard 防止写作死循环

2. **战略层面（中长期）**
   - 事件驱动架构解耦业务与前端
   - 双模型 Planner/Writer 分离降低单次写作成本
   - 子代理深度管理保障多 Agent 安全协作

3. **工程理念**
   - 先定义接口再实现（Provider、Gate、Sink 全是 interface）
   - 配置驱动重于代码驱动
   - 可观察性内置（所有输出都经过事件流，不是到处 print/log）
   - 错误恢复比错误预防更重要（流中断恢复、风暴检测、grace round）
