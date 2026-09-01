# account-blocks-unify

## Why

线上账户页（/dashboard/account）修改密码与密保设置是常开编辑态表单，"直接就可以改"——没有展示档、没有显式编辑动作闸门；且页内各块结构不统一（无标题头像卡 / 裸表单卡 / 原生 select）。根因是实现漂移于 2026-08-30 已评审的 account-settings 原型（IA 早裁定修改密码=行+弹层），而密保、主题两块原型从未覆盖。2026-09-01 用户评审线上页确认按已批原型改版，原型已先行更新并获批（docs/design-s/prototypes/account-settings.html + ADJUSTMENTS 登记）。

## What Changes

- 账户页统一「块 → 行 → 弹层」口径：页面本体零裸表单；所有块 = panel + 标题；安全动作 = 展示行（标题 + 当前状态 + 动词按钮）→ 弹层编辑。
- 账号信息块对齐 IA·B2：只读 kv 卡（用户名、注册时间）+ 账号模型提示（"只由用户名+密码组成，无邮箱无手机号"）；移除现头像卡中的套餐 pill 与到期日（appbar 已有同口径徽标，到期归"我的套餐"页，IA D1 裁定）。
- 修改密码：改为安全块内展示行 +「修改密码」按钮 → AppModal 弹层（当前密码/新密码/确认新密码），成功 toast、失败弹层内报错可重试（即 IA §5 S1 既有裁定的落地）。
- 密保设置：新增展示行，行状态显示当前密保问题文本（未设置时提示风险）+「设置密保/修改密保」按钮 → 新弹层（问题 select + 自定义问题 + 新答案）；答案哈希存储、界面永不回显旧答案；保存覆盖旧密保。
- 界面主题：补录为规范 panel（标题 + 说明 + swatch），交互不变（即点即存，零破坏可逆，刻意不设编辑档）。
- 后端增补：GET /api/user/me 返回增加 `security_question`（仅问题文本，任何情况不返回答案）与 `registered_at`（取 users.created_at）。

## Capabilities

### New Capabilities

- `account-security`：S 端账户页身份与安全块的展示/编辑交互——块→行→弹层结构、修改密码弹层、密保状态展示与密保弹层、user/me 增补 security_question/registered_at 的契约。

### Modified Capabilities

（无——account-deletion 的注销需求不变；theme-preferences 的交互与需求不变，仅呈现位置规范化。）

## Impact

- 后端：`server/app/application/licensing/get_license_info.py`（user/me 增补两字段）；相关 pytest 断言更新。
- 前端：`server/frontend/src/views/dashboard/AccountPage.vue` 重构（B2 kv 卡 + 安全行 + 弹层挂载）；`ChangePasswordForm.vue` / `SecurityForm.vue` 改造为弹层组件；`ThemeForm.vue` 标题结构微调；`stores/session.ts` 暴露 securityQuestion/registeredAt；e2e `account.spec.ts` 更新。
- 不触碰两端共享段（base.css 令牌与组件类零改动，全部复用既有 panel/set-row/AppModal/AppInput/AppButton/pill/notice 词汇）。
- e2e 口径：修改密码/密保改为弹层路径后，既有"页内表单直接填"的用例全部改走弹层。

## Design Impact

- 受影响端：**S端**（C端零改动）。
- 受影响屏/弹层：/dashboard/account 整页；新增修改密码弹层、密保设置弹层（均为 AppModal 词汇）。
- 对象状态：提示条语气仅 info/ok/warn/err；撤销期 warn 状态行沿用 account-deletion 既有态；无新增档位/胶囊形态。
- 共享段：不触碰。
- 原型先行：已完成——docs/design-s/prototypes/account-settings.html（worktree ai-novel-wt-account-blocks，含 ADJUSTMENTS 两条登记），2026-09-01 用户评审通过；设计工件由设计侧会话产出。
- 文案：按钮全动词（修改密码/修改密保/设置密保/确认修改/保存），称呼「你」，无内部术语（§13）。
