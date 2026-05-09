# AI Novel · 爱小说 — 产品化路线图

> 当前状态：SaaS 框架已完成，前后端 schema 已对齐。
> 距离可以收费上线，还有以下工作。

---

## 🔴 阻断上线（必须完成才能收费）

### 1. AI 能力未接入

当前 AI 调用路径已经写好了（`prompt/assembler.py` → `write/stream.py` → Anthropic SDK），但整个链路从未端到端验证过。

- [ ] **端到端 AI 写作测试**：从 `OutlinePage` 创建章节 → `PromptsPage` 生成提示词 → `WritePage` SSE 流式写作 → `ArchivesPage` 归档
- [ ] **视角转换功能实现**：`PromptsPage` 里「视角转换」按钮调的是 `perspective` endpoint，但 `prompt/router.py` 中该 endpoint 只返回占位数据，没有真正调 AI 做上帝视角→沉浸式转换
- [ ] **提示词生成功能实现**：`generatePrompts()` 调的是 `prompts/generate` endpoint，`prompt/router.py` 中该 endpoint 只返回占位数据，需要真正调 `assembler.py` 的 `assemble_all_segments`
- [ ] **Stream 流式写作验证**：`WritePage` 的 `startStream()` 通过 fetch SSE 连接后端，需要验证 Anthropic API key 可用、token 加速正常、abort 可用
- [ ] **错误处理**：AI 调用超时、API key 失效、rate limit、token 超限等情况的用户提示

### 2. 计费系统未完成

- [ ] **支付接入**：目前只有 token 用量日志（`billing/service.py`），没有实际支付。需要接入 Stripe（国际）或支付宝/微信支付（国内）
- [ ] **定价页面**：展示 haiku/sonnet 价格、token 包购买、月费套餐
- [ ] **余额检查**：写作前检查用户 `token_balance`，余额不足时拒绝并跳转充值
- [ ] **用量仪表盘**：用户可查看各项目的 token 消耗、花费金额

### 3. 生产环境缺失

- [ ] **HTTPS 证书**：生产 nginx 配置 SSL（Let's Encrypt certbot）
- [ ] **环境变量安全**：`.env.example` 中的 `JWT_SECRET=dev-secret-change-me` 需要生产替换机制
- [ ] **数据库备份**：PostgreSQL 自动备份脚本 + 恢复文档
- [ ] **日志系统**：结构化日志（JSON format），接入日志聚合服务
- [ ] **健康检查 + 告警**：`/api/health` 已有，需要接入 uptime 监控和告警通知

---

## 🟡 MVP 功能缺口（收钱前应该做完）

### 4. 用户体系不完整

- [ ] **邮箱验证**：注册后发送验证邮件，未验证限制功能
- [ ] **密码重置**：忘记密码流程
- [ ] **OAuth 登录**：Google / GitHub / 微信 第三方登录
- [ ] **个人设置页**：修改密码、绑定邮箱、删除账号

### 5. 前端交互不完整

- [ ] **Settings 页面 AI 能力**：`SettingsHubPage` / `WorldSettingsPage` / `StyleSettingsPage` / `CharactersListPage` 目前只能手动填写，没有 AI 辅助讨论和生成
- [ ] **Outline 页面 AI 方向提案**：skill 里做了情节方向提案（ABC 方向 + 推理链），前端完全没有这个交互——目前只能手动填 outline
- [ ] **Writing Studio 实时质量反馈**：`WritePage` 的 `_scan_chunk` 已经做了，但前端只显示违规标签，没有引导用户修复
- [ ] **移动端适配**：当前只适配了桌面端

### 6. Reference Templates 过时

- [ ] **同步 skill 最新 template**：`reference/chapter.yaml.template` 的 `word_target` 仍是 `500`（skill 已是 `null`）；`reference/anti-ai.yaml.template` 缺少 `tic-patterns.yaml` 注释
- [ ] **Templates 版本管理**：template 文件头部加 version 字段，backend 检查项目 template 版本是否过期，提示升级

---

## 🟢 上线后迭代（可以先上线再补）

### 7. 质量检测扩展

- [ ] **quality.py 从 6 项扩到 15 项**：当前只有疲劳词、禁用句式、对话比、描写比、钩子提及、连续性占位。缺少句式开头多样性、身体反应模板、安全着陆检测等
- [ ] **10 维深度评审**：skill 的 `novel-review`（60+ 细项诊断）目前 SaaS 完全没有。后期可做成"AI 评审报告"付费功能

### 8. 管理后台

- [ ] **用户管理**：查看/封禁/删除用户
- [ ] **用量统计**：全局 token 消耗、收入、活跃用户数
- [ ] **系统配置**：模型切换、定价修改、公告发布

### 9. 运营功能

- [ ] **新手引导**：首次登录的 6 步引导流程
- [ ] **示例项目**：新用户注册后自动创建一个示例小说项目（如《钟声》的前 3 章）
- [ ] **分享功能**：生成章节的只读分享链接
- [ ] **反馈系统**：用户反馈入口，bug 报告

### 10. 性能与规模

- [ ] **前端构建优化**：代码分割、懒加载页面
- [ ] **数据库索引**：user_id、project_id、created_at 等高频查询字段的索引
- [ ] **API 限流精细化**：当前是全局 120 req/min，需要按 endpoint 差异化（写作接口更宽松，登录更严格）
- [ ] **CDN**：前端静态资源走 CDN

---

## 当前进度总结

| 模块 | 完成度 | 说明 |
|------|--------|------|
| 用户注册/登录 | 80% | 缺邮箱验证、密码重置、OAuth |
| 项目管理 | 90% | 创建/删除/列表 |
| Settings (设定) | 60% | CRUD 可用，缺 AI 辅助填写 |
| Outline (大纲) | 50% | CRUD 可用，缺 AI 方向提案 |
| Prompt (提示词) | 30% | 路由通了，AI 生成未接入 |
| Write (写作) | 40% | 路由+SSE 框架有了，未验证端到端 |
| Archive (归档) | 70% | 基本可用 |
| 质量检查 | 20% | 6/15 项，缺阈值检测 |
| 计费 | 20% | token log 有，支付未接入 |
| 前端 UI | 60% | 页面齐全，交互简陋 |
| 部署 | 70% | Docker Compose 可用，缺 SSL/备份/监控 |

**下一步优先级**：先打通 AI 写作全链路（🔴 第 1 项），让系统"能写出一章小说"。然后再接支付上线。
