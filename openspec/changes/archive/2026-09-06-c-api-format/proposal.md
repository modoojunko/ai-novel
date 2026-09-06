## Why

模型配置把「厂商」和「接口协议」混为一谈：后端调用靠 base_url 里含不含 `"anthropic"` 字符串猜协议，没有显式配置项；连接测试对 Anthropic 格式硬编码探测 `api.anthropic.com`（无视用户填的地址、鉴权头用错），用户填国产厂商（GLM Coding Plan 等）的 Anthropic 兼容地址必测错。厂商订阅文档普遍同时给出 OpenAI / Anthropic 两个接口地址，用户需要配置时自己选对格式并填对应 URL。

## What Changes

- 模型配置（添加/编辑弹窗）新增「接口格式」一级字段：OpenAI 格式 / Anthropic 格式 二选一；glm/kimi/deepseek/qwen/openai-compat 卡可切换，openai/anthropic/ollama 卡单格式锁定置灰。
- URL 一律不预填、无引导文案（拍板）：选供应商、切格式均不改动 URL，GLM 帮助小字删除，用户照抄厂商文档自填；placeholder 随格式给示例域名。
- 编辑态允许改接口格式（供应商仍锁定）；改格式清空已拉取模型列表与测试状态，不弹二次确认。
- 配置卡面不显示格式标识（拍板）。
- 后端按配置的接口格式调用大模型：openai 契约（chat/completions）或 anthropic 契约（/v1/messages），显式格式优先、存量 URL 嗅探降级为 legacy 兜底。
- 连接测试与模型拉取按协议重构：openai 格式 GET `{base}/models` + Bearer；anthropic 格式 GET `{base}/v1/models` + x-api-key + anthropic-version；删除 openai/anthropic 两处硬编码官方域名的存量 bug。models 端点 404 时自动降级 max_tokens=1 最小请求探活。
- 备份配置包 api_configs 条目加 `api_format` 键（加键兼容契约内，不升 format_version）；旧包导入默认 openai。
- 存量库幂等迁移：api_configs 加列 + 按「URL 含 anthropic 或 vendor=anthropic」回填，与现运行时猜测逻辑严格等价，升级零行为变化。

## Capabilities

### New Capabilities
- `model-api-config`: 模型配置屏（API Key 管理）的接口格式能力——格式字段语义与厂商锁定矩阵、URL 不预填与 GLM 双地址帮助、编辑态改格式语义、按格式调用与按格式探测、存量迁移与备份前向兼容。

### Modified Capabilities

（无——backup-restore 对配置包只约束「含 api_configs」，未枚举单条字段，加键在既有 format_version 加键兼容契约内，不构成需求变更。）

## Impact

- 后端：`client/backend/models/api_config.py`（加列）、`main.py`（幂等迁移）、`ai_client.py`（显式协议参数）、`api_configs/{connection,schemas,service,vendor}.py`（按协议探测与契约字段）、`backup/{export,importer}.py`（加键）、`tests/`。
- 前端：`client/frontend/src/components/api-config/{ApiConfigForm,ProviderIcon}.tsx`、`types/api-config.ts`、`design/base.css`（新增 `.seg.lock`）。
- 共享段：`.seg` 家族属两端 base.css 逐字同源共享段，`.seg.lock` 须双端同批落笔。
- 设计基线：`docs/design-c/prototypes/model-config.html` + `ADJUSTMENTS.md` 原型先行；评审稿 `docs/design-c/drafts/api-format-draft.html` 已拍板（2026-09-06）。
- e2e：`config-page.spec.ts` 补断言；`design-parity-config.spec.ts` 以新原型为基线。
- 兼容：旧备份包导入默认 openai；旧版应用读新包忽略未知键；存量配置回填后行为与升级前一致。

## Design Impact

- 受影响端：**C端**（S端仅 base.css 共享段同批补 `.seg.lock` 修饰类，无界面改动）。
- 受影响屏/弹层：模型配置屏（model-config）「添加 API Key / 编辑配置」弹窗；配置卡与删除/用量等其余部分不动。
- 对象状态：无新增对象状态族；复用既有 ok/err 测试结果态（.tresult）；新增控件态为 seg 置灰锁定（.seg.lock，属组件修饰类非状态语言新词）。
- 共享段：**触碰**（base.css `.seg` 家族新增修饰类）→ 双端同一次提交内同步落笔，另跑 scripts/design-cross.mjs。
- 原型先行：**需要**——先改 prototypes/model-config.html 并在 ADJUSTMENTS.md 登记，再改实现；评审稿 drafts/api-format-draft.html 已经用户拍板（UI 通过、URL 不预填、卡面不露格式、后端按格式调用）。
- 设计工件：实现侧自查（评审稿已定稿，原型改动为机械搬移）。
- 文案口径：字段「接口格式」、选项「OpenAI 格式 / Anthropic 格式」，与厂商订阅文档词面对齐，无内部术语；语气词沿用 ok/err，无新胶囊形态。
