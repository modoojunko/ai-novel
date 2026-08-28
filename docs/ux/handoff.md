# Handoff · 设计一致性治理（→ 产品经理 agent）

> 本文件是设计侧 → 产品经理 agent 的工作移交入口。接手会话先读本文，再按「六、待办 backlog」继续。
> 最后更新：2026-08-27
> 与根目录 `../../handoff.md` 的分工：那里记全项目进度，这里只管「全端视觉一致性治理」这一条线。

## 一、你接手的是什么（30 秒读完）

产品是单用户桌面 AI 小说应用「爱小说」，双前端：C端 `client/frontend`（React 19）、S端 `server/frontend`（Vue 3）。既定目标：**除白名单场景外，两端绝大多数组件共用一套视觉基因**；差异必须可枚举、可登记、可被门禁拦截。

当前完成度（均已完成，勿重做）：

| 层 | 状态 |
| --- | --- |
| 地基 | ✅ 两端 `src/design/base.css` 令牌段与按钮/弹窗/表单/toast 基础类逐字相同（约 80%，人工比对核实） |
| 方案 | ✅ 三层契约模型 + 8 处漂移裁决 + 迁移映射表 + 仲裁规则（`cross-end.html`） |
| 候选组件 | ✅ `uikit/` 七个可搬运实现，语气词表已改齐 info/ok/warn/err |
| 工作流 | ✅ OpenSpec 双端口径（config.yaml context/rules + design-system 六条 Requirement，validate 20 passed）；`/ux:design-brief <change-id>` 双 harness 命令 |
| 实施 | ❌ **P0/P1 批次未动工**；M1–M3 校验脚本未建 ← 这就是你要推进的部分 |

✅ 版本管理：docs 设计标准自 **#216**（2026-08-28）起入库，`.gitignore` 收窄为 `docs/design-c/`。本目录改动会被 git 跟踪，**随手提交**；唯一仍在本地的是 design-c 运行资产（parity 原型与比对 PNG）。

## 二、事实源地图（做任何判断之前先查，禁止凭记忆）

优先级从高到低，冲突以靠前者为准：

| 文件 | 内容 | 什么时候读 |
| --- | --- | --- |
| **标准（唯一权威，全站适用）** | [`design-language.html`](./design-language.html) 规范正文 ＋ [`cross-end.html`](./cross-end.html) 一致性裁决 ＋ [uikit/](./uikit/) 候选实现 | 判断任何视觉问题的最终依据 |
| `client/frontend/scripts/design-vocab.mjs` ＋ `server/frontend/scripts/design-vocab.mjs` | 两端机器可读词汇白名单，禁令表达式同源，由上一行的标准派生 | 任何词汇/档位判定 |
| `docs/design-c/prototypes/*.html` + `prototypes/ADJUSTMENTS.md` | C端像素 parity 基线 + 偏差登记簿（运行资产，不承载标准） | 动 C端界面之前 |
| `docs/ux/cross-end.html` | 三层契约 / 8 处漂移裁决 / 迁移映射表 / 仲裁规则 | 所有跨端命名与取值分歧 |
| `docs/ux/design-language.html` | §5 状态语言总表 / §13 文案术语表 | 写文案、定对象状态 |
| `docs/ux/components.html` + `uikit/`（其 README 有 API 速查与搬运四步） | 候选组件实物演示与调用方式 | 选组件之前 |
| `openspec/config.yaml` + `openspec/specs/design-system/spec.md` | 双端口径的工作流注入（6 条 Requirement） | 提 change 之前 |

## 三、你的日常动作（一个需求进来怎么走）

1. **三问路由**：
   - 动哪一端？（决定门禁组合与要不要截图证据）
   - 是否触碰共享段？（base.css 令牌与基础组件类、pill/notice/sk/panel/f-err 家族、图标公共键 → 必须双端成对改）
   - 机械收编还是视觉决策？（换既有类名/归档字面量=前者；新状态/新组件/几何变动=后者）
2. **提 change**：`/opsx:propose` 会自动要求「## Design Impact」段（受影响端＋屏清单＋对象状态＋是否触共享段＋谁出设计工件）；tasks 自动带「原型先行」首任务与门禁回归小节——这些来自 config.yaml 注入，不用你背。
3. **视觉决策**：跑 `/ux:design-brief <change-id>`，产出四样：原型增量＋ADJUSTMENTS 登记＋组件调用片段＋实施侧验收清单；它停在不动任何一端 `src/`。
4. **apply 后收集证据**：受影响端 `npm run design:lint` ＋ C端 `design:check`（各场景像素差 %）＋ 双端 tsc/vue-tsc ＋ 触共享段时的 design-cross 结论 ＋ 截图路径，追加在 tasks 对应 checkbox 下。
5. **archive 回填**：状态语义回填两端 vocab.mjs（同批）；核对标准正文 design-language.html 相应小节是否需要对齐；新/改共享类回填 cross-end.html 漂移表与映射表；核对两端图标公共键 path 未分叉。

## 四、裁决规则（遇到分歧自己判，不必回头问人）

- **仲裁规则**：两端取值不同且都合规 → 以受 parity 门禁约束的 C端 为准（改 C 成本高，永远向低成本一侧收敛）。S端想保留差异必须在 change 里登记理由，否则视为漂移缺陷。
- **语气词表全站唯一**：info / ok / warn / err。提示条用 `.notice.*`，徽标用 `.pill-*`，toast 允许 warn 档。`success/danger` 作为提示语气、`.b`、`.strip`、第四种胶囊形态一律不得回流（proposal 层就会被打回）。
- **白名单场景**（允许排版不同，不允许换令牌）：C端阅读工作台（book.css 密度/树）、S端落地营销页（hero 44px 已登记）、S端控制台数据面（keyline/瓦片密度）、认证流（居中窄幅）。原则：可以换组合，不能换基因。
- **N6 危险色纪律**：红 `--err` 只给不可逆/即时生效；其余警示一律 warn 或 accent。
- 文案过 §13：不说内部术语（门控/就绪度/SSE），按钮词是动词，补救句必带可点出口；空态至少一条主动出口。

## 五、红线（出现即打回）

1. C端改实现不先改原型/不登记 ADJUSTMENTS。
2. 词汇/档位改动只落一端 vocab.mjs、或改了 vocab 却没让标准正文 design-language.html 对齐。
3. 裸 hex/rgb、emoji 图形、词汇表外 opacity 档位与任意值。
4. 共享段只改一端就提交；新造第二套提示语气。
5. 原生 `window.confirm` 新增；删除级联不做盘点展示。
6. proposal 缺 Design Impact / tasks 缺门禁回归输出。

## 六、待办 backlog（按优先级，每条可直接转 openspec change）

### P0 · 机械令牌批（约半天，纯机械）

| # | 动作 | 落点 |
| --- | --- | --- |
| 1 | 新增 `--on-accent` 令牌并替换 8 处 `var(--surface)` 反白冒充 | client base.css:48,54,70,107 ＆ server base.css:50,56,70,106 |
| 2 | `.toast.warn svg` 第三档补进 C端 | client base.css:109 之后 |
| 3 | `.panel` 上移共享段、去自带 margin（间距归布局工具类），修饰 hoverable/hl/compact 全站可用 | server base.css:129-132,170-174 → 两端 base.css；删 client model-config.css:20 局部定义 |
| 4 | 骨架屏统一：认 `.sk` 原子，脉冲谷值取 C端 0.45、关键帧同名 sk-pulse；C端删 skeleton-pulse | client list.css:57-62 ＆ server base.css:180-182 |
| 5 | 空态动作槽两条规则上移（图标规格 + `.empty .btn` 外距） | server base.css:176-178 → 两端 base.css |
| 6 | 同批给共享段打 `@cross-begin/@cross-end` 标记 ＋ 写 `scripts/design-cross.mjs` 并建立零差异基线（脚本要点见 cross-end.html §六 M1） | 仓库根 scripts/ ＋ 两端 package.json 各加 `design:cross` |

验收：两端 `design:lint` ＋ `design:cross` 绿；C端 `design:check` <0.2%（涉及基线波动的先动原型并登记）；双端 tsc/vue-tsc 绿。

### P1 · 语义收编批（1–2 天）

| # | 动作 | 参考 |
| --- | --- | --- |
| 1 | `.pill` 家族收编：S端 6 个文件 `.b`→pill 改名；C端 13 种自制胶囊归三类（count/status/tag × 五语气） | `uikit/Pill.tsx` + components.html 映射表 |
| 2 | `.notice` 四语气：S端 strip→notice（6 文件）；C端补 `.ok/.err`（裸类=warn 仅存量兼容） | `uikit/Notice.tsx` + cross-end §3.2 |
| 3 | 表单错误态 C端启用：`.f-err/.f-hint/.has-err`，先落设定面板与模型配置最痛两处 | server base.css:159-168（已在 S端共享段内的直接复用） |

验收：同 P0 ＋ 相关 e2e 更新通过 ＋ S端前后截图对照入 change 目录。

### P2 · 机制完善批（随迭代）

- M2 图标断言并入 design-cross（两端注册表公共键 d 值逐一比对；现状 31 个公共键）。
- M3 两端 vocab 禁令抽共享模块或最低限度 hash 弱校验。
- uikit 候选正式收编 `src/components/ui/`（按 uikit/README 四步：原型→base.css 收编并删 book.css:97-100 原行→搬 tsx→迁调用点）。

### 独立改进点 · 启动主页重构（2026-08-28 立项）

设计稿 `docs/ux/home.html`（三态右下角可切：回访 / 首启 / 书架满额）。
裁定：`/` 即书架 home；App 内 Landing 整体摘除，营销内容唯一住在 S端 官网/下载页。

| # | 动作 | 落点 |
| --- | --- | --- |
| 1 | `/` 由 LandingPage 改 `<Navigate to="/novels" replace />`，删路由与 import | client `src/App.tsx` |
| 2 | 删 `pathname === "/"` 时 return null 的分支 | client `src/components/Navbar.tsx` |
| 3 | 升级入口改 S端 portal 直连（去掉 scroll-to-pricing 过渡跳转） | client `src/pages/NovelListPage.tsx:163` |
| 4 | 书架页新增 `.resume` 继续创作条（`updated_at` 最大者置顶）＋ 首启三步引导空态 ＋ 满额「锁定可见」 | `NovelListPage.tsx` ＋ `base.css` 共享段（`.resume` 先 ADJUSTMENTS 登记，双端同批） |
| 5 | 回归：design:lint ＋ design:check（书架既有基线不波动，新增态为非 parity 对象）＋ tsc ＋ 涉路由 e2e 更新 | 两端门禁 |

验收补一句：免费额度墙必须「锁定可见 + 升级出口」，不允许回到隐藏入口的老路。

## 七、悬而未决（需要用户拍板，别自作主张）

1. ✅ **已解决（#216，2026-08-28）**：docs 设计标准已入库。遗留子项：`docs/design-c/` 原型与 ADJUSTMENTS 是否也入库——现保持本地，代价是 fresh clone 上 parity 门禁静默跳过、换机器需重建。
2. **授权动 `src/`**：P0/P1 都是实现层改动；未授权前只能停在设计工件与登记层。
3. **design-cross.mjs 落位**：config.yaml/rules 引用的是仓库根 `scripts/design-cross.mjs`；若挪到别处须同步改 config.yaml 两处引用。
4. **webfont 决策**（audit P2 遗留）：Noto Serif SC 打包子集 or 诚实回退栈，影响打包体积与三端视觉终值。
5. **S端破坏性操作确认形态**：现网 S端 既无 window.confirm 也无确认组件；spec 要求删除级联用 in-app 弹窗＋inventory，S端首次遇到删除类需求时要按此立组件而不是图省事。

## 八、验收命令速查

```bash
cd client/frontend && npm run design:lint && npm run design:check && npx tsc --noEmit
cd server/frontend && npm run design:lint && npm run typecheck
node scripts/design-cross.mjs        # M1 落地前在回归小节写「cross 校验待建」
cd ../.. && openspec validate --all  # 当前基线：20 passed
# 文档健康：grep -rn 'success\|danger' docs/ux/uikit/*.{tsx,css} 应只命中 Confirm.tsx 的危险确认语境
```

## 九、踩过的坑（省你半小时）

- shell 的 cwd 在多次调用间可能漂移，跨目录命令一律用绝对路径、glob 记得加引号。
- `openspec/config.yaml` 的 rules 若某一项里出现半角冒号＋空格（如 `Modified: design-system`），YAML 会把该项解析成 dict 且静默忽略——要么整行加双引号，要么改用全角标点。
- 本仓存在双镜像：仓库 `docs/` ↔ OpenDesign Design Files 目录。规则是「哪边刚产出就以哪边为源覆盖另一边」；`openspec/` 曾出现配置被重置又恢复的现象，升级后务必 `git diff` 确认，退回 v1 时用 Design Files 的 `openspec-设计调度/` 原件覆盖回去。
- S端没有像素 parity 层，一致性证据=两端渲染截图对照，别去找不存在的 baseline 场景名。
