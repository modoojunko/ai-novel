## Why

命名审计（~/Desktop/knowledge/naming-audit-s-c-2026-09.md）S端 剩余两项本体论错位：① 激活一条动作链上**一物三名**——域对象叫 `ActivationCode`（codes 表）、URI 动作叫 `grant`（`/api/pay/grants/activate`）、应用服务叫 `entitlement`（`activate_entitlement.py`），同一对象三个词；② web 控制台设备路由用**单数**（`/api/device/my`、`/api/device/remove`），与 client 面复数（`/api/devices/current`）漂移。消费面已核实：两者均仅 S端 控制台自调（C端 桌面零引用 `grants/activate`；8.3 已拆除的 `/api/license/activate` 与本案无关），前后端同仓同发，套 license-naming 成例（过渡别名→零引用→删除）成本最低。

## What Changes

- **BREAKING**（同仓同发+过渡别名兜底，无外部消费者）：`POST /api/pay/grants/activate` → `POST /api/pay/codes/activate`，响应体与错误码口径零变化
- 应用服务符号收敛：`activate_entitlement.py` → `activate_code.py`（git mv）、函数 `activate_entitlement` → `activate_code`；handler `activate_grant` → `activate_code`
- `GET /api/device/my` → `GET /api/devices/my`、`POST /api/device/remove` → `POST /api/devices/remove`（复数对齐 client 面；**保持 POST+body 语义不变**），两条旧路径过渡别名，前端零引用后删
- 前端符号：`apiDeviceMy`/`apiDeviceRemove` 函数名保留（已是动词+对象语义，无错位），仅 URL 换新路径
- 测试/e2e 同批：test_payments_api、test_web_api、mocks/api-handlers 路由串与 glob 清单
- 设计文档同批：backend-detail 附录 Z 激活行与错误枚举行、frontend-detail 联合契约注/请求示例/e2e 清单

**非目标（裁定不动，理由入 design）**：
- client_api 面全部保留：`/api/reset_password` snake_case、`/api/verify`、`/api/check-auth`、`/api/devices/consume-enrolled`——**已分发桌面安装包的冻结契约**，旧客户端无法召回，改名=永久双路径负资产
- `/api/device/remove` 不改 RESTful `DELETE /api/devices/{id}`（方法语义变更超出命名范畴，记录备选）
- 响应体字段（`grant_start` 等）不改——字段名本轮不在对齐范围，避免扩大爆炸半径

## Capabilities

### New Capabilities

- `devices`: web 控制台设备管理路由契约（复数资源命名 + 过渡别名行为）

### Modified Capabilities

- `s-payments`: 新增「激活动作接口命名对齐域对象 code」requirement——激活动作 URI 取自实存域对象名（codes），废除 grant/entitlement 域外借词

## Impact

- **后端**：`web_api/payments.py`（路由+handler）、`web_api/devices.py`（4 处路由/函数）、`application/payments/activate_entitlement.py`（git mv+函数名）、`application/payments/__init__.py`
- **前端**：`api/pay.ts`（1 URL）、`api/web.ts`（2 URL）、`e2e/mocks/api-handlers.ts`（3 路由串+glob 清单）
- **测试**：`test_payments_api.py`（3 处）、`test_web_api.py`（头注+5 处）
- **文档**：backend-detail-design 2 行、frontend-detail-design 4 处
- **部署**：push main 自动部署后端；别名覆盖前后端窗口期

## Design Impact

- 受影响端：**S端**（C端 桌面 client/ 零引用两个旧 URI，grep 证实）
- 受影响屏：我的套餐页激活按钮（URL 层换名，UI 零变化）；设备页（URL 层换名，UI 零变化）
- 对象状态/文案/共享段：零触碰
- 原型：免（纯路径/符号改名，零视觉变化）；设计文档 API 表同批更新，实现侧自查
