# AI Novel · 爱小说 — 产品化路线图

> 当前：SaaS 框架完成，前后端 schema 对齐。距离收费上线还有以下工作。

---

## 🔴 阻断 — AI 能力未接入

### 1.1 打通提示词生成链路

**现状**：`prompt/router.py` 的 `POST /chapters/{ref}/prompts/generate` 返回 `{"prompts": []}`
**目标**：调 `assembler.assemble_all_segments()`，真正生成 segment 提示词文件

- [ ] 1.1.1 `prompt/router.py` — `generate_prompts` 改为 `await assembler.assemble_all_segments(root_path, ref, project.name)`
- [ ] 1.1.2 验证 `assembler.py` 在真实项目文件上运行：创建测试项目 → 手动填 outline+segments → 调 endpoint → 检查 `prompts/vol-1-ch-1-seg-1-prompt.md` 是否生成
- [ ] 1.1.3 验证提示词内容包含：角色定位（从 writing-style.yaml 读）、疲劳词约束（从 anti-ai.yaml 扁平的 fatigue_words_zh）、段落指引（what_to_write + goal + emotional_tone）

### 1.2 打通 SSE 流式写作

**现状**：`write/router.py` `POST /chapters/{ref}/write/stream/{seg_idx}` 已路由到 `stream.py`，但前端可能无法连接
**目标**：前端点「生成」按钮 → 后端调 Anthropic → 正文流式返回前端 → token 用量记录成功

- [ ] 1.2.1 验证 `.env` 中 `ANTHROPIC_API_KEY` 被正确读取
- [ ] 1.2.2 前端 `WritePage.tsx` — `startStream()` 中 fetch URL 确认 base URL 正确（`getApiBaseUrl()` 返回值）；SSE 解析确认 `data:` 前缀和 JSON 反序列化
- [ ] 1.2.3 `stream.py` — 验证 `writing_model` 字段读取正确（haiku → `claude-haiku-4-5-20251001` 映射）；添加模型 ID 映射逻辑（haiku/sonnet → Anthropic model string）
- [ ] 1.2.4 验证 `on_complete` 回调触发 → `token_log` 写入 → `user.token_balance` 扣减
- [ ] 1.2.5 前端暂停/恢复/重生成按钮功能验证

### 1.3 实现视角转换 API

**现状**：`prompt/router.py` `POST /chapters/{ref}/perspective` 返回 `{"guidance": "上帝视角章纲 → 沉浸式写作指引 (placeholder)"}`
**目标**：真正调 Anthropic，把上帝视角章纲转换为沉浸式写作指引

- [ ] 1.3.1 `prompt/router.py` — 实现 `perspective_conversion`：读 `chapter.outline.summary` + `outline.key_points` → 构造 prompt → 调 Anthropic → 返回转换后的指引文本
- [ ] 1.3.2 prompt 内容：从 skill 的 `prompt/SKILL.md` "视角转换规则" 提取核心约束（"禁止上帝视角概述""只描述场景基调""字数不超过章纲 2-3 倍"等）
- [ ] 1.3.3 结果存入 `chapter.outline.perspective_guidance` 新字段，前端展示在 `PromptsPage` 的"视角引导"区域
- [ ] 1.3.4 token 用量记录到 billing

### 1.4 AI 调用错误处理

- [ ] 1.4.1 `stream.py` — Anthropic API 429（rate limit）→ 返回 `{"type": "error", "message": "AI 服务繁忙，请稍后重试"}`
- [ ] 1.4.2 Anthropic API 401（invalid key）→ 前端提示"API Key 配置错误，请联系管理员"
- [ ] 1.4.3 SSE 连接中断 → 前端显示"连接中断，已生成内容已保留"，允许从断点重试
- [ ] 1.4.4 `stream.py` 30s 无新 token → 自动 abort + 返回已生成内容
- [ ] 1.4.5 `token_balance` 不足时 → 写作前检查，拒绝请求，返回 `{"error": "insufficient_balance", "required": X, "current": Y}`

---

## 🔴 阻断 — 计费系统未完成

### 2.1 支付接入

- [ ] 2.1.1 **支付宝当面付/App支付**：`backend/billing/payment.py` — 创建订单/查询/回调验证（参考支付宝 SDK）
- [ ] 2.1.2 支付回调 webhook → 更新 `user.token_balance`
- [ ] 2.1.3 `billing/router.py` — `POST /api/billing/orders`（创建充值订单）、`GET /api/billing/orders/{id}`（查询状态）

### 2.2 定价与充值

- [ ] 2.2.1 定价方案：`10,000 tokens / ¥10`、`50,000 tokens / ¥40`、`200,000 tokens / ¥120`
- [ ] 2.2.2 前端 `BillingPage.tsx`（新建）：展示套餐、余额、充值按钮、消费记录
- [ ] 2.2.3 新用户注册赠送 `5,000 tokens`（`auth/router.py` register 中 `token_balance=5000`）

### 2.3 余额门禁

- [ ] 2.3.1 `write/router.py` stream endpoint → 调 `billing/service.py` 预估消耗 → 余额不足返回 402
- [ ] 2.3.2 `prompt/router.py` perspective/generate endpoint → 同上

---

## 🔴 阻断 — 生产环境缺失

### 3.1 安全加固

- [ ] 3.1.1 nginx 配置 SSL（Let's Encrypt certbot），HTTP→HTTPS 强制跳转
- [ ] 3.1.2 `JWT_SECRET` 生成脚本（`openssl rand -hex 32`），not hardcoded
- [ ] 3.1.3 CORS origins 生产限制为实际域名，不是 `*`

### 3.2 运维就绪

- [ ] 3.2.1 PostgreSQL 自动备份：`scripts/backup-db.sh` + cron 每日备份到 `/backups/`
- [ ] 3.2.2 备份恢复文档：`docs/backup-restore.md`
- [ ] 3.2.3 `docker-compose.yml` 加 healthcheck（postgres、backend、nginx）
- [ ] 3.2.4 日志：`structlog` 集成到 FastAPI，输出 JSON → `stdout` → docker logs
- [ ] 3.2.5 购买域名 `ainovel.cn` / `ainovel.com`，DNS 指向服务器 IP

---

## 🟡 MVP — 用户体系

### 4.1 账号安全

- [ ] 4.1.1 注册时生成 `verification_code`（6 位数字），存 User 表 + TTL 10 分钟
- [ ] 4.1.2 发送验证邮件（SMTP / SendGrid），`GET /api/auth/verify?code=xxx`
- [ ] 4.1.3 验证前跳转 `VerifyEmailPage`，限制不能创建项目和调 AI API
- [ ] 4.1.4 密码重置：`POST /api/auth/forgot-password` → 发重置链接 → `POST /api/auth/reset-password`

### 4.2 个人中心

- [ ] 4.2.1 `ProfilePage.tsx`（新建）：修改密码、绑定邮箱、查看登录历史、删除账号

---

## 🟡 MVP — 前端 AI 交互

### 5.1 Settings 页面 AI 辅助

**现状**：Settings 各个子页面只有表单，没有 AI 参与
**目标**：点「AI 辅助」按钮 → 调 Anthropic → 自动填充表单

- [ ] 5.1.1 后端 `settings/router.py` — `POST /api/projects/{id}/settings/ai-suggest`，接收 `{field: "world-setting", context: {}}`，读当前 file → 构造 prompt → 调 Anthropic → 返回建议
- [ ] 5.1.2 前端 `WorldSettingsPage.tsx` — 每个 field 旁加「🤖」按钮，点击调 AI 生成建议，用户确认后填入
- [ ] 5.1.3 `CharactersListPage.tsx` — 「+ AI 生成角色」按钮，输入角色名 → AI 生成 cognition / worldview / values / abilities → 创建 yaml
- [ ] 5.1.4 `StyleSettingsPage.tsx` — AI 辅助讨论写作风格，类似 skill Phase 2 的交互

### 5.2 Outline 页面 AI 方向提案

**现状**：只能手动填写 chapter outline
**目标**：AI 读取前文 → 推理 3-4 个方向 → 用户选一个 → 自动填充

- [ ] 5.2.1 后端 `chapters/router.py` — `POST /api/projects/{id}/chapters/{ref}/ai-directions`：读 hooks.yaml + 前章 + 卷纲 → 调 Anthropic → 返回 ABC 方向提案（格式同 skill 情节方向提案：推理链 + 读者语境 + 节拍链 + 章尾改变 + 章尾钩子）
- [ ] 5.2.2 前端 `OutlinePage.tsx` — 方向提案面板：选中章节 → 点「AI 方向」→ 展示 ABC 三个卡片 → 选一个 → outline 自动填充
- [ ] 5.2.3 选中方向后，memo 和 emotional_design 自动填充

### 5.3 写作质量实时引导

**现状**：WritePage 显示违规标签但无修复引导
**目标**：违规时弹出修复建议

- [ ] 5.3.1 违规项点击 → 弹出对话框："这是'{疲劳词}'是 AI 疲劳词。建议改成具体动作描写。AI 可以帮你改——要试试吗？"
- [ ] 5.3.2 「AI 修复」按钮 → 调 Anthropic → 替换违规段落 → 流式更新

---

## 🟡 MVP — Reference Templates 对齐

- [ ] 6.1 从 `awesome-novel-skilll/scripts/templates/` 同步以下文件到 `reference/`：`chapter.yaml.template`（word_target → null）、`writing-style.yaml.template`（参考文档段标记）、`anti-ai.yaml.template`（tic-patterns 注释）、`hooks.yaml.template`（已对齐）
- [ ] 6.2 每个 `.template` 文件头加 `# version: N`，与 skill 仓库版本号同步
- [ ] 6.3 `backend/settings/router.py` — `GET /api/projects/{id}/template-versions`：比较项目已安装版本 vs reference 最新版本，报告需要升级的文件

---

## 🟢 上线后 — 质量检测扩展

### 7.1 quality.py 补全到 15 项

**现有 6 项**：疲劳词、禁用句式、对话比、描写比、钩子提及、连续性占位

- [ ] 7.1.1 **句式开头多样性**：检测相邻 4 句是否同一代词/连词开头（他…他…他…）
- [ ] 7.1.2 **身体反应模板化**：扫描"眼神/心里/喉咙/手心"密度 > 5次/500字
- [ ] 7.1.3 **安全着陆检测**：章尾所有冲突完美解决 → 警告"读者没有点下一章的理由"
- [ ] 7.1.4 **情绪缺口检测**：章末是否有有效钩子（悬念/共情/期待/好奇）
- [ ] 7.1.5 **字数达标**：章节字数 vs word_target 总和
- [ ] 7.1.6 **上帝视角摘要**：扫描"本章讲述了""他意识到"等
- [ ] 7.1.7 **非正文内容**：引导语、解释、文末总结
- [ ] 7.1.8 **夹带分析腔**："这表明""这意味着"
- [ ] 7.1.9 **句式单调**：连续 5 句以上长度在 20-40 字区间

### 7.2 深度评审

- [ ] 7.2.1 参照 skill `review/SKILL.md` 10 维 60+ 细项，选核心 30 项实现为代码检查
- [ ] 7.2.2 评审报告生成：逐项输出 ✅/⚠️/❌ + 原文引用 + 修改建议
- [ ] 7.2.3 前端 `ReviewPage.tsx`（新建）：展示结构化评审报告

---

## 🟢 上线后 — 管理后台 + 运营 + 性能

### 8. 管理后台（`/admin` 独立路由）

- [ ] 8.1 用户列表：搜索/封禁/删除/查看详情
- [ ] 8.2 全局统计：注册数/DAU/token 消耗/收入/项目数
- [ ] 8.3 系统配置：模型 ID 映射、定价修改、站内公告

### 9. 运营功能

- [ ] 9.1 首次登录 6 步引导：创建项目 → 写设定 → 定大纲 → 生成提示词 → 写第一章 → 查看归档
- [ ] 9.2 新用户注册后自动创建示例项目（如《钟声》前 3 章完整数据）
- [ ] 9.3 章节分享：生成只读 URL `ainovel.cn/share/{token}`

### 10. 性能优化

- [ ] 10.1 数据库索引：`users.email`、`projects.user_id`、`token_log.user_id+created_at`、`novel_files.user_id+project_slug+file_path`
- [ ] 10.2 API 限流：写作接口 60 req/min，登录接口 10 req/min（防爆破）
- [ ] 10.3 前端：React.lazy + Suspense 懒加载页面
- [ ] 10.4 静态资源 CDN（CloudFront / 阿里云 CDN）

---

## 当前进度

| 模块 | % | 现状 |
|------|----|------|
| 用户注册/登录 | 80% | 缺邮箱验证、密码重置、OAuth |
| 项目管理 | 90% | CRUD 完整 |
| Settings (设定) | 60% | CRUD 可用，缺 AI 辅助 |
| Outline (大纲) | 50% | CRUD 可用，缺 AI 方向提案 |
| Prompt (提示词) | 30% | 路由通了，assembler 准备好，generate endpoint 返回占位 |
| Write (写作) | 40% | SSE 框架有，stream.py 准备好，未端到端验证 |
| Archive (归档) | 70% | 基本可用 |
| 质量检查 | 20% | 6/15 项，缺阈值检测 |
| 计费 | 20% | token log 有，支付 0 |
| 前端 UI | 60% | 页面齐全，纯手动交互无 AI |
| 部署 | 70% | Docker Compose OK，缺 SSL/备份/监控/域名 |

---

**立即开始**：1.1（打通提示词生成）+ 1.2（打通流式写作）— 让系统先"能写出一章小说"。
