## 1. 改前证据准备（S端免原型，以截图对照替代）

- [x] 1.1 截取 S端 改前基线图入 change 目录 `evidence/before/`：控制台授权卡 + 设备卡（含 `.b` 徽标、`.strip` 提示条）、认证页（登录或注册，含表单提示条）。验证：图片存在且徽标/提示条清晰可辨，路径记入本任务下方
  - 证据：`evidence/before/` 5 张（dashboard-home / dashboard-activate-strip / login-strip-info / register-page / auth-success），目检徽标与提示条清晰可辨（临时截图 spec 用完即删）

## 2. PR1 · P0 机械令牌批（共享段镜像 + M1 基线）

- [x] 2.1 两端 `src/design/base.css` 的 `:root` 令牌表新增 `--on-accent: oklch(100% 0 0)`（design D3）。验证：grep 两端各命中 1 处定义
  - 证据：grep 双端 base.css `--on-accent: oklch(100% 0 0)` 各 1 处 ✓（共享段内）
- [x] 2.2 S端替换 4 处反白冒充为 `var(--on-accent)`：`server/frontend/src/design/base.css` 的 `.btn-primary`/`.btn-danger`/`.logo-mark`/`.toast`（现 50/56/70/106 行）。验证：grep base.css 中 accent/深底背景类无残留 `color: var(--surface)`；按钮与 toast 截图无视觉变化
  - 证据：base.css 段内 .btn-primary/.btn-danger/.logo-mark/.toast 均已 var(--on-accent)；S端 e2e + 截图目检按钮/toast 视觉无变化（--on-accent=纯白=原 --surface 值，语义修正零视觉差）
- [x] 2.3 S端骨架屏取值归一：`sk-pulse` 谷值 0.55 → 0.45（base.css:182）。验证：grep 确认 0.45；LoadingSkeleton 与 DownloadModal 渲染正常
  - 证据：sk-pulse 谷值 0.45；LoadingSkeleton/DownloadModal e2e 场景通过
- [x] 2.4 两端 base.css 打 `@cross-begin/@cross-end` 标记并把共享段收拢到 design D2 清单：令牌全表（含 `--on-accent`）、`.btn` 家族、appbar/modal/表单基座、toast（含 `.toast.warn`）、`.seg`/`.pref-row`/`.empty` 基座 + 动作槽两条、`.pill` 家族、`.notice` 显式四语气、`.sk(+sk-pulse@0.45)`、`.panel(+hoverable/hl/compact)`、表单错误态 `.f-err/.f-hint/.input-wrap/.has-err`、`.spin/.lnk/.num`；C端镜像仅增量定义，不动任何 C端 本地既有同名定义（design D2 过渡策略）。验证：两端标记段文本逐字相同；C端 list.css 裸 `.notice` 与 model-config.css 局部 `.panel` 原地保留
  - 证据：两端 base.css @cross 段逐字相同（design:cross 零差异）；C端 list.css 裸 .notice 与 model-config.css 局部 .panel 原地保留。缓收编偏差：.notice 四语气、.panel 家族、.empty svg/.btn 三族本轮不入段——实测共享段取值会在 C端 新增 color/gap 等本地未定义属性引起像素漂移（design Risks 首条预案），留 C端 批次收编后再入段；S端侧三者放本地段，契约不变
- [x] 2.5 新建仓库根 `scripts/design-cross.mjs`（design D6 口径：截段、空白规范化、strict 相等、退出码 1 并报首处分歧行号；M2 图标断言留 TODO）＋ 两端 package.json 各加 `"design:cross": "node ../../scripts/design-cross.mjs"`（路径按 script 运行目录核准）。验证：脚本对基线输出零差异；人为单端改动段内一个字符后退出码 1 并指认行号（验证后还原）
  - 证据：scripts/design-cross.mjs 落仓库根；两端 package.json 各加 design:cross 并双向跑通零差异；负向验证：段内注入 .pill{gap:6px} 单端改动 → exit 1 并指认「段内第 2 行」两侧内容（验证后还原）
- [x] 2.6 PR1 门禁回归（config.yaml 口径）：双端 `npm run design:lint` + `npm run design:cross` 绿；C端 `npm run design:check` 全场景 <0.2%；`vue-tsc --noEmit` + `tsc --noEmit` 绿；S端 playwright PR CI 照跑。验证：各命令输出摘录贴在本任务下方；`design:check` 若 >0.2% 按 design Risks 首条处置（该族暂不入段）
  - 证据：S端 design:lint exit 0；C端 design:lint exit 0；design:cross 双端零差异；C端 design:check 2 场景全绿（books/empty，像素零漂移）；vue-tsc --noEmit 绿；tsc --noEmit 绿；S端 e2e 86/86（首跑 1 例并发抖动、单跑与复跑全绿）

## 3. PR2 · P1 语义收编批（S端调用点改名）

- [x] 3.1 S端 12 处 `.b` 调用按 design D4 映射表替换为 `.pill` 角色×语气：DeviceCard(2)/LicenseCard(2)/AuthPage(2)/RegisterPage(1)/AccountPage(1)/LicensePage(2)/DashboardLayout(1)/RoadmapSection(1)；三处裸 `.b`（DeviceCard:67/AccountPage:49/DashboardLayout:45）按内容定档并把终值回填 PR 描述。验证：`grep -rn 'class="b' server/frontend/src` 零命中；各页面徽标渲染与改前同语义（ok 绿/err 红不变）
  - 证据：18 处编辑（12 徽标 + 3 组动态 cls 计算改发 pill-ok/pill-warn/中性空串）；grep `class="b` 零残留（余下命中为 btn/循环变量/brand 误报）；裸 `.b` 三处定档：DeviceCard:67→pill-status、AccountPage:49→pill-status、DashboardLayout:45→pill-status
- [x] 3.2 删除 S端 base.css 的 `.b` 基类定义（现 123-127 行一带）。验证：grep 无 `.b` 选择器残留；控制台页面无样式回退
  - 证据：base.css 本地段 .b 五行删除；S端 e2e 86/86 无样式回退
- [x] 3.3 S端 6 文件 `.strip` → `.notice` 全量替换（语气修饰不变）：ActivateCodeForm/ChangePasswordForm/SecurityForm/LoginPage/RegisterPage/AuthPage。验证：`grep -rn strip server/frontend/src --include='*.vue'` 零命中；激活表单错误条、改密成功条渲染正常
  - 证据：13 处 strip→notice（6 文件，语气修饰不变）；grep strip 零残留
- [x] 3.4 删除 `server/frontend/src/design/dashboard.css` 的 `.strip` 定义段（现 18-23 行）及自述「过渡期」头注释（第 4 行）的失效表述；布局性 margin 归属按 design D7 裁定。验证：dashboard.css 无 strip；四语气提示条渲染与改前一致
  - 证据：dashboard.css .strip 段更名 .notice（取值含 margin 原地保留，D7）；激活失败/改密成功等提示条 e2e 场景通过
- [x] 3.5 两端 `scripts/design-vocab.mjs` 同批新增 `.b`/`.strip` 退役禁令（design D8 锚定写法，防误伤 HeroSection `b.on` 绑定；两端表达式逐字相同）。验证：双端 design:lint 绿；人为在 S端 临时加回 `class="b"` 能被 lint 拦截（验证后还原）
  - 证据：两端 vocab 表达式同源写入 retiredClassRegex=/^(?:b|strip)$/；**偏差登记：C端 本轮暂缓启用**——C端 自持 .b 存量（NovelListPage:287 `b ${stage}` 与 3 个原型），现在启用会打红 C端 门禁，归 C端 批次同批启用；S端 启用后负向验证：回植 class="b" → exit 1（还原后 exit 0）；S端 HeroSection 循环变量 b→bk 消除撞名误报
- [x] 3.6 截取 S端 改后对照图入 `evidence/after/`（与 1.1 同机位同状态）。验证：before/after 成对入 change 目录，PR 描述引用路径
  - 证据：evidence/after/ 5 张与 before 同机位成对（pill 描边胶囊 + notice 四语气），PR 描述引用
- [x] 3.7 PR2 门禁回归：同 2.6 全套（双端 lint/cross、C端 check <0.2%、双端 tsc、S端 e2e）＋ 仓库根 `openspec validate --all`。验证：输出摘录贴本任务下方，validate 相比基线 20 passed 只增不破
  - 证据：design:cross 零差异；S端 design:lint（含退役禁令）exit 0；vue-tsc 绿；S端 e2e 86/86；C端 lint exit 0；C端 design:check 2 场景全绿；C端 tsc 绿；openspec validate --all 22 passed（基线 20 + 本 change 2）

## 4. 收尾与登记

- [ ] 4.1 更新 `docs/ux/handoff.md` backlog：P0/P1 标注 S端侧已完成（保留 C端侧与 M2/M3 挂账）；`docs/ux/cross-end.html` §三漂移表给已收敛的 S端侧条目加完成标注（#1 徽标 S端侧、#2 提示条 S端侧、#4 骨架、#5 面板入段、#7 on-accent S端侧、#8 空态槽入段、M1）。验证：文档 diff 可读、无与现状矛盾的表述
- [ ] 4.2 按 openspec 归档流程收尾（sync specs → validate → 归档 PR，勿 `git add openspec/` 整目录）。验证：archive 后 `openspec validate --all` 全绿
