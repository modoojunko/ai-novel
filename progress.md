# 开发进度 — AI Novel C/S 架构重构

更新日期：2026-07-22

## 今日完成：需求评审会

### 评审结论

全员达成一致，无未解决争议。

| 角色 | 评审结论 |
|------|---------|
| PM | PRD 定稿，核心价值观确认，合规红线确认 |
| 后端架构师 | 方案可行，补充 require_ai_access() 端点清单，建议 Verifier 接口 |
| 前端工程师 | 双协议支持确认，withLoading 共享函数确认，skeleton 范围确认 |
| 测试工程师 | 可测试性中高，建议 mock Verifier、时间注入、DEV_MODE 清理 |
| UX 架构师 | 发现 5 个独立样式来源，建议统一到 style.css |
| 提示词工程师 | 发现 2 个 Bug（字段不匹配、hooks key 不一致）+ prompt injection 风险 |

### 已创建/更新的 GitHub Issues

| # | 标题 | 优先级 | 备注 |
|---|------|--------|------|
| 17 | 免费体验层 | P0 | PRD + 线框图 + 各方评审已确认 |
| 18 | API Key 配置引导 | P0 | PRD + 线框图 + Verifier 方案已确认 |
| 15 | 加载状态 | P0 | 线框图 + 实现方案已确认 |
| 20 | 新手引导 | P1 | 待排期 |
| 24 | 提示词 Bug + 架构问题 | P1 | 2个Bug确认修复，prompt injection 后续 |
| 8-16 | UX/CSS 问题 | P1-P2 | 已标记优先级 |

### 产品定稿

**核心价值观：** 人铸灵魂，AI行笔墨
**数据安全：** 数据不上云，永远属于作者
**合规红线：** S端 不碰交易/AI/内容，C端 用户自备 Key
**短篇/长篇双模式：** PRD 已包含，暂缓实现

### 明日计划

按评审结论开始 Phase 0 后端实现：
1. `check_permission()` 重构 — 注入 `now` 参数 + 返回免费层字段
2. `verify_session()` 返回 `trial_remaining_days`
3. `require_ai_access()` / `require_project_limit()` Dependencies
4. 新建 `key_verifier.py`（Verifier 接口 + MockVerifier）
5. 修复提示词系统的 2 个 Bug

### 本地启动

```bash
# S端
python server/local_server.py

# C端（开发模式）
cd client/backend && DEV_MODE=1 DATA_ROOT=./data uvicorn main:app --reload --port 8000

# 前端热更新
cd client/frontend && npm run dev

# 测试
python -m pytest server/tests/ -v
```
