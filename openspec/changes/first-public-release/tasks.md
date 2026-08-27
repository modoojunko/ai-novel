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
- [ ] 3.2 开 PR 到 main：只圈定本变更文件（`.github/workflows/client-package.yml`、两个 landing 组件、`openspec/changes/first-public-release/`），不夹带工作区既有的 `openspec/config.yaml` 与 `specs/design-system/spec.md` 未提交改动。验证：PR Files changed 清单逐项核对
- [x] 3.3 本地起 S端 dev server 截落地页 Hero + 激活指引对照图，归档至 `openspec/changes/first-public-release/`（纯 S端 免原型的证据要求）。验证：change 目录存在截图文件
  - 证据：`screenshots/landing-hero.png`（1280×900 视口，Hero 按钮与书架 mock）+ `screenshots/landing-guide.png`（锚点直达 #guide，三步指引含新双平台文案）

## 4. v1.0 首发（依赖 1–3 全部完成且 main 绿）

- [ ] 4.1 在 main 最新 commit（已含 1.x 修复）上打标签并推送（`git tag v1.0` + 推送该 tag），跟踪 Actions 至 macos/windows 双 job 绿。验证：`gh run list --workflow=client-package.yml` 最新 tag run 为 success
- [ ] 4.2 验收 Release 资产：`gh release view v1.0` 含四资产（两带版本号原件 + 两固定名副本）。验证：命令输出的 assets 列表逐一核对
- [ ] 4.3 验收稳定直链与入口闭环：`curl -sIL https://github.com/modoojunko/ai-novel/releases/latest/download/AI-Novel-Setup-Windows.exe` 返回 302 且 content-length > 0（dmg 同理）；浏览器实测落地页 Hero 按钮跳转 Releases 页非 404。验证：两条命令输出 + 截图留档
