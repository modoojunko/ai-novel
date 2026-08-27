# hero-dual-platform-download · 设计

## Context

v0.1 已发布（四资产：版本号原件 + 固定名副本）。用户经两轮拍板确定方向：布局维持方案 A（双平台直下载按钮），但下载链路从「固定名 + latest」改为**版本号全面显式化**——资产只留版本号原件，落地页链接带版本号，版本号用常量单源维护、发版自动 bump。

## Goals / Non-Goals

**Goals:**

- 下载文件名、Release 页、落地页三处版本号一致可见。
- 发版后落地页更新零手工编辑（自动 bump PR），且漏合入时优雅降级（指向上一版，不坏链）。
- Release 资产收敛为 2 个，无重复文件。

**Non-Goals:**

- 运行时动态解析最新版（GitHub API 前端直查的可达性/限流风险，不做）。
- S端 302 短链服务（曾在候选中，被"版本号显式化"取向取代）。
- 存量 v0.1 Release 上固定名资产的回改清理。
- 图标体系改造（fill 型品牌 glyph，见 D3）。

## Decisions

### D1 · 版本常量 = 单一事实源，bump PR = 同步机制

`server/frontend/src/config/latestClientVersion.ts` 导出 `LATEST_CLIENT_VERSION = '0.1'`；按钮 href 与副行版本展示同源拼接。发版同步由 client-package release job 发完 Release 后自动开 bump PR（checkout 仓库 → sed 改常量 → `gh pr create`，改动一行）。备选对比：运行时 GitHub API 查询（国内可达性差+限流）、S端 302 短链（版本号隐式，与用户取向相反）、纯手工改（忘改即静默旧版）。bump PR 的降级语义是本方案的关键优势：**忘合入 ≠ 坏链**，只是按钮指向上一版资产（GitHub 历史资产永存），且 PR 列表里的未合 bump PR 本身就是显眼的"待办提醒"。

### D2 · 资产命名统一带 v 前缀；直链 URL 形态

用户拍板：双平台资产文件名统一带 `v`。现状 exe 为 `AI_Novel_Setup_v0.1.exe`（installer.iss 模板已内置 v）、dmg 为 `AI_Novel_mac_0.1.dmg`（workflow hdiutil 步骤没带）——本 change 将 workflow DMG 构建步骤的输出名改为 `AI_Novel_mac_v$VERSION.dmg` 对齐。落地页直链：`https://github.com/modoojunko/ai-novel/releases/download/v${VER}/AI_Novel_Setup_v${VER}.exe` 与 `…/AI_Novel_mac_v${VER}.dmg`；两平台文件名模板集中封装在版本常量同文件内（单一导出），避免散落。历史 v0.1 Release 的 `AI_Novel_mac_0.1.dmg`（无 v）不回改，自 v0.2 起生效新命名。

### D3 · 不新增品牌 glyph

沿用 stroke 体系 `download` 图标，平台由按钮文字区分（理由沿用上一轮：fill 型 logo 与 stroke 视觉基因冲突，且触发两端图标注册表一致性约束）。

### D4 · workflow 删固定名副本 + body 改写 + bump 步骤

release job 三处改动：删「Copy stable-name duplicates」步骤；softprops body 去掉固定名直链说明（保留双平台与首开绕行提示）；新增「Open landing version bump PR」步骤——仅 tag 触发时执行，`gh pr create` 用 `GITHUB_TOKEN`（同仓开 PR 无需 PAT；PR 由人合入后走既有 push-main 部署管线，不新建第二套部署路径）。

## Risks / Trade-offs

- [忘合 bump PR → 落地页按钮指向旧版资产] → 降级语义安全（旧资产不失效）；bump PR 标题醒目（「v<x> 已发布：落地页版本号待更新」）；可在 release body 尾部加一句提醒。
- [GITHUB_TOKEN 开的 PR 默认不会自动触发其他 workflow] → bump PR 的 CI 由人合入 main 后正常触发，符合既有管线；无需 PAT。
- [版本常量与实际最新 Release 漂移的窗口期] → 发布到 bump 合入之间（通常分钟级）落地页指上一版，可接受。
- [bump PR 若与进行中的 S端 PR 冲突] → 常量文件独立、仅一行，冲突概率极低；冲突时 bump PR 需手动 rebase。

## Migration Plan

1. 单 PR：HeroSection.vue + 版本常量 + workflow 三处改动 + 本 change 工件；门禁全绿合入。
2. 合入 main 自动部署，线上抽查按钮直链（含版本号）与两态截图。
3. 下一次发版（如 v0.2）起：tag push → 自动出 Release（2 资产）+ 自动开 bump PR。
4. 回滚：revert 单 commit；固定名机制如需恢复，revert 本 change 的 spec REMOVED 与 workflow 步骤即可。

## Open Questions

（无——版本显式化方向与 bump 机制已经用户拍板。）
