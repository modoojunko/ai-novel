# AI 正文写作 — 设计文档

## 概述

在 ChapterEditor 中增加 AI 写正文功能。后端构建 ChapterContext 对象（设定+角色+伏笔+章纲+前文摘要），组装成完整提示词，流式输出正文。前端提供正文/提示词视图切换，流式输出展示，版本保存。

## 用户流程

```
打开章节编辑器
       │
       ▼
┌─────────────────────────────────────┐
│  正文 tab（当前编辑器）              │
│  ┌───────────────────────────────┐  │
│  │  [✨ AI 写本章]               │  │
│  │                               │  │
│  │  textarea / 流式输出 / 预览    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
       │ 点击「✨ AI 写本章」
       ▼
┌─────────────────────────────────────┐
│  流式输出模式                        │
│  ┌───────────────────────────────┐  │
│  │ ██░░░░░░░░░░░░░░░░░░ (进度)   │  │
│  │                               │  │
│  │ 你推开酒馆的木门，昏黄的灯光…  │  │
│  │ ...（逐字/逐句出现）          │  │
│  │                               │  │
│  │          [停止]               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
       │ 流式完成
       ▼
┌─────────────────────────────────────┐
│  正文已填入 textarea                 │
│  [保存] → 创建版本                   │
│  [修改] → 手动编辑 → 再保存 → 新版本 │
│  [确认] → 标记「已完成」             │
└─────────────────────────────────────┘
       │ 切换 tab 查看提示词
       ▼
┌─────────────────────────────────────┐
│  提示词 tab                          │
│  ┌───────────────────────────────┐  │
│  │ ## 角色定位                    │  │
│  │ 你是作家本人。遵循清晰、连贯…   │  │
│  │                               │  │
│  │ ## 原则与禁忌                  │  │
│  │ 禁止使用：突然、忽然…          │  │
│  │                               │  │
│  │ ## 故事背景                    │  │
│  │ 本章是《XXX》第1卷第1章…       │  │
│  │                               │  │
│  │ ## 写作指引                    │  │
│  │ ...                           │  │
│  │                               │  │
│  │        [📋 复制]               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 后端 API

### 新增端点

```
POST /api/projects/{project_id}/chapters/{chapter_ref}/write
Headers: Authorization: Bearer <token>
Response: SSE stream (text/event-stream)
```

### ChapterContext 对象

后端构建的上下文对象：

```python
class ChapterContext:
    premise: str                    # story.yaml → synopsis
    world_setting: dict             # settings/world-setting.yaml
    style_setting: dict             # settings/writing-style.yaml
    anti_ai: dict                   # settings/anti-ai.yaml
    hooks: list                     # settings/hooks.yaml (active/pending hooks)
    volume_summary: str             # volumes/vol-{N}.yaml → summary
    chapter_outline: dict           # chapters/{ref}.yaml → outline
    characters: list                # chapter characters → snapshots
    previous_chapter_recap: str     # 前章 prose 最后 500 字 / 或 summary
    novel_title: str                # project name
    
    def to_prompt(self) -> str:
        """拼接成完整写作提示词"""
```

### Prompt 模板

```
## 角色定位
你是{role}。{core_principles}

## 原则与禁忌
{common_mistakes}
禁止使用：{fatigue_words}
禁止句式：{tic_patterns}

## 故事背景
本段是《{novel_title}》第{vol}卷第{ch}章。
{world_setting_summary}
{volume_summary}

## 当前章节
{chapter_outline_summary}

## 前文回顾
{previous_chapter_recap}

## 角色状态
{character_snapshots}

## 活跃伏笔
{active_hooks}

## 写作要求
{depiction_techniques}
输出长度：约 2500 字。
语言：中文。
写正文，不写章节标题，不写总结。
```

### SSE 事件格式

```
event: token
data: {"text": "你推开酒馆的木门"}

event: done
data: {"full_text": "...", "tokens_used": 1234}

event: error
data: {"error": "生成失败"}
```

### 后端处理流程

```
POST /write
   │
   ├── 1. 验证项目/章节
   ├── 2. 读取所有上下文
   │     ├── story.yaml → premise
   │     ├── settings/ → world, style, anti-ai, hooks
   │     ├── volumes/ → volume summary
   │     ├── chapters/ → outline + previous chapter
   │     └── characters/ → snapshots
   │
   ├── 3. 构建 ChapterContext
   ├── 4. 生成 prompt
   ├── 5. 保存 prompt 文件到 prompts/{ref}-write-prompt.md
   ├── 6. 调用 AIClient.chat_stream()
   ├── 7. SSE 逐 token 输出
   └── 8. 完成时保存正文到 chapter.prose
```

## 前端组件

### ChapterEditor 扩展

#### 视图切换
```
正文/提示词 tabs
```
- 使用已有的 TabBar 模式
- 正文 tab：现有编辑器 + AI 写按钮 + 流式输出
- 提示词 tab：只读展示区 + 复制按钮

#### AI 写按钮
```
"✨ AI 写本章" button
单击 → 调用 POST /write
再次单击 → 停止流式（中断 SSE）
```
- 按钮状态：idle / loading（生成中）/ done
- loading 时按钮变「⏹ 停止」
- 完成后按钮恢复

#### 流式输出展示
```
<div className="streaming-output">
  <div className="typing-effect">
    {accumulatedText}
    <span className="cursor">|</span>
  </div>
</div>
```
- 逐 token 累积显示
- 闪烁光标
- 宽高与 textarea 一致，流式完成后无缝替换 textarea 内容

#### 提示词展示
```
<div className="prompt-viewer">
  <pre>{promptText}</pre>
  <button>📋 复制</button>
</div>
```
- `font-mono` 等宽字体
- 只读，可滚动
- 右上角「复制」按钮（copy to clipboard）

### 后端新增

| 文件 | 说明 |
|------|------|
| `backend/write/chapter_writer.py` | ChapterContext 构建 + prompt 拼装 |
| `backend/write/router.py`（扩展） | 新增 `POST /write` 端点 |

### 前端修改

| 文件 | 说明 |
|------|------|
| `frontend/src/components/novel/ChapterEditor.tsx` | 视图切换 tabs + AI 写按钮 + 流式展示 + 提示词展示 |
| `frontend/src/lib/ai.ts` | 新增 `writeChapter()` SSE 封装 |

## 测试策略

### 后端测试

| 测试 | 说明 |
|------|------|
| `test_chapter_context_build` | ChapterContext 是否完整加载所有数据源 |
| `test_prompt_assembly` | prompt 字符串是否包含所有必要章节 |
| `test_write_endpoint_no_auth` | 无 token 返回 401/403 |
| `test_write_endpoint_invalid_chapter` | 无效 chapter_ref 返回 404 |

### 前端 E2E 测试

| 测试 | 说明 |
|------|------|
| 「✨ AI 写本章」按钮在正文 tab 可见 | 验证按钮存在 |
| 点击 AI 写按钮进入流式模式 | 验证 loading 状态 |
| 提示词 tab 展示只读内容 | 切换 tab → 验证 pre 元素 |
| 提示词复制按钮 | 验证 copy 功能 |
| 流式完成后正文填入 textarea | mock SSE → 验证 textarea 内容 |

## 边界情况

- 已有正文时点击「AI 写本章」→ 确认弹窗「将覆盖现有正文，是否继续？」
- SSE 中断/网络错误 → 已收到的部分保留，不丢失
- 流式生成中切换 tab → 生成继续，切换回来仍看到进度
- 无 premise → 仍然可以写（只用设定+章纲，缺少前提背景）
