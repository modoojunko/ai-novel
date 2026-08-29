# 待办遗留（2026-08-29 · 品牌主题系统收官后）

> 本轮上下文：品牌定名爱小说/awesome-novel、爱字印标 + 用户可选主题（PR #221）、
> 保存冷启动自愈（PR #222）、v0.12 发版（新图标安装包已上线）。

## 高优先（建议尽快）

- [ ] **归档 theme-preferences change**
  实施与修复均已合入，openspec 归档流程未走（sync specs → design-system 与新 capability
  theme-preferences 入 `openspec/specs/`，纯文档 PR，勿 git add openspec/ 整目录）。
  触发方式：对话里说「归档」。

- [ ] **S端 FALLBACK_VERSION 常量 0.11 → 0.12**
  `server/frontend/src/constants/client-release.ts`。只是 latest.json 请求失败的降级兜底，
  线上无影响；**不要单独发**（会触发一轮 S端 部署，跨境上传大概率又要本机接力），
  随下一次 S端 改动顺手带上。

## 中优先（质量治理）

- [ ] **账号自助注销功能立项（要做，2026-08-29 拍板）**
  协议已承诺注销权（用户服务协议 §三.4 + 隐私政策），当前产品**无注销入口**，
  过渡口径=客服邮箱人工办理、15 个工作日完成；自助化是正式功能不是可选项
  （个保法要求必须提供注销途径）。范围要点：S端 注销 API（users 去标识化、
  device_grants 清理、**交易记录依法留存约 10 年**——P2 决策口径=保金额时间、
  抹身份关联）、C端 登录失效处理、注销前未消耗套餐按《退款政策》退款提示。
  完成后把 协议 §三.4 的"客服邮箱人工办理"改回"客户端内自助注销"。

- [ ] **dashboard-home e2e「激活失败显示错误」用例抖动治本**
  全量跑偶发红（8/28 当天 4 次全量闪 2 次，单跑恒绿、CI 绿）。模式：打开激活弹窗 →
  `input.type('short')` 输入 → 断言模态保持。疑似套件负载下输入/断言竞态，
  可改 `fill()` 或对 `.mcard` 加显式等待。文件：
  `server/frontend/e2e/tests/dashboard-home.spec.ts:48`。

- [ ] **e2e mock 主题白名单是手抄副本**
  `server/frontend/e2e/mocks/api-handlers.ts` 里 `known = [...]` 与后端
  `app/domain/identity/theme.py`、前端 `src/constants/themes.ts` 三处独立维护。
  扩主题时容易漏改 mock 导致 e2e 假红/假绿。改法：mock 从
  `import { THEME_OPTIONS } from '@/constants/themes'` 取（e2e 跑在 vite dev 下可解析别名）。

## 低优先（择机 / 观察项）

- [ ] **C端 主题接入立项**（计划内后续，非缺陷）
  契约已冻结（theme key 白名单 + `PUT /api/user/preferences`，C端 现有 token 直接可用）；
  C端 base.css 已预埋 `@cross` 覆盖层。新 change 需做：C端 拉取/缓存偏好（离线降级本地
  缓存）、设置界面主题选择 UI。扩主题时的三处同步纪律见
  `docs/ux/cross-end.html` 色相登记簿。

- [ ] **C端 e2e 定时 CI 观察（theme-preferences 任务 4.4 尾巴）**
  2026-08-29 起 cron 已降频为每日一次（`0 19 * * *` UTC，北京次日 03:00），
  有变更才跑；确认无 accent 相关回归即可销项。

- [ ] **本地废弃分支清理**
  `feat/s-brand-ink-restyle`（默认玄墨方向，已被 theme-preferences 取代）留在本地未推，
  确认无需回溯后可 `git branch -D feat/s-brand-ink-restyle`。

## docs/ux 设计原稿落地盘点（2026-08-29 逐条对照代码实测）

> 原稿 = `docs/ux/`（audit / design-language / components / cross-end / home 五份 HTML + uikit 七组件）。
> 注意：README/handoff 的进度小节滞后于代码（handoff 还写「C端侧未动工」、多处仍提已被裁撤的 .resume），以下为**实测终态**。

### ✅ 已落地

- **cross-end 全端一致性 · S端侧全清**（s-ui-alignment #218/#219）：P0 机械批 6 项全做（--on-accent 令牌、toast.warn 三档、.panel 上移、.sk 骨架、空态动作槽、@cross 标记 + `scripts/design-cross.mjs` 零差异基线）；P1 语义批 S端侧（.pill 家族 9 处、.notice 四语气 info/ok/warn/err 齐（dashboard.css:19-23）、strip 零残留、vocab retiredClassRegex）；OpenSpec 双端口径 + `/ux:design-brief` 命令。
- **C端批次一止血 #226**（c-ux-stopgap-batch1，已归档）：audit P0 #1（ContrastPreviewModal → --font-display）、#2（#/config）、#5（目标字数统一 DEFAULT_TARGET=2500，Rail.tsx:114 已引用）、#6（App.tsx:45 兜底路由）+ .sk 骨架收编（skeleton-pulse 已删净）。
- **C端批次二 启动首页改版**（#228-#234 已归档）：`/` 免登录静态首页（welcome 卡 + 玄墨三段式）+ 已登录自动跳 /novels + Navbar 未登录变体 + 升级入口 portal 直连（NovelListPage:166）。home.html 设计稿主体落地。
- **C端 书架三态 #237 + #238**：首启三步引导空态 + 满额锁定墙（audit P0 #3/#4 关账，免费额度=1 部口径对齐）；`.resume` 继续创作条上线当天被用户裁撤（#238：书架按 updated_at 倒序即「继续」入口）。
- **部分落地**：C端 @cross 标记已预埋（base.css 2 处）；.pill 基类定义已随共享段进 C端 base.css:135（但调用点未收编）；N6 的 .btn-danger 已用 --err+--on-accent（base.css:66）。

### ❌ 未落地

**C端批次三 · 语义收编（handoff §六 剩余主账，建议下一批）**

- [ ] 13 种自制胶囊归 .pill 三类×五语气；先修同名不同值：`.inv-chip` ×2（book.css:337 accent 版 vs model-config.css:86 err 版）、`.spin` ×2（book.css:172 vs model-config.css:65）
- [ ] .notice 补 .ok/.err——现 C端 list.css:50 仅 warn 裸类 + info 两档（S端已四语气）
- [ ] 表单错误态 .f-err/.f-hint/.has-err 启用——C端全站零使用，先落设定面板与模型配置两处
- [ ] window.confirm 收编 ConfirmGuard——现存 **7 处**（NovelWorkspace:69,103、HooksSettingForm:106、CharacterManager:121、ChapterWorkspace:313,386、SettingsView:112），比 audit 时 5 处还多
- [ ] C端 vocab 补 `retiredClassRegex=/^(?:b|strip)$/`（S端已先行，C端因自有 .b 存量暂缓）
- [ ] 上述收编完成后，缓收编三项移入 @cross 共享段：.notice 基座 / .panel 家族 / .empty 动作槽

**C端 P1 设计语言收口（README P1 剩余）**

- [ ] N6 destructive 归一：书卡菜单危险项仍 --warn（list.css:43-44），迁 --err 确立「红=不可逆」
- [ ] 右栏「规划中的能力」改一行折叠（Rail.tsx:102,217 两处静态段）
- [ ] focus-visible 扩面（现仅 2 处）+ 生成/保存态补 aria-live（仅 toast/UndoToast 有）
- [ ] 提示词页签免费态改「锁定可见」——✅ **2026-08-29 用户拍板：可见但不能用**，推翻 ai-prompt-crafting spec 的「免费隐藏」口径（ChapterWorkspace.tsx:524）。落地时：页签免费也渲染、点击弹升级引导；同批改 ai-prompt-crafting spec 与注释（:332「免费隐藏」）
- （dirty 守卫路线已选：NovelWorkspace:99 脏守卫 + confirm 拦截，弹窗收编并入批次三 confirm 项）

**C端 P2 令牌落地（README P2，配合 parity 流程）**

- [ ] 字号 22 档字面量 → 8 档命名令牌（--fs- 系不存在）
- [ ] radius 补 sm/pill；间距定 4pt 栅格统一 --field-gap；z-index 与 scrim 令牌化
- [ ] webfont 决策（悬置待拍板：Noto Serif SC 打包子集 vs 诚实回退栈；现状=回退栈字面量）

**P2 机制批（handoff §六）**

- [ ] M2 图标公共键断言并入 design-cross.mjs（现只有 TODO(M2) 注释，31 个公共键未断言）
- [ ] M3 两端 vocab 禁令抽共享模块或 hash 弱校验
- [ ] uikit 七组件正式收编 `src/components/ui/`（目录未建）

**P3 缺失业务面预留（五项全未做，随业务立项）**

- [ ] 剧情推演入口（工作台右栏「沙盘」模式，复用 AI 四形的流式/对话形）
- [ ] 导出备份入口（BookPrefsModal 加一行「导出备份 .zip」，对齐「数据只属于你」）
- [ ] 归档更新回路界面（B 期：连续性快照确认弹窗，diff 语言复用 VersionDiff；非会员降级文案照 PRD §9）
- [ ] 预览搜索/跳章（长篇通读 + 健康检查跳转目标容器）
- [ ] 离线提示条（notice 家族第五种语气：「本地可用 · AI 不可用」）

**S端 品牌遗留**

- [ ] AuthPage.vue brand-row 方标去除（#236 拍板「内容层纯文字字标」后全站唯一非合规点，留 S端下一批 UI 收编顺手做）

### ✅ 设计稿侧回写（2026-08-29 已完成）

- [x] home.html / README / handoff 的 `.resume` 描述已回写为「二次裁定裁撤，勿再实现」（书卡自携「继续创作」按钮属正确形态，保留）
- [x] handoff 完成度表 / §六进度段 / §七授权条目已更新为实测终态（C端止血批/首页/书架三态已收官，剩批次三/四）
- [x] README P0 清单已标注全部关账（#226 + #237）；P1 提示词页签已记入用户拍板（可见但不能用，落地时同批改 ai-prompt-crafting spec）

## 已知不修（记录在案，避免重复排查）

- **Actions 历史里两个红 X**（#221/#222 merge 时的 S端 自动发布 run）：当时跨境上传
  UserNetworkTooSlow，实际均已本机 staging 部署补上，终态正确；run 历史不可改，无需处理。
- **云托管每天首访冷启动 30-60s**：MinNum=0 成本拍板，登录链路有门闩+重试自愈，
  勿再提保温（[[cloudbase-cold-start-503]] 既定裁定）。
- **主题切换入口在「账户设置」页**：如后续觉得入口深，可挪控制台首页快捷卡/顶栏（用户未提需求，不动）。
