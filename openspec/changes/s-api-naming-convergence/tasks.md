## 1. 双端影响判定（原型先行的替代任务）

- [x] 1.1 判定本改动为纯 S端 且不触共享段（依据=proposal「Design Impact」：零视觉/文案变化，仅 URL 与符号改名；C端 桌面 client/ 零引用两旧 URI 已 grep 证实），原型先行豁免；验证=判定结论记入本条

## 2. 后端

- [x] 2.1 `web_api/payments.py`：路由改 `@r.post("/codes/activate")` + `@r.post("/grants/activate")` 过渡别名（注释注明删除判据）；handler `activate_grant`→`activate_code`；import/调用改 `activate_code`；验证=✅ 全量 pytest 绿
- [x] 2.2 应用服务更名：`application/payments/activate_entitlement.py` git mv → `activate_code.py`，def 与 docstring 同步，`__init__.py` 导出更新；验证=✅ 残余仅 backend-detail 758 历史方案行；✅ 全量 pytest 290 绿
- [x] 2.3 `web_api/devices.py`：`/api/device/my`→`/api/devices/my`、`/api/device/remove`→`/api/devices/remove`（各带旧路径别名），函数 `api_device_*`→`api_devices_*`，模块 docstring 同步；验证=✅ test_web_api/test_device_activation 同批换路径后全绿
- [x] 2.4 测试换路径：`test_payments_api.py` 3 处 grants/activate→codes/activate；`test_web_api.py` 头注与 5 处 device→devices；验证=✅ 290 passed

## 3. 前端（server/frontend）

- [x] 3.1 `src/api/pay.ts`：URL 改 `/pay/codes/activate`；`src/api/web.ts`：URL 改 `/devices/my`、`/devices/remove`（函数名不动）；验证=✅ exit 0
- [x] 3.2 `e2e/mocks/api-handlers.ts`：激活路由串与 glob 清单换 codes/activate，设备两路由串与 glob 换 devices/*；验证=✅ 151 passed (25.2s)

## 4. 设计事实源（docs/design-s）

- [x] 4.1 `backend-detail-design.md`：附录 Z 激活行（1635）与激活错误枚举行（1689）改 `/api/pay/codes/activate`（注明 grants/activate 为过渡别名）；验证=✅ 残余仅别名说明
- [x] 4.2 `frontend-detail-design.md`：联合契约注（535）、请求示例（573）、e2e mock 清单（970）、spec 描述（995）同批；验证=✅ 四处全清

## 5. 回归与上线验证

- [x] 5.1 门禁全跑并记录结论：`vue-tsc --noEmit` → **exit 0**；全量 `pytest -q` → **290 passed**；`design:lint` 存量红同 license-naming 口径（site-beian emoji，主目录同报）；ruff 改动文件 10 处全为存量（refund_flow/scan_orders/已知 2 处，主目录同报）：`vue-tsc --noEmit` / 全量 `pytest` / `design:lint`（存量红口径同 license-naming：site-beian emoji）；验证=结论写入本条
- [ ] 5.2 残余 grep 验收：全 worktree（排除归档/venv/node_modules/.mimosa）`grants/activate`、`activate_entitlement`、`device/my`、`device/remove` 残余=后端别名 + 测试/文档过渡性表述；验证=清单核对
- [ ] 5.3 上线验证（合并 → 自动部署后）：`POST /api/pay/codes/activate` 与 `/grants/activate` 未登录口径一致（4001 系）、`GET /api/devices/my` 与 `/api/device/my` 同；前端线上包换名后核验零引用；验证=实测记录
- [ ] 5.4 收尾小 PR：判据成立后删 3 条旧路径别名 → 全量 pytest 绿 → 合并部署复验新路径 200/旧路径 404；验证=线上终态记录

## 6. 归档

- [ ] 6.1 openspec sync + 归档走 PR（--admin 纯文档）；验证=归档后 specs 含新 requirement、changes 列表无本 change
