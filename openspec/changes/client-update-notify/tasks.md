# Tasks: client-update-notify

## 1. 原型先行（硬流程：C端 用户可见改动）

- [x] 1.1 在 `docs/design-c/prototypes/list.html` 书架屏顶部加更新提示条原型：info 语气 notice（发现新版本 vX.Y + 摘要一句 + 主按钮「去下载」+ 次级「查看更新内容」+ 关闭钮），复用 `.notice` 家族不新增基础类；在 `prototypes/ADJUSTMENTS.md` 登记条目。验证=原型浏览器目检 + 登记条目存在（ADJUSTMENTS #15；截图 /tmp/proto-list-update.png 目检通过：居中 1080px、三按钮、无溢出）
- [x] 1.2 在 `docs/design-c/prototypes/book.html` 定稿工作台沉浸模式下的提示条呈现（间距/收窄方案），同样在 ADJUSTMENTS.md 登记。验证=原型目检 + 登记（ADJUSTMENTS #15；截图 /tmp/proto-book-update.png：全宽贴边 12/16px、appbar 之上，正常）

## 2. 发版链扩展（CI）

- [x] 2.1 `client-package.yml` Generate release.json 步骤烘入三键：`client_version`（tag→去 v 版本号；PR/手动→`dev`）、`client_update_url`（Variable `CLIENT_DOWNLOAD_BASE`，默认 `https://www.awesomenovel.com/download/latest.json`）、`client_update_url_fallback`（Variable `CLIENT_DOWNLOAD_BASE_FALLBACK`，默认 `https://ai-novel-test-d1ghsr86ra814c12c-1468883265.tcloudbaseapp.com/download/latest.json`）；冒烟断言扩为三键 + https 前缀校验。验证=本地对 tag/PR 两种输入 dry 跑生成脚本：tag→`"client_version":"0.13"`、PR→`"dev"`，三键 https 断言通过；断言 python 段同 workflow 原文跑通（/tmp/cig/release.json）
- [x] 2.2 `client-package.yml` Publish 步骤：生成 `notes.html`（内容优先级 tag 附注 → `git log <上版 tag>..<本版> --oneline` 摘要 → 通用兜底文案；页面含版本号、更新内容、双平台版本化直链、回首页链接）转存 `download/v<VER>/notes.html`；latest.json 写 `version` + `notes`（附注首行，无附注省略）；发版校验追加 notes.html 直链 200 + latest.json 内容比对（带 6 次重试）。验证=从 workflow YAML 抽出 heredoc 实跑三级来源：①附注→latest 带 notes 首行+全文进页 ②提交摘要→latest 无 notes 键 ③兜底→仅 version；notes.html 直链/标题断言通过；YAML safe_load 解析通过（/tmp/cig/notes.html + latest.json）

## 3. C端 后端

- [x] 3.1 `client/backend/config.py`：`RELEASE_OVERRIDE_KEYS`/`load_release_overrides` 收三新键（版本键按只读值暴露，不设环境变量语义），提供版本读取入口；`pywebview_app.py` 无需新逻辑（键随既有 release.json 透传）。验证=pytest：release.json 缺失/损坏/键空时回退 `dev`（tests/test_config_release.py 新增 `test_client_update_keys_roundtrip`；pywebview_app 增 CLIENT_VERSION/CLIENT_UPDATE_URL(_FALLBACK) 三条 _env_with_release 透传）
- [x] 3.2 新路由 `GET /api/update-check` + dismiss 记录端点：dev 跳过、1 小时节流（`data/update-check.json`）、出站校验（https + 可信域集合 + DNS→IP 复核拒私网/环回/保留）、主域失败切兜底、数值段版本比较、`has_update` 含 dismissed 记忆。验证=pytest 新用例全绿（覆盖：dev 跳过零外呼/节流吃缓存+到期重查/失败静默且占节流窗/状态文件损坏容忍/0.10.1<0.11 与相等不提示/非法版本拒/非 https 拒/私网+环回解析拒、公网过/主域失败切兜底、兜底同过校验、全败返 None/关闭记忆按版本、新版重弹/GET dev 载荷/dismiss 往返/非法版本 422）
- [x] 3.3 容器内全量 pytest 回归。验证=443 passed（13.3s，临时容器 docker cp 源码 + pip pytest；修一处真 bug：失败后空 cached 误判未检测致节流失效，改为只看 last_check_at）

## 4. C端 前端

- [x] 4.1 `UpdateNotice` 组件（读 `/api/update-check`、~15 分钟轮询、渲染 notice、关闭调 dismiss、主/次动作 `window.open` 外链）挂载 `ClientShell`；api client 增调用。验证=vitest 组件测试 4/4（有更新渲染两动作+去下载 window.open 参数/无更新+检测失败不渲染/知道了调 dismiss 且立即消失/工作台沉浸与书架居中变体类名）+ `tsc --noEmit` 0 错误
- [x] 4.2 C端 e2e：mock `/api/update-check` 三态（有更新含摘要、无更新、失败）+ 关闭后同版本不再弹。验证=e2e/update-notice.spec.ts 3/3 绿（含「去下载」弹新页 URL 断言 + dismiss 载荷按版本）；三份 parity 规格补 `stubUpdateNotice`（list/book=update 同文案、config=none），parity 10/11 绿——book settings 场景 0.652% 超标为**存量漂移**（隔离实验：双侧去提示条后仍 0.633%，本改动仅贡献 ~0.02%），需另行立项排查

## 5. 外链行为与回归收尾

- [x] 5.1 pywebview 外链实测：**源码级验证 + 锚点化改造**。pywebview 6.1 wheel 反查：`OPEN_EXTERNAL_LINKS_IN_BROWSER: True` 为默认（settings dict），cocoa.py `webView_createWebViewWithConfiguration…`（target=_blank / LinkActivated）与 edgechromium.py `NewWindowRequested` 均走 `webbrowser.open` 系统浏览器；但 cocoa 分支要求 navigationType==LinkActivated，**编程式 `window.open`（type=Other）不保证触发** → 组件外链改用 `<a target="_blank" rel="noopener noreferrer" class="btn …">`（NovelListPage upgradeBtn 同款先例），vitest 改断言锚点 href/target/rel，e2e 弹新页断言不变。物理双平台终验折叠进 v0.13 发版演练（打 tag → 装包 → 点「去下载」一次）；webbrowser.open 兜底端点经验证不需要，未实现。
- [x] 5.2 回归门禁全量（2026-08-29 实际输出）：
  - C端 `npm run design:lint`：exit 0（存量冻结观察，无新增违规；新文件无裸 hex/emoji/未登记档位）
  - C端 `npm run design:check`（DESIGN_PARITY=1）：list 4/4、config 1/1、book 5/6 绿；book.settings 0.652% 超阈为**存量漂移**（隔离实验：双侧去提示条仍 0.633%，本改动仅 +0.02%；期间顺手修 book.html `.btn-sm` 11px→12px 历史孤本对齐并登记 ADJUSTMENTS #15 追记，其余 5 场景因此由红转绿）
  - `tsc --noEmit`：0 错误
  - vitest：110/110（一次偶发失败为 #198 存量文件 `PromptManagementPage.singleCard.test.tsx` 时序 flake，不经过 ClientShell，复跑稳定）
  - 后端 pytest：443/443（容器内）
  - e2e 全量（docker 栈重建后）：60 过 0 挂（11 skipped=parity 未开 env）+ parity 单跑 10/11
  - 对照截图：docs/design-c/baselines/book.free.app.png（沉浸全宽条实拍）；原型侧 /tmp/proto-list-update.png、/tmp/proto-book-update.png；S端 零改动，由既有下载弹窗 e2e 在 PR CI 自然回归

## 6. Review 修复（PR #224 评审三项，2026-08-29）

- [x] 6.1 P2 同步 DNS 阻塞事件循环：`_validate_outbound_url` 改 async，解析走 `asyncio.get_running_loop().getaddrinfo`（内部线程池），本地服务不再有 DNS 挂起全应用冻结路径；校验类测试同步 async 化。验证=后端 pytest 444/444（容器内全量）
- [x] 6.2 P3 检测请求未 quiet：GET/POST 改走 `request(path, { quiet: true })`（api.get 不收 options），503 不再可能弹全局 toast，符合 spec「失败 MUST NOT 向用户呈现任何错误」；vitest 补 GET/POST quiet 断言，4/4 绿
- [x] 6.3 P3 推导链接取实际成功域：`_fetch_latest` 结果带 `source_url`，说明页/官网入口按实际成功的检测地址推导（主域坏配置靠兜底成功时不连坐）；新增 `test_derived_urls_follow_successful_source`。回归：vitest 4/4 + tsc 0 错 + e2e 全量 60 过 0 挂（镜像重建后）
