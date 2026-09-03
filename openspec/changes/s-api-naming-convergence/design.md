## Context

`/grants/activate` 与 `/device/*` 两条路由的实现本体早已是对象语义（激活的就是 codes 表行、设备就是 devices 集合），改名不涉任何域逻辑/表结构/响应体变化。消费面（09-03 grep 证实）：`grants/activate` 仅 S端 控制台（pay.ts 1 处 + e2e mock 1 处 + pytest 3 处）；`/device/my`、`/device/remove` 仅 S端 控制台（web.ts 2 处 + e2e mock + test_web_api）。C端 桌面 client/ 零引用；client_api 面另有自己的设备路由（`/api/devices/current`、`/api/devices/consume-enrolled`），与本次改的 web 面互不相干。

## Goals / Non-Goals

**Goals**
- 激活链一名：URI `/codes/activate`、应用服务 `activate_code`、handler `activate_code`，域外词 grant/entitlement 从符号层清零
- 设备路由复数对齐：`/devices/my`、`/devices/remove`，与 client 面单复数统一
- 全程零 404（过渡别名覆盖部署窗口），响应体/错误码/UI 零变化

**Non-Goals**
- client_api 冻结契约不动：`/api/reset_password`、`/api/verify`、`/api/check-auth`、`/api/devices/consume-enrolled` 等已分发桌面安装包无法召回，改=永久双路径负资产（审计 S4/S5 据此销项）
- 不改 RESTful `DELETE /api/devices/{id}`：方法+参数形态变更属语义改造，命名 change 不夹带
- 不改响应体字段名（`grant_start`/`expires_at` 等）：字段名对齐留待后续独立评估，避免牵动前端类型与渲染
- openspec 归档历史不改

## Decisions

### D1 收敛词选 code，否决 grant/entitlement

域对象实存为 `ActivationCode`（`domain/licensing/activation_code.py`，表 `codes`）——URI 动作作用的对象就是它。`grant` 是"发放物"的域外借词（代码里并无 Grant 类），`entitlement` 是应用服务层的借词（权益是 License 聚合的口语描述，不是激活动作的对象）。备选：保留 grant 仅改 entitlement（半收敛，留一半错位，否）；改 `/activations/activate`（动作名叠动词，否）。

### D2 设备只复数化、不动方法语义

`/api/device/remove` → `/api/devices/remove` 保持 POST+body（`{id}`）。备选 RESTful `DELETE /api/devices/{id}`：需要 DeviceRemoveRequest→path param、错误口径与前端调用全改，属语义改造，记录备选不在本案做。

### D3 过渡别名走 license-naming 成例

新路径主注册 + 旧路径别名 decorator 同函数双挂，注释写明删除判据（线上前端 bundle grep 旧路径=0）。合并部署后立即核验线上包零引用，删别名小 PR 收尾（同 #286 先例，当个 change 内闭环）。

### D4 推送内容级校验

gh api blob 推送一律回读内容 grep 标记（#285 事故：两个测试文件被外部进程回退后 size 校验形同虚设）。

## Risks / Trade-offs

- [部署窗口旧前端包打新路径 404] → 别名覆盖；后端先部署
- [别名滞留] → spec 写明 MUST 移除 + tasks 收尾任务显式含删除与复验
- [worktree 外部进程再回退文件] → 编辑→验证→推送窗口最小化 + blob 内容级校验 + 推送后 fetch 回读对拍
- [文档附录 Z 与实现漂移] → backend-detail 激活行/错误枚举行、frontend-detail 4 处同批更新

## Migration Plan

单 PR（后端+前端+测试+文档）→ CI → 合并 → 自动部署 → 线上验证（codes/activate 行为同旧、别名同体）→ 收尾小 PR 删 3 条旧路径别名 → 复验终态 → 归档。回滚：revert 即回，无 schema/数据迁移。

## Open Questions

（无——冻结契约边界、方法语义、字段名均已裁定。）
