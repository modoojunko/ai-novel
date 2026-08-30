# 门禁执行与结论（tasks 7.1 ｜ 2026-08-30）

| 门禁 | 结果 | 备注 |
| --- | --- | --- |
| server/frontend `npm run design:lint` | ✅ 通过（严格扫描 54 文件，0 违规） | 注销向导/账户页零新令牌 |
| server/frontend `vue-tsc --noEmit` | ✅ 通过（0 错误） | 含 apiWebLogin 泛型放宽、session.login 返回类型扩展 |
| client/frontend `tsc --noEmit` | ✅ 通过（0 错误） | useAuthHeal 失效分支新增 |
| C端 `design:check`（像素 parity） | ➖ 不适用 | C端无界面变化（1.1 判定：仅登录屏文案与回跳） |
| `design-cross`（共享段检查） | ➖ 不适用 | 不触两端共享段（base.css 零改动） |
| S端 pytest 全量 | ✅ 141 passed（新增 19） | 全 mock 不触真实库 |
| C端 backend pytest 全量 | ✅ 447 passed（新增 3） | 含 auth_local 会话失效清凭据用例 |
| C端前端 vitest 全量 | ✅ 110 passed | useAuthHeal 8 项含失效分支 |
| S端 e2e 全量（全 mock） | ✅ 105 passed（新增 5） | PR CI 同配置 |

与 1.1 判定一致：结论吻合，无越界改动。

## PR CI（tasks 6.2 ｜ run 33302017508，PR #243）

六工作流全绿：S端 后端 ✅ · S端 前端（含 e2e 105）✅ · C端 前端 ✅ · C端 后端 ✅ · Docker 镜像 ✅（lint 修复后第二轮；首轮 S端 后端 Lint RUF100/I001 已 ruff --fix 清零）

## C端 全量 e2e（tasks 6.3/5.2 ｜ 2026-08-30 本机 docker 栈）

- C端 全量：**20 passed / 12 skipped / 0 failed**（21.1 分钟；含新增 session-invalid 2 用例：失效清凭据回登录入口 + 重新登录无循环）
- S端 全量：**105 passed**（含注销 5 用例）；向导/账户页 6 张实现截图入 `evidence/screens/`
- 生产 PG：迁移已执行并验证（users 注销四字段 + 索引 + alembic_version → a1b2c3d4e5f6，存量 3 行回填 正常）
