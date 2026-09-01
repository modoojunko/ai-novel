# account-blocks-unify 任务清单

## 1. 后端：user/me 增补

- [x] 1.1 `get_license_info.py` 返回增加 `security_question`（取 user.security_question，None→""）与 `registered_at`（user.created_at→YYYY-MM-DD，None→""）；跑 `server` 相关 pytest 验证既有用例不破
- [x] 1.2 后端测试：user/me 断言含 security_question/registered_at 且不含答案字段（对齐 specs/account-security「user/me 返回密保问题与注册时间」）

## 2. 前端：账户页改版

- [x] 2.1 session store 暴露 securityQuestion / registeredAt（fetchUserInfo 存新字段）；S端无 vitest（e2e 全 mock 覆盖），断言由 e2e 承接
- [x] 2.2 AccountPage：B2 账号信息换只读 kv 卡（用户名/注册时间 + 账号模型 rule-note），删除 who-row 头像卡（tier pill/到期日移除）
- [x] 2.3 ChangePasswordForm 改造为受控弹层组件（props open + v-model:open），本地校验（缺项/不一致/同旧密码/<6 位）弹层内 err 不关弹层，成功 toast+清空+关闭
- [x] 2.4 SecurityForm 改造为受控弹层组件：问题 select（预设+自定义联动）+ 新答案（不回显），打开预选当前问题；成功后行状态即时更新
- [x] 2.5 AccountPage 安全块三行（修改密码/密保设置/退出登录）：行状态文案（已设置：{问题} / 未设置提示）、按钮「修改密码/设置密保·修改密保」、退出登录 lnk（接 session.logout）；ThemeForm 标题结构对齐 panel 词汇
- [x] 2.6 `npm run design:lint` + `vue-tsc --noEmit` 全绿（S端免像素 parity，附截图对照入 change 目录）

## 3. e2e 与全量验证

- [x] 3.1 e2e `account.spec.ts` 改走弹层路径（点行按钮→填弹层→提交→断言行状态/toast），补"默认态无裸表单输入"断言；auth.spec.ts 若触修改密码同批改
- [x] 3.2 本地 docker 栈全量跑 S端 e2e（account/auth 相关必过）+ 后端全量 pytest（容器内模板法）

## 4. 收尾

- [x] 4.1 change 目录附实现截图对照（默认态/两弹层），勾 tasks，`openspec validate` 全绿
- [ ] 4.2 commit（原型+openspec+实现一个分支；mimosa 闸误报→gh api 配方）并向用户汇报，等拍板后走归档 PR
