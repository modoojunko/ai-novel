## 1. 后端：数据层与调用（PR1）

- [x] 1.1 `models/api_config.py` 加 `api_format` 列 + `main.py` lifespan 幂等加列与回填（`base_url LIKE '%anthropic%' OR vendor='anthropic'` → anthropic）；pytest：空库建表含列、模拟旧库启动后列存在且回填正确、重复启动幂等
- [x] 1.2 `ai_client.py` 构造加 `api_format: str | None = None`，显式优先、None 时保留 URL 嗅探；`get_ai_client_for_user()` 两处 ApiConfig 构造点透传；thinking 参数行为不动（拍板：归书的 AI 设定域）；pytest：anthropic+无关键字 URL 走 Anthropic、openai+含 anthropic URL 走 OpenAI、None 嗅探兜底

## 2. 后端：探测与契约（PR1 续）

- [x] 2.1 `connection.py` 探测重构为按协议分支 + ollama 特例前移；删除 anthropic/openai 两处硬编码官方域名；anthropic 格式剥 /v1 尾防双拼；models 404 降级 max_tokens=1 探活；pytest：httpx mock 断言探测 URL 与鉴权头、双拼防护、404 降级、ollama 免 Key
- [x] 2.2 `schemas.py`/`service.py`/`router.py` 契约：Create/Update/TestRaw Body 加 `api_format`、Response/StatusEntry/`_config_to_dict` 回传（顺带补缺失的 vendor_override）；update 白名单纳入 api_format、vendor 重识别不回写协议、改协议清空 last_test_* 与 models；pytest：create 传/不传、update 改/不改、非法值 422
- [x] 2.3 `backup/export.py` 导出加 `api_format` 键（不升 format_version）、`importer.py` 缺键默认 openai；pytest roundtrip 四点：新包逐行一致 / 旧包全 openai / 同名跳过不被污染 / anthropic 行重加密后可解密且协议正确
- [x] 2.4 后端全量 pytest + ruff 全绿（venv python 跑，防系统 3.9 假绿）

## 3. 原型与共享段（PR2 先行）

- [x] 3.1 按评审稿 `docs/design-c/drafts/api-format-draft.html` 搬移 `prototypes/model-config.html`：modalConfig Base URL label 行加 .seg 两态、新建/编辑/锁定三态、URL 不预填行为；`ADJUSTMENTS.md` 登记 .seg.lock 新元素与预填废除；交付物=两文件 diff 可读
- [x] 3.2 双端 `design/base.css` 同批新增 `.seg.lock`（共享段纪律）；跑 scripts/design-cross.mjs，若 cross 基线未建则在回归小节注明「cross 校验待建」
- [x] 3.3 C端 `npm run design:lint` + `npm run design:check` 全绿（注意存量 parity 字体光栅漂移口径，基线重拍须同机）

## 4. 前端实现（PR2）

- [x] 4.1 `types/api-config.ts` 加 api_format；`ProviderIcon.tsx` 废除 VENDORS.baseUrl 预填、新增厂商×格式锁定矩阵；tsc --noEmit 绿
- [x] 4.2 `ApiConfigForm.tsx`：Base URL label 行 .seg 两态（锁定置灰）、选厂商/切格式不动 URL 且清测试结果、placeholder 随格式、编辑态 seg 可点且保存透传 api_format；vitest 相关用例绿
- [ ] 4.3 本地 docker 栈全量 e2e：`config-page.spec.ts` 补断言（GLM 默认 OpenAI 格式、切格式 URL 不动、官方卡锁定、编辑态改格式持久化）、`design-parity-config.spec.ts` 以新原型基线过；注意存量红（config-page Undo / v01 B5 / U3）勿误判新回归

## 5. 实测验证与演练

- [x] 5.1 真实 GLM Key 双格式实测：coding/paas/v4（OpenAI 格式）与 api/anthropic（Anthropic 格式）各建配置，测试连接 + 模型拉取 + 流式生成 + token 计量全通；结论记入归档总结
- [x] 5.2 存量库升级演练（升级前后生成行为一致）+ 旧版配置包导入新版演练（全 openai 不报错）——注：5.1 用户本机实测通过（2026-09-06）；5.2 真实 docker 库迁移已验 + roundtrip pytest 覆盖

> 实施注记（2026-09-06）：3.3 design:lint 绿、cross 零差异；本机 parity 红为存量字体光栅漂移（与 main 差异率逐位相同 3.621%/2.945%，非本变更）。4.3 vitest 110 绿/tsc 清；e2e 新用例 UI 断言全过，创建步骤撞本机存量 config.json check-auth 写回竞态（主 checkout 同挂），后端契约已真实请求手工验证（POST 返回 api_format=anthropic）。5.1 待真实 GLM Key。CI 门禁以后端 pytest+前端构建为主，e2e 定时 CI 兜底。
