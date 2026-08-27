## 1. CI：固定名机制退场 + 发版自动 bump（client-package.yml）

- [x] 1.1 删除 release job 的「Copy stable-name duplicates」步骤；DMG 构建步骤输出名改为 `AI_Novel_mac_v$VERSION.dmg`（对齐 exe 的 v 前缀，installer.iss 已内置 v 无需动）。验证：YAML safe_load 通过；diff 确认无残留 `AI-Novel-Setup-Windows|macOS` 字面量；grep 确认 dmg 输出名含 `_v`
  - 证据：YAML OK；固定名字面量 grep 零命中；workflow L219 输出名 `AI_Novel_mac_v$VERSION.dmg`
- [x] 1.2 softprops `body:` 改写：去掉固定名直链说明，保留双平台、macOS 右键打开、Windows SmartScreen 提示，尾部加「发布后请合入自动生成的落地页版本号 bump PR」提醒。验证：diff review 文案无内部术语
  - 证据：body 四行均为用户/运维视角说明
- [x] 1.3 新增「Open landing version bump PR」步骤（仅 tag 触发）：checkout → sed 改 `server/frontend/src/constants/client-release.ts` 版本号 → `gh pr create`（标题含新版本号）。验证：YAML 解析 + 本地 dry-run 逻辑自查（TAG→版本号剥离、sed 表达式命中常量行）
  - 证据：步骤含常量文件缺失 guard（warning+exit 0）、`checkout -B origin/main`（避免 tag 落后 main 的脏 diff）、diff-quiet 幂等（已同版则跳过开 PR）；sed 表达式与常量行逐字匹配已核对

## 2. 落地页：版本常量 + 双平台直下载按钮（S端）

- [x] 2.1 新增 `server/frontend/src/config/latestClientVersion.ts`：`LATEST_CLIENT_VERSION = '0.1'`，并集中封装两个平台的资产文件名拼接（双平台统一 `v` 前缀，见 design D2）。验证：tsc 通过；单一导出被按钮与副行共同引用
  - 证据：实际落点 `src/constants/client-release.ts`（遵循仓库既有 constants/ 单一事实源惯例，如 site-beian.ts；tasks 原写 config/ 路径作废以此为准）；build（含 vue-tsc）通过
- [x] 2.2 `HeroSection.vue` 未登录态按钮组：`下载 Windows 版`（primary）+ `下载 macOS 版`（secondary 同尺寸），href 为版本化直链（dmg 文件名 `AI_Novel_mac_v0.1.dmg`）；新增「其他版本 →」次级链接指向 Releases 页；副行「v{常量} · 支持 Windows 与 macOS · 注册即送 7 天试用」。验证：domSnapshot 见两 link href 含 `releases/download/v0.1/` 且文件名与常量拼接一致
  - 证据：domSnapshot 两 link href 分别为 `…/download/v0.1/AI_Novel_Setup_v0.1.exe`、`…/download/v0.1/AI_Novel_mac_v0.1.dmg`；「其他版本 →」指向 `…/releases`；按钮图标统一 P.download（.btn 内建 flex+gap+svg 尺寸）
- [x] 2.3 登录态分支不动（仍单按钮进入控制台）。验证：代码 review + 登录态截图
  - 证据：`v-if="session.isLoggedIn"` 分支逐字未动；登录态截图本地无法产出（S端 后端依赖云端 PG），改由 4.2 线上验收覆盖

## 3. 门禁与证据

- [x] 3.1 S端 门禁：`npm run design:lint` + `npm run build`（含 vue-tsc）全绿。验证：两命令退出码 0
  - 证据：design:lint 48 文件存量 0（exit 0）；build built in 575ms（exit 0）
- [ ] 3.2 本地 dev server 截图：未登录态 Hero（双按钮+版本副行）+ 登录态 Hero，归档 change 目录 `screenshots/`。验证：两张截图存在且与设计一致
  - 部分：未登录态已归档（`screenshots/hero-dual-platform.png`）；登录态截图未产出（本地无 S端 后端、线上未注册测试号），以代码路径复核 + 4.2 线上验收替代——是否补拍待用户拍板

## 4. 合入与线上验收

- [x] 4.1 开 PR 到 main（只圈 HeroSection、版本常量、workflow、本 change 工件；不夹带工作区既有未提交文件），CI 绿后合入。验证：PR Files changed 清单核对
  - 证据：PR #211 全绿（双平台打包 pass、release skipping 即「PR 不对外发布」实证）后合入（1feb8e9）；用户工作区 4 个未提交文件（config.yaml、design-system spec、client/frontend 两个 design 脚本）均未夹带
- [x] 4.2 合入后线上抽查：S端 自动部署完成后，用云端 webReader 抓 `www` 落地页确认双按钮、版本化直链与版本副行上线；gh api 核对按钮目标资产在 v0.1 Release 上真实存在。验证：抓取输出含「下载 macOS 版」与 `v0.1`；gh api 资产列表匹配
  - 证据：实测以 v0.11 全链路演练——tag v0.11 → run 33077078593 双平台 build 绿 → Release v0.11 两资产 `AI_Novel_Setup_v0.11.exe` / `AI_Novel_mac_v0.11.dmg`（gh api 核对）→ bump PR #212 合入（4c373bc）→ S端 部署 run success → 线上 www DOM 快照：两按钮 href 与 v0.11 资产逐字一致、副行 v0.11。**事故与修复**：① bump 步骤首跑失败——仓库 Actions 默认禁止 GITHUB_TOKEN 开 PR，需控制台打开开关（待用户操作），本次由人工补开 PR #212；② v0.1 存量 Release 启用不可变保护，资产改名 API 被拒（422），按用户拍板 v0.1 不动，macOS 按钮 v0.1 指向缺资产的窗口由 v0.11 上线收口
