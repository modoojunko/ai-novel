## 1. CI：转存 + latest.json，bump PR 退役（client-package.yml）

- [x] 1.1 release job
  - 证据：YAML safe_load OK；`tcb hosting deploy` 上传 + HEAD content-length 比对（6 次重试容错 CDN 就绪延迟）+ latest.json 内容断言；本地已同款手工上传并实测 www 直链 200/字节数一致 新增「转存资产到静态托管」步骤：tcb API key 登录 → 上传两份安装包到 `download/v<VER>/` → 上传 `download/latest.json`（内容 `{"version":"x.y"}`）→ HEAD/GET 校验两包存在且字节数与 GitHub 资产一致、latest.json 内容断言，任一失败 exit 1。验证：YAML safe_load 通过；dry-run 自查 sed/变量拼接
- [x] 1.2 删除
  - 证据：workflow 权限回退为 `contents: write`；bump 步骤整段移除；**附带收益：Actions「允许开 PR」控制台待办作废**「Open landing version bump PR」步骤及其 `pull-requests: write` 权限（机制被 latest.json 取代）。验证：grep 无 bump-landing 残留
- [x] 1.3 静态托管缓存规则
  - 证据：实测 www 域名不走托管自定义域配置（HTTP 访问服务网关型，domainStatus 报「账号下无此域名」）——缓存规则 API 无落点；改为「CI 写后即时内容断言（1.1 已含）+ 浏览器 fetch cache:no-store」保障正确性，4.1 验收时实测更新传播；如发现中间层缓存延迟再升级处理：`download/latest.json` 不缓存、`download/v*/` 长缓存。验证：配置后 curl latest.json 响应头无长 max-age（API 通路不通则控制台手配并在任务下注明）

## 2. 前端：版本事实源迁移 + 下载弹窗（S端）

- [x] 2.1 `client-release.ts`
  - 证据：实现为 `fetchLatestRelease()`（返回 `{version, degraded}`，版本号正则校验）+ `windowsInstallerUrl()/macosInstallerUrl()` 模板；`FALLBACK_VERSION` 兜底；build（含 vue-tsc）通过 改造：新增 `fetchLatestVersion()`（同源 GET `/download/latest.json`，超时兜底）与版本化 URL 模板函数；`LATEST_CLIENT_VERSION` 常量降级为兜底并注释其新语义。验证：vue-tsc 通过
- [x] 2.2 `HeroSection.vue`
  - 证据：本地截图+快照双验证——成功态 info pill「最新版 v0.11」且两 href=`…/download/v0.11/AI_Novel_Setup_v0.11.exe`、`…/AI_Novel_mac_v0.11.dmg`；登录态 `v-if` 分支逐字未动：未登录态回归单主按钮「免费下载」→ 复用 AppModal 打开下载弹窗；弹窗三态（LoadingSkeleton / info pill 成功 / warn pill 降级）按 `design/ui-spec.md` 实现；副行去掉版本号字样；登录态不动。验证：domSnapshot 弹窗内两平台按钮 href 为 `www.awesomenovel.com/download/v<N>/…` 且 `<N>` 与 pill 一致
- [x] 2.3 弹窗无障碍基线
  - 证据：AppModal 组件原生提供（Esc/Tab 焦点圈/关闭还原焦点/Teleport 到 body），零额外代码：Esc/遮罩关闭、焦点落主按钮、关闭后还原。验证：代码 review + 手测
- [x] 2.4 原型对照
  - 证据：`modal-loading.png`（骨架+「正在获取最新版本…」）、`modal-success.png`（info pill + 双平台直链）、`modal-degraded.png`（warn pill）——布局/文案/语气与原型一致：实现后本地截三态截图归档 `screenshots/`，与 `design/modal-prototype.html` 对照。验证：三张截图存在且与原型一致

## 3. 门禁与合入

- [x] 3.1 S端 门禁
  - 证据：lint 48 文件存量 0（exit 0）；build built in 903ms（exit 0）：`npm run design:lint` + `npm run build`（含 vue-tsc）全绿。验证：退出码 0
- [x] 3.2 开 PR 到 main
  - 证据：PR #214 全绿（双平台打包 pass、release skipping=PR 不对外发布实证）后合入（8b86352）；用户工作区 4 个未提交文件未夹带（只圈 workflow、HeroSection、client-release.ts、本 change 工件；不夹带工作区既有未提交文件），CI 绿后合入。验证：PR Files changed 核对
- [x] 3.3 合入后 MCP 手写
  - 证据：MCP 上传 download/latest.json=`{"version":"0.11"}` 成功，GET www 返回 {"version":"0.11"} `download/latest.json`=`{"version":"0.11"}`（v0.11 资产已在托管）。验证：GET latest.json 返回 0.11

## 4. 线上验收

- [x] 4.1 线上落地页实测
  - 证据：线上 DOM 快照：弹窗 info pill「最新版 v0.11」，两按钮 href=`www.awesomenovel.com/download/v0.11/…`；exe 字节数 29,671,299 与 GitHub v0.11 资产一致（此前直链实测已核）；截图 live-modal-success.png：点「免费下载」弹窗渲染 v0.11 + 双平台按钮；下载两包字节数与 GitHub v0.11 资产一致。验证：DOM 快照 + 字节比对
- [x] 4.2 弹窗降级态抽查
  - 证据：线上临时删除 latest.json → 弹窗 warn pill「未能获取最新版，当前 v0.11」且双平台可正常下载（截图 live-modal-degraded.png）→ 已复原并实测写后即刻生效（无中间层缓存延迟，1.3 的缓存担忧实测排除）（阻断 latest.json 请求模拟失败）→ warn pill + 兜底可下。验证：截图/快照留档
- [x] 4.3 发版 SOP 收口
  - 证据：记忆已更新：发版=打 tag 全自动（GitHub Release+托管转存+latest.json），零人工；bump PR 与「Actions 开 PR」控制台待办均作废：记忆与 design 更新为"打 tag 即完事"；确认「Actions 开 PR」控制台待办作废。验证：记忆文件已更新
