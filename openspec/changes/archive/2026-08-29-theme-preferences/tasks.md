## 1. 后端：模型 + 迁移 + API

- [x] 1.1 `users` 表加 `theme` 列（String(32), default "", server_default ""）+ alembic 迁移（幂等 DDL）；验收=迁移对全新库与存量库均幂等可重跑
- [x] 1.2 domain/application 层偏好读写：theme 白名单常量（6 key）+ 更新校验（非法值抛 422 语义错误）；验收=单元可测的纯函数
- [x] 1.3 `GET /api/user/me` 响应加 `theme` 字段；新增 `PUT /api/user/preferences`（鉴权 + 白名单 + 持久化 + 响应回显）；验收=契约测试覆盖默认/设置/非法值/未登录四路径
- [x] 1.4 pytest 全绿（含既有用例无回归）；验收=`pytest` 退出码 0

## 2. 前端令牌层：@cross 主题覆盖（双端同批）

- [x] 2.1 两端 base.css @cross 段新增 5 个非默认主题的 `:root[data-theme]` 覆盖层（accent/accent-strong，soft 保持 color-mix 派生），单次提交双端落笔；验收=`npm run design:cross` 零差异
- [x] 2.2 docs/ux 色相登记簿改写：单色相记录 → 主题色相集合登记（6 key + oklch 值 + 默认口径）；验收=文档与 spec 措辞一致
- [x] 2.3 C端 parity 回归确认默认态零变化；验收=`npm run design:check` 全绿（无需动原型）

## 3. S端：应用机制 + 选择器 UI

- [x] 3.1 session store 拉 me 后应用 `data-theme`（空串不设属性）；控制台入口前生效；landing/auth 不受影响；验收=手动 + e2e 断言 documentElement 属性
- [x] 3.2 AccountPage 新增「界面主题」卡片：6 swatch（色块 + 名称），选中态 accent-soft 环 + check 图标，点击即时生效 + PUT 持久化，失败 notice err + 重试出口；验收=截图入 change screenshots/
- [x] 3.3 e2e：mock 层 me/preferences 支持主题；用例覆盖——登录应用已存主题 / 点击切换即时生效+持久化 / 刷新保持 / 非法 key 前端不发送；验收=`npx playwright test` 全绿

## 4. 门禁回归 + 提交

- [x] 4.1 双端 `npm run design:lint` + `design:cross` + S端 vue-tsc + C端 tsc 全绿；验收=命令退出码 0
- [x] 4.2 截图证据（默认 teal + 各主题控制台态 + 选择器交互）入 change `screenshots/`；验收=截图齐全
- [x] 4.3 `openspec validate` 通过；提交并停审批（推送/PR 由用户拍板）；验收=validate 绿 + 提交落分支
