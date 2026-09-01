# account-blocks-unify 设计

## Context

实现漂移于已批原型：`AccountPage.vue` 内嵌 `ChangePasswordForm` / `SecurityForm` 常开表单；后端 user/me（`get_license_info.py`）只返回 username/tier/expires_at/is_valid/theme；密保只有 PUT /api/user/security，无读路径。users 表已有 created_at。原型已先行获批（docs/design-s/prototypes/account-settings.html，worktree 内未 commit——mimosa 闸拦存量测试误报，随本 change 一起走 gh api 配方提交）。

## Goals / Non-Goals

**Goals:**
- 账户页对齐原型：B2 只读 kv 卡 + B3 安全行（修改密码/密保设置/退出登录）+ 主题 panel + 危险区不动
- 修改密码、密保设置改为 AppModal 弹层编辑；页面本体零裸表单
- user/me 增补 security_question / registered_at

**Non-Goals:**
- 不动注销向导/撤销期逻辑（account-deletion 既有态原样保留，危险区块不动）
- 不动主题交互（即点即存保留，仅标题结构归一）
- 不新增独立 GET /api/user/security 端点（走 user/me 一并返回）
- 不做退出登录位置调整（appbar + 首页卡既有入口不动；账户页新增行按原型保留）
- 不踢出其他已登录会话（IA §4.2-4 既有口径）

## Decisions

1. **弹层组件归属**：`ChangePasswordForm.vue` / `SecurityForm.vue` 改造为受控弹层组件（props: open，v-model:open + 提交事件），AccountPage 持有开关状态。备选"每块自带行+弹层自管状态"被否：撤销期变体中危险区会替换状态行，行序由页面统一编排更稳。
2. **密保状态来源**：user/me 一并返回 security_question（字符串，未设置为 ""），不建独立读端点。备选 GET /user/security 被否：多一次请求、字段天然属于"账号是什么"。
3. **答案安全**：沿用现状 hash_password 存储；响应层永不返回答案字段（DTO 无此出口，靠字段白名单保证而非序列化过滤）。
4. **registered_at**：直接取 `user.created_at`，user/me 序列化为 `YYYY-MM-DD`（日期即可，原型 kv 口径）。created_at 为 None 时回退空串。
5. **B2 卡**：删除 who-row 头像卡（含 tier pill/到期日），换 kv + rule-note；appbar 徽标与套餐页承载删掉的信息（IA D1）。
6. **弹层校验位置**：前端本地校验（缺项/一致性/长度）+ 后端既有校验兜底（旧密码错误、6 位下限），弹层内 err 提示不关弹层——与原型 S1/S1b 演示口径一致。

## Risks / Trade-offs

- [e2e 既有用例按页内表单编写] → 全量改走弹层路径，本地 docker 栈跑完 account/auth 相关 spec 再交付（改 lib/api 消费方必须本地跑 vitest 的既有纪律同批执行）
- [user/me 新字段对老客户端是增量] → 纯增量字段，C端不消费，无 breaking
- [密保问题文本对全用户可见] → 问题本身注册时自选、找回时本就展示，无新增暴露面；答案仍不可见
- [弹层打开时 session 数据未含 security_question（旧 JWT 缓存）] → fetchUserInfo 已在页面 load 时刷新，行状态以刷新后为准

## Migration Plan

单次部署：后端加字段与前端改版同批上线；无数据迁移（created_at/security_question 列已存在）。回滚 = revert 前端 + 后端字段（增量字段可独立保留）。

## Open Questions

无——待拍板项已随原型评审关闭（B2 对齐 + 退出登录行保留均获用户确认，2026-09-01）。
