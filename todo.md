# AI Novel · 爱小说 — 产品化路线图

> 更新于 2026-06-25 · 已完成大量前端美化和 AI 能力接入

---

## ✅ 已完成

### ✅ 1.1 AI 设定生成（全局 + 逐字段）

| 模块 | 状态 |
|------|------|
| 后端 `POST /api/settings/generate` | ✅ 5 种设定一次性生成 |
| 后端 `POST /api/settings/ai/{type}/{field}` | ✅ 单字段抽卡式生成 |
| 前端全局一键生成按钮 + 进度弹窗 | ✅ |
| 前端逐字段 ✨ 弹窗（预览/换一个/接受） | ✅ 全部表单已接入 |
| E2E 测试 | ✅ settings-ai.spec.ts 7 tests |

### ✅ 1.2 AI 正文写作（SSE 流式）

| 模块 | 状态 |
|------|------|
| `ChapterContext` builder | ✅ 读取 all data sources |
| `POST /write` SSE 端点 | ✅ 自动构建 prompt + 流式输出 |
| 前端 SSE 流式阅读器 + 打字机效果 | ✅ |
| 正文/提示词视图切换 | ✅ TabBar 切换 |
| E2E 测试 | ✅ writing.spec.ts 6 tests |

### ✅ 1.3 质量检查 + 归档

| 模块 | 状态 |
|------|------|
| 质量检查按钮 + 6 维度结果展示 | ✅ |
| 归档按钮 + 确认弹窗 | ✅ |
| 自动版本快照 + 版本列表 + 恢复 | ✅ |

### ✅ 1.4 版本历史

| 模块 | 状态 |
|------|------|
| `save_chapter()` 自动拍快照 | ✅ |
| `GET /versions` 列表 + `POST /versions/{id}/restore` | ✅ |
| 前端 VersionHistory 真实 API 对接 | ✅ |

### ✅ 1.5 剧情推演（多 Agent 回合制）

| 模块 | 状态 |
|------|------|
| 后端 `DeductionEngine` + CharacterAgent | ✅ |
| 认知 6 层模型 + 感知隔离 + 回合循环 | ✅ |
| Checkpoint + 回退重推 + 作者调整 | ✅ |
| 前端 StageMap + CharacterCard + EventWall | ✅ |
| NovelPage 🔮 标签页 | ✅ |

### ✅ 1.6 前端美化

| 模块 | 状态 |
|------|------|
| 全局 ThemeToggle（Navbar + 着陆页） | ✅ |
| Lucide 图标替换 emoji | ✅ |
| 编辑器预览模式 + 专注模式 | ✅ |
| 自动保存（3s 防抖） | ✅ |
| Firefox 滚动条 + 动画增强 | ✅ |

---

## 🔴 待完成

### 1.7 打通提示词生成链路

- [ ] `prompt/router.py` — `generate_prompts` 调 `assembler.assemble_all_segments()`
- [ ] 验证提示词文件生成

### 1.8 打通 SSE 流式写作（端到端）

- [ ] 验证 `.env` 中 `AI_API_KEY` 被正确读取
- [ ] 验证 `writing_model` 字段映射正确
- [ ] 验证 `token_log` 写入 + `token_balance` 扣减
- [ ] 前端暂停/停止/恢复按钮

### 1.9 AI 调用错误处理

- [ ] Rate limit → 用户友好提示
- [ ] API Key 无效 → 管理员提示
- [ ] SSE 中断 → 已生成内容保留
- [ ] Token 不足 → 拒绝请求

---

## 🔴 计费系统

### 2.1 支付接入

- [ ] 支付宝当面付：`backend/billing/payment.py`
- [ ] 支付回调 webhook → 更新 `user.token_balance`
- [ ] 前端 BillingPage：套餐/余额/充值/消费记录

### 2.2 定价 + 余额门禁

- [ ] 定价方案：10K/50K/200K tokens
- [ ] 新用户注册赠送 5,000 tokens
- [ ] AI 调用前余额检查

---

## 🔴 生产环境

- [ ] nginx SSL（Let's Encrypt）
- [ ] PostgreSQL 自动备份
- [ ] 域名指向
- [ ] CORS 生产限制

---

## 🟡 其他

- [ ] 邮箱验证 + 密码重置
- [ ] 管理后台（用户/统计/配置）
- [ ] 新用户引导 6 步
- [ ] 章节分享只读链接
- [ ] 性能优化（索引/限流/懒加载）

---

## 当前进度

| 模块 | % | 现状 |
|------|----|------|
| 用户注册/登录 | 80% | 缺邮箱验证、密码重置 |
| 项目管理 | 90% | CRUD 完整 |
| Settings (设定) | **100%** | ✅ AI 生成 + 逐字段抽卡 |
| Outline (大纲) | 50% | 缺 AI 方向提案 |
| Prompt (提示词) | 30% | assembler 准备好，未端到端验证 |
| Write (写作) | **95%** | ✅ SSE 流式 + ChapterContext + 提示词视图 |
| Archive (归档) | **95%** | ✅ 归档 + 版本历史 |
| 剧情推演 | **100%** | ✅ 多 Agent 回合制 |
| 质量检查 | 40% | 6/15 项 |
| 计费 | 20% | token log 有，支付 0 |
| 前端 UI | **95%** | ✅ 全面美化 + AI 交互 |
| 部署 | 70% | Docker Compose OK，缺 SSL/备份/域名 |
