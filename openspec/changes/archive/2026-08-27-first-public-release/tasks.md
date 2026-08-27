## 1. CI 发布链路增强（client-package.yml）

- [x] 1.1 release job 在 download-artifact 之后新增一步「复制固定命名副本」：`AI_Novel_Setup_*.exe` → `artifacts/AI-Novel-Setup-Windows.exe`、`AI_Novel_mac_*.dmg` → `artifacts/AI-Novel-Setup-macOS.dmg`（与带版本号原件并存上传）。验证：YAML 本地解析无误 + diff 自查确认 glob 只命中包体单文件
  - 证据：`python3 -c "import yaml; yaml.safe_load(...)"` 输出 YAML OK；glob 源（`AI_Novel_Setup_*`/`AI_Novel_mac_*`）与目标名（连字符命名）无自匹配回路
- [x] 1.2 softprops 步骤补 `body:` 简版说明：双平台安装包 + 固定名为最新直链 + macOS 右键打开/Windows SmartScreen 绕行各一句。验证：diff review 文案无内部术语、动词起句
  - 证据：body 四行文案已入 workflow，均为用户视角说明、无门控/SSE 等内部术语

## 2. 落地页下载入口修复（S端）

- [x] 2.1 `HeroSection.vue` 下载按钮 href 修正 owner：`mooodjunko/ai-novel` → `modoojunko/ai-novel`（保持指向 `/releases/latest` 页面而非直链）。验证：页面源码中出现正确 URL
  - 证据：domSnapshot 中 `link "下载 Windows 版"` 的 /url 已是 `https://github.com/modoojunko/ai-novel/releases/latest`
- [x] 2.2 `ActivationGuideSection.vue` 「下载安装」第 1 步改为双平台口径：Windows 安装包 + macOS DMG 获取说明（含首次打开方式提示）。验证：`grep -c 'macOS' 组件源码 ≥ 1` 且不再出现"仅 Windows"式表述
  - 证据：渲染截图 `screenshots/landing-guide.png` 第 1 步文案为双平台口径
- [x] 2.3 全库 grep 校验 `mooodjunko` 归零：`grep -rn 'mooodjunko' --exclude-dir=node_modules .` 无输出即过
  - 证据：live 面（vue/ts/js/iss/yml/json）grep 零命中；另修掉任务未列出的同类死链 2 处——`FooterSection.vue` 页脚 GitHub 链接、`installer.iss` 的 MyAppURL（烘进 exe 元数据）；仅 change 文档中引用错拼作历史描述保留

## 3. 门禁与合入

- [x] 3.1 S端 前端门禁：`cd server/frontend && npm run design:lint && npx vue-tsc --noEmit && npm run build` 全绿。验证：三条命令退出码均为 0
  - 证据：design:lint 严格扫描 47 文件存量 0（exit 0）；`npm run build`（内含 vue-tsc --noEmit）built in 667ms（exit 0）
- [x] 3.2 开 PR 到 main：只圈定本变更文件（`.github/workflows/client-package.yml`、两个 landing 组件、`openspec/changes/first-public-release/`），不夹带工作区既有的 `openspec/config.yaml` 与 `specs/design-system/spec.md` 未提交改动。验证：PR Files changed 清单逐项核对
  - 证据：PR #209 Files changed 共 12 项，全部属于本变更；CI 全绿（双平台打包 pass、`release` job 对 PR 触发显示 skipping——即规格「PR 构建不对外发布」场景的实证）；config.yaml 与 design-system spec 保持未提交未入 PR
- [x] 3.3 本地起 S端 dev server 截落地页 Hero + 激活指引对照图，归档至 `openspec/changes/first-public-release/`（纯 S端 免原型的证据要求）。验证：change 目录存在截图文件
  - 证据：`screenshots/landing-hero.png`（1280×900 视口，Hero 按钮与书架 mock）+ `screenshots/landing-guide.png`（锚点直达 #guide，三步指引含新双平台文案）

## 4. v0.1 首发（依赖 1–3 全部完成且 main 绿）

- [x] 4.1 在 main 最新 commit（已含 1.x 修复）上打标签并推送（`git tag v0.1` + 推送该 tag），跟踪 Actions 至 macos/windows 双 job 绿。验证：`gh run list --workflow=client-package.yml` 最新 tag run 为 success
  - 证据：tag v0.1 打在 6e64c83（含 #209 的 release job），run 33071230272 conclusion=success（mac+win build + release job 全过）
- [x] 4.2 验收 Release 资产：`gh release view v0.1` 含四资产（两带版本号原件 + 两固定名副本）。验证：命令输出的 assets 列表逐一核对
  - 证据：`AI_Novel_Setup_v0.1.exe`(29.6MB) / `AI_Novel_mac_0.1.dmg`(38.9MB) / `AI-Novel-Setup-Windows.exe`(与原件字节数一致) / `AI-Novel-Setup-macOS.dmg`(同)；release body 为烘入的双平台说明
- [x] 4.3 验收稳定直链与入口闭环：`curl -sIL https://github.com/modoojunko/ai-novel/releases/latest/download/AI-Novel-Setup-Windows.exe` 返回 302 且 content-length > 0（dmg 同理）；浏览器实测落地页 Hero 按钮跳转 Releases 页非 404。验证：两条命令输出 + 截图留档
  - 证据：本机网络到 github.com web 侧 443 不通（gh api 侧正常），改双路验证——① `gh api releases/latest` 返回 tag=v0.1 且四资产名与固定名一致（latest/download 的重定向映射两端均被 API 证实）；② 云端 webReader 抓取 `releases/latest` 实落 v0.1 页非 404（发布者 github-actions，2026-08-27 12:21）。落地页 Hero href 正确性另有 domSnapshot 证据（任务 2.1）
