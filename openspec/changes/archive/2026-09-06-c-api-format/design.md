## Context

C端大模型调用层（`ai_client.py`）已同时实现 openai / anthropic 两种 SDK 分支，但协议选择靠 base_url 含 `"anthropic"` 字符串推断；`api_configs` 表无协议字段，`vendor` 把厂商与协议混为一谈。连接测试（`connection.py`）按 vendor 分支构造探测，anthropic/openai 两分支硬编码官方域名、无视用户 base_url。UI 评审稿（`docs/design-c/drafts/api-format-draft.html`）已经用户拍板：接口格式为 URL 同行的两态 seg、URL 不预填、卡面不露格式。三方讨论（PM/架构/UX）结论全文见会话记录，数据层与探测重构方案为架构师定稿。

## Goals / Non-Goals

**Goals:**
- `api_format` 成为 api_configs 的一等字段，调用、探测、备份、UI 全链路显式化
- 存量用户升级零行为变化；旧备份包可导入
- 顺带修复两处存量缺陷：anthropic 探测硬编码官方域名、openai 探测硬编码官方域名

**Non-Goals:**
- 不做一条配置双格式双 URL（一条配置=一个格式，双格式建两条）
- 不做格式与 URL 矛盾的前端即时校验（中转站形态不可枚举，误报打断照抄流程）
- 不动卡面信息架构（不露格式标识）、不动各生成链路消费方（全部经 `get_ai_client_for_user()`，签名向后兼容）
- 不做两格式间模型 ID 映射（改格式即重拉）
- **不动 thinking 参数行为与模型选择（拍板 09-06：归属「书的 AI 设定」域）**——openai 分支现携带 `extra_body={"thinking":{"type":"disabled"}}`、kwargs 可覆盖的现状保持原样，严格端点 400 的存量隐患不在本期范围

## Decisions

1. **`api_format` 独立成列，不从 vendor 派生**。GLM 一个 vendor 两种报文格式是铁证；vendor 回答"跟谁计费/模型生态"，api_format 回答"HTTP 报文长什么样"，正交。命名用 `api_format` 不用 `protocol`——`vendor.py` 已有 protocol 旧语义（且从未正确赋值），切割防止混淆。取值 `Literal["openai","anthropic"]`，Pydantic 层校验，String(20) 列。
2. **迁移 = 幂等加列 + 纯 SQL 回填**。`ALTER TABLE api_configs ADD COLUMN api_format VARCHAR(20) NOT NULL DEFAULT 'openai'` + `UPDATE ... SET api_format='anthropic' WHERE base_url LIKE '%anthropic%' OR vendor='anthropic'`（走 main.py lifespan 惯例）。回填条件与现运行时嗅探严格等价 → 零回归；无 Python 嗅探参与，无失败路径。
3. **AIClient 显式优先、嗅探兜底**。构造签名加 `api_format: str | None = None`；None 时保留现 URL 嗅探逻辑（旧 User.api_key 回退、config.json 兜底、旧备份导入均无格式信息）。`get_ai_client_for_user()` 的 ApiConfig 两处构造点透传 `cfg.api_format`。全仓 `AIClient(` 直接构造封闭在本模块内，消费方零波及。
4. **探测从"按 vendor 分支"重构为"按协议分支 + ollama 特例"**。ollama 在协议分支前短路（免 Key 判定随特例走，避免 ollama+openai 组合被要求填 Key）。openai 格式 `GET {base}/models` + Bearer；anthropic 格式 `GET {base}/v1/models` + `x-api-key` + `anthropic-version: 2023-06-01`（base 以 /v1 结尾时先剥防双拼）。两级降级：models 404 → POST `{base}/v1/messages` max_tokens=1 判活。`test_connection`/`TestRawBody` 加 `api_format` 参数。
5. **update 语义**：`api_format` 进更新白名单；改 base_url 触发的 vendor 重识别 SHALL NOT 回写 api_format（协议是用户显式选择）；改 api_format 时置空 `last_test_*` 与 `models`。
6. **前端控件**：`.seg` 两态放 Base URL label 行右侧（格式是 URL 的属性）；锁定态新增 `.seg.lock`（opacity .45 + pointer-events none）——`.seg` 家族属两端 base.css 共享段，双端同批加修饰类；预填表（VENDORS.baseUrl）整体废除（拍板：URL 不预填），placeholder 按格式给示例域名；无任何地址引导文案（拍板：GLM 帮助小字删除）。切格式/换供应商清测试结果，不动 URL。
7. **原型先行**：按评审稿搬移 `prototypes/model-config.html`（modalConfig 新建/编辑/锁定三态）+ `ADJUSTMENTS.md` 登记（.seg.lock 新元素、URL 不预填行为变更），再动实现，保 parity 门禁不红。

## Risks / Trade-offs

- [GLM anthropic 端点 `/v1/models` 是否存在未实测] → 两级降级探活已覆盖；开工前用真实 Key 实测一轮（deepseek/kimi 的 anthropic 兼容地址同为文档值，本期界面不展示地址文案，风险仅在用户自填场景）
- [Anthropic SDK base_url 拼 `/v1/messages` 而 OpenAI SDK 惯例 base 自带 `/v1`，两格式 URL 语义相反] → placeholder 按格式给对示例；保存 anthropic 配置时对以 /v1 结尾的 base 给软提示（不阻断）
- [回填对反代 anthropic 端点（URL 无关键字）无能为力] → 已知盲区，现状本就走 openai 且行为不变，用户显式改格式即可
- [parity 基线漂移] → 原型先行 + ADJUSTMENTS 登记；`.seg.lock` 双端同批，另跑 design-cross.mjs

## Migration Plan

单机桌面应用无服务端发布窗口：升级即迁移（启动 lifespan 幂等 DDL + 回填）。回滚 = 旧版忽略新列/新键继续嗅探，行为不变。部署顺序单 PR 内自洽（列加了就有默认值，无两阶段依赖）。

## Open Questions

（无——四项拍板已定：UI 通过、URL 不预填、卡面不露格式、后端按格式调用；降级探活与 thinking 顺带修按默认执行。）
