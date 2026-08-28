## Context

两端 `src/design/base.css` 的令牌与基础类已约 80% 逐字同源（人工比对核实，cross-end.html §二），但共享关系靠人肉复制维持，无任何机器校验。S端侧 5 处语义漂移与 1 处机制缺失的现状已在 proposal 列明（行号为 2026-08-28 实测：`.b` 8 文件 12 处、`.strip` 6 文件、`var(--surface)` 反白 base.css:50/56/70/106、`sk-pulse` 谷值 0.55 于 base.css:182）。设计裁决全部已定案（cross-end.html §三、handoff.md P0/P1 backlog），本设计只做「如何机械落地」的工程决策，不引入新视觉决策。

## Goals / Non-Goals

**Goals**

- S端页面词汇与全站统一：`.pill` 三角色×五语气、`.notice` 显式四语气，`.b`/`.strip` 从 S端源码消失且被 lint 禁止回流。
- 反白语义修正 + 骨架屏取值归一（`--on-accent` 新令牌；`sk-pulse` 谷值 0.45）。
- 共享段收拢并建立 M1 防漂移基线：`@cross` 标记 + `design-cross.mjs` 零差异校验进入两端门禁。
- C端零视觉变化（parity <0.2% 是硬门禁，也是本 change「镜像无副作用」的证明手段）。

**Non-Goals**

- C端调用点迁移（13 种胶囊归档、`toast.warn`/`skeleton-pulse`/局部 `.panel` 清理、`.f-err` 启用）——另行立项。
- M2 图标断言、M3 禁令共享模块（P2 机制批）。
- S端破坏性操作确认组件（现网无删除流，handoff 悬而未决 #5 不触发）。
- 白名单场景（landing hero 字阶、控制台数据密度、认证流窄幅）的任何排版调整。

## Decisions

### D1 · 单 change、两阶段 PR 切片

P0（机械令牌批：令牌 + 骨架取值 + 共享段标记 + 镜像 + cross 脚本建基线）一个 PR；P1（语义收编批：`.b`→`.pill`、`.strip`→`.notice`、vocab 禁令 + 截图证据）一个 PR。理由：共享段镜像（PR1）先落，PR2 的调用点改名才不会触碰共享段；两 PR 各自可独立回滚，且 PR1 合入后 cross 基线即开始拦截单端漂移。备选「单 PR 全量」被否：S端换装惯例是多 PR 小步（#191–#195），review 面更小。

### D2 · 共享段内容与两端同名冲突的隔离方式

共享段（`@cross-begin/@cross-end` 之间）收录：`:root` 令牌全表（含新增 `--on-accent`）、`.btn` 家族、appbar/modal/表单基座/toast（含 `.toast.warn`）、`.seg`/`.pref-row`/`.empty` 基座 + 动作槽两条、`.pill` 家族、`.notice` 四语气、`.sk(+sk-pulse@0.45)`、`.panel(+hoverable/hl/compact)`、`.spin/.lnk/.num`。对 C端 已有本地同名的两处采取「镜像照落、本地留存」过渡策略：

- `.notice`：C端 list.css 的裸 `.notice`（bare=warn 兼容缺省）保留原地；层叠顺序（页面 css 后于 base.css 加载）保证 C端存量两处调用渲染不变。
- `.panel`：C端 model-config.css 局部定义保留原地；若其声明与共享段存在差异，差异项渲染结果以本地为准，C端视觉不变。

两处本地定义的删除属 C端批次，不在本 change。S端侧同名旧词（`.b` 基类、`.strip` 段）在 P1 一并删除。

### D3 · `--on-accent` 取值与替换面

值取 `oklch(100% 0 0)`（cross-end §3.4 裁决）。S端替换 4 处（`.btn-primary`/`.btn-danger`/`.logo-mark`/`.toast`）；C端 :root 同批获得令牌定义（在共享段内），但 C端 4 处调用的替换留给 C端批次——本 change 不动 C端调用点，渲染零变化。

### D4 · `.pill` 角色映射表（12 处逐条裁定）

| 位置 | 现状 | 改后 | 裁定依据（cross-end §3.1） |
| --- | --- | --- | --- |
| DeviceCard「当前设备」 | `.b.muted` | `.pill-tag` | 标签性质，中性描边 |
| DeviceCard:67 裸 `.b` | `.b` | `.pill-tag`（若语义为状态则 `.pill-status`，实现时按上下文定档并在 PR 说明） | 裸语气无角色信息，按内容定性 |
| LicenseCard「有效期内」 | `.b.ok` | `.pill-status.ok` | 对象进度徽章 |
| LicenseCard「已过期」 | `.b.err` | `.pill-status.err` | 失败/拦截态 |
| AuthPage 套餐 tier | `.b.ok` | `.pill-status.ok` | 授权状态 |
| AuthPage 有效期 | `.b.muted.num` | `.pill-tag`（`.num` 保留并列） | 标签 + 等宽数字 |
| RegisterPage「注册即送 7 天试用」 | `.b.ok` | `.pill-status.ok`（或 `.pill-tag` + accent，按文案语气定档） | 营销提示标签 |
| AccountPage 裸 `.b` | `.b` | 同 DeviceCard 规则 | 同上 |
| LicensePage「套餐」 | `.b.muted` | `.pill-tag` | 标签 |
| LicensePage「已激活」 | `.b.ok` | `.pill-status.ok` | 授权状态 |
| DashboardLayout 裸 `.b` | `.b` | 同上规则 | 同上 |
| RoadmapSection「规划中」 | `.b.muted.plan-tag` | `.pill-tag`（`plan-tag` 业务类保留并列） | 标签 |

裸 `.b` 三处（DeviceCard:67 / AccountPage:49 / DashboardLayout:45）的最终角色在实现时按各自内容定档，映射表在 PR 描述里回填终值——这是本 change 唯一留白的视觉微决策，量级为单类名选择，不需要设计侧会话。

### D5 · `.strip` → `.notice` 纯更名

dashboard.css 的 `.strip` 四语气声明平移为共享段 `.notice.info/.ok/.warn/.err`（取值不变，仅 `margin: 0 0 14px` 这类布局性声明按 D7 归布局工具类或保留在段内取齐——以两端逐字相同为准绳，实现时取更简方案并在 PR 注明）。6 文件调用点 `strip`→`notice` 全量替换，语气修饰不变。备选「保留 strip 作为别名过渡」被否：词汇表禁令与 spec 都要求不回流，留别名只会延长双词并存期。

### D6 · `design-cross.mjs` 实现口径

Node 直跑、零依赖：读两端 base.css，截取 `@cross-begin`/`@cross-end` 之间文本，规范化空白（`\s+`→单空格、去行尾空白）后 strict 相等；不等则打印第一处分歧行号与两侧上下文、退出码 1。落位仓库根 `scripts/`（openspec/config.yaml 已引用此路径，挪位需同步改两处引用——handoff 悬而未决 #3）。M2 图标断言留 TODO 注释不实现。

### D7 · 布局性声明的归属原则

共享段内类只保留「基因」声明（色、边、圆角、字、内边距）；元素间距（margin）归调用方布局。唯一例外：S端 `.strip` 现有 `margin-bottom:14px` 已是 6 处调用点的既成排版，若剥离会引起 6 处间距回归，则将该行保留在段内（两端一致即可），不做「纯洁性」牺牲——一致性优先于洁癖。

### D8 · vocab 禁令的防误伤写法

两端 `design-vocab.mjs` 同批新增退役禁令：匹配 CSS 选择器形态 `.b`（`.b `、`.b.`、`.b{`、`.b:`、`"b"`/`'b'` 独立 class token）与 `.strip`。注意 HeroSection.vue:80 的 `class="{ on: b.on }"` 是循环变量绑定，裸 `\bb\b` 正则会误伤——禁令必须锚定 class 属性字符串或 CSS 选择器上下文。两端禁令表达式逐字相同（禁令本身也是契约）。

## Risks / Trade-offs

- [C端 `.notice`/`.panel` 镜像与本地定义层叠冲突导致 parity 波动] → 镜像 PR 必跑 `design:check` 全场景；任一场景 >0.2% 即停，回退该类入段（改放 S端本地区），待 C端批次收编后再入段。共享段允许「暂缺某一族」，cross 校验只比段内内容。
- [裸 `\bb\b` 禁令误伤 Vue 绑定表达式] → D8 锚定写法 + 两端 vocab 各自跑一次 design:lint 自证零误报。
- [PR1 建基线时段内含有 S端尚未启用的类（pill/notice tones），被误认为死代码删除] → base.css 头部注释与 `@cross` 标记注释写明「段内类可能先于本端调用点存在，删除须双端同议」。
- [e2e 假绿] → 已核实 S端 e2e 无 `.b`/`.strip` 选择器耦合（grep 零命中）；PR CI 照跑兜底，不新增断言负担。
- [S端截图证据流于形式] → tasks 明确截图清单：改前/改后各 2 张（控制台授权卡 + 认证页），入 change 目录 `evidence/`，PR 描述引用。

## Migration Plan

PR1（P0）：加令牌与共享段标记 → 镜像 C端 base.css → 删 S端 `.sk` 0.55 取值（改 0.45）→ 提交 `design-cross.mjs` + 两端 `design:cross` script 行 → 门禁全绿即建立零差异基线。PR2（P1）：S端调用点 `.b`→`.pill`（12 处）→ 删 `.b` 基类与 `.strip` 段 → `.strip`→`.notice`（6 文件）→ 两端 vocab 禁令 → 截图证据。回滚策略：两 PR 独立 revert；cross 校验只拦合并不拦运行时，回滚无数据/兼容负担。发版顺序无要求（纯前端静态资源）。

## Open Questions

（无——`.pill` 角色映射、`--on-accent` 取值、共享段边界均已由 cross-end.html §三裁决定案；裸 `.b` 三处的单点定档在 D4 留给实现侧按内容定性，属授权范围内的微决策。）
