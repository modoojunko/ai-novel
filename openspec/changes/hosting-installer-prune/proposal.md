# hosting-installer-prune 提案

## Why

每次 `v*` 发版向静态托管 `/download/v<VER>/` 净增约 70MB（exe≈30MB + dmg≈39MB），CloudBase 静态托管没有生命周期自动清理，占用只增不减——当前托管上已堆 3 个版本约 207MB。旧版本目录没有任何引用入口：`download/latest.json`、落地页直链（`constants/client-release.ts` 单源 + bump PR）、`notes.html` 都只指当前版本；历史版本获取已由下载弹窗「查看其他版本 →」指向 GitHub Releases 承接（Release 资产不限量且免费）。托管上的旧版本目录是纯死重，需要一个与发版同频的自动清理机制。

## What Changes

- `client-package.yml` release job 在「发布到静态托管 + 校验全绿」之后新增**旧版本清理步骤**：取全部 `v*` 标签按版本语义排序，保留最近 2 个版本（用户拍板），更老的 `download/v<VER>/` 整目录删除。
- 删除动作先 `--dry-run` 预览再真删；对从未上过托管的标签（如 v0.1、v0.4）容错跳过，降级为流水线 warning。
- 清理失败 MUST NOT 阻塞流水线：发布此刻已成功，多占 70MB 的代价不值得标红误导「发版失败」，下个版本会自动重试。
- 安全边界：`download/latest.json` 与排序前 2 的版本目录永不在删除范围；刚发布的版本是最新 tag，必然在保留集内。
- 一次性落地：机制合入后手动清掉存量旧版 v0.11（已核实 GitHub Release v0.11 有同名原件兜底，托管副本删除无后患）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `installer-release`：新增「托管旧版本自动清理」Requirement——保留策略（最近 2 版）、删除动作的预览与容错、失败降级语义、安全边界（latest.json 与保留集不可触碰）。与既有「已发布的版本目录 MUST 只增不改」并存不冲突：该条款约束**发布写入**永不覆盖，本次新增约束**历史目录回收**仅删无人引用的旧版本。

## Impact

- `.github/workflows/client-package.yml`：release job 末尾新增一个 step，约 25 行。
- 依赖复用：git 标签列表（release job 已 `fetch-depth: 0`，补一次显式 `git fetch --tags` 兜底）、`@cloudbase/cli`（发布步骤已全局安装，同 job 后续 step 直接可用）、`secrets.TCB_API_KEY` / `vars.TCB_ENV_ID`（与发布步骤同源，无新增凭据面）。
- 无用户可见界面改动、无前端/后端代码改动（纯 CI 流水线，免原型与 design:lint 门禁）。
- 一次性执行：`tcb hosting delete "download/v0.11" --dir`（先 dry-run 确认清单）。
