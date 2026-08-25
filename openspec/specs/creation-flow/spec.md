# creation-flow Specification

## Purpose
TBD - created by archiving change creation-simplify. Update Purpose after archive.

## Requirements

### Requirement: Name-only creation
- The create modal SHALL collect only a book name (single-stage).
- The modal SHALL have no import entry, no AI naming, and no synopsis/genre collection.
- An empty name SHALL disable the create button.
- Submitting (in-flight) SHALL lock all close paths (backdrop, X, Esc).
- The create endpoint SHALL NOT require AI access, so free-tier users can create novels.

#### Scenario: Name-only create
- Given an author opens the create modal
- When they enter a book name and click create
- Then a novel is created with that name and they enter the novel page
- And no synopsis, genre or AI steps were involved

#### Scenario: Empty name blocks
- Given the create modal is open
- When the name input is empty
- Then the create button is disabled

### Requirement: Rename (display name only)
- The backend PATCH /api/novels/{id} endpoint SHALL rename the display name only.
- slug and root_path SHALL remain unchanged.
- An empty name SHALL return 422.
- Saving the same name SHALL be idempotent (200).
- A missing novel SHALL return 404.
- Two frontend entries SHALL exist: the list-card dropdown menu and the detail-page title inline edit.
- The inline-edit pencil SHALL be always visible (not hover-only).

#### Scenario: Rename keeps slug
- Given an existing novel with slug "abc"
- When the author renames it via PATCH
- Then the name changes and the slug stays "abc"

#### Scenario: Rename from two entries
- Given a novel on the list page
- When the author uses the card dropdown "重命名" or the title inline edit
- Then the rename modal/input appears and saving updates the name in place

### Requirement: Settings backfill (manual synopsis)
- GET /api/novels/{id}/story SHALL read story.yaml.synopsis.
- PUT /api/novels/{id}/story SHALL write story.yaml.synopsis and SHALL NOT trigger AI prefill.
- A synopsis card SHALL be globally visible across all settings sub-items.
- The AI one-click generation entry SHALL be hidden in settings this iteration.

#### Scenario: Write and read back synopsis
- Given a novel with empty synopsis
- When the author saves a synopsis via the card
- Then GET /story returns the same text and the card shows "已补录"

#### Scenario: Free-tier create/rename not blocked
- Given a free-tier user without AI access
- When they create a novel or rename one
- Then the request succeeds (no 403 from require_ai_access)

### Requirement: 主线卡（建书后、卷纲前的拆纲环节）
- 建书之后、进卷纲之前，设定里 SHALL 有一张「主线卡」，所有用户（含免费）可见、可手动填写和修改，待遇与简介一致。
- 主线卡 SHALL 包含三块内容：
  - **这本书讲什么**：一句话，说清「谁 + 想要什么 + 什么拦着」；
  - **结局想法**：最后一幕画面 / 主角最终怎样 / 基调（悲/喜/开放）三项，允许只填部分、允许「待定」、允许全空；
  - **分卷表**：每卷一行——卷名（2-4 字）、这卷干什么（核心冲突一句话）、大概几章；后卷允许整行「待定」。
- 主线为空 SHALL NOT 阻断进入卷纲、章纲（软提醒，与其他设定项一致）。
- 主线 SHALL 作为一个设定项整存整取（与简介、伏笔同一存储方式）。

#### Scenario: 免费用户手填主线
- Given 一位免费用户建好一本书
- When 打开设定里的主线卡，手动填入一句话主线和分卷表并保存
- Then 保存成功，重新打开内容还在，全程不需要 AI

#### Scenario: 主线为空不拦写作
- Given 一本书主线卡完全没填
- When 作者直接去建卷、写章纲
- Then 一切照常，只有设定清单里显示主线项未完成

#### Scenario: 后卷待定
- Given 作者只想清楚了第一卷
- When 填了卷 1 的名字/冲突/章数，卷 2 起留「待定」
- Then 主线卡正常保存，「待定」是合法内容而非错误

### Requirement: AI 帮我拆主线（会员向导）
- 主线卡 SHALL 提供「AI 帮我拆」入口，属会员 AI 能力（免费用户不可用，走既有会员拦截口径）。
- 入口点开 SHALL 是分步向导（不是一次全生成），共四步，每步都是「AI 干一活 → 作者确认/修改 → 进下一步」：
  1. **说想法**：作者自由输入一段话，AI 提取「谁/想要什么/什么拦着」浓缩成一句话请作者确认；作者可纠正后让 AI 重拼；
  2. **聊结局**：AI 追问最后一幕/主角结局；作者没想好可跳过（标「待定」）；AI 发现结局与主线方向矛盾时 SHALL 指出来请作者确认是否有意为之；
  3. **倒推分卷**：AI 基于主线+结局提一版分卷方案（每卷：名字/干什么/大概几章），作者可增删改；
  4. **自查**：AI 按三问自查——每卷都挂在主线上吗、卷连起来是不断的故事线吗、光看各卷能拼回主线吗——有问题指出具体哪卷；通过后补一句结构归纳（如「三卷式：起/承/转合」）。
- 每步产出 SHALL 先写入主线卡对应格子（草稿态、作者可改）；向导中途退出 SHALL 保留已完成步骤，下次可续。
- 向导完成后主线卡回归普通表单，随时手改。

#### Scenario: 会员走完四步向导
- Given 一位会员作者，主线卡为空
- When 点「AI 帮我拆」，讲了一段散乱的想法
- Then AI 浓缩出一句主线请他确认；确认后依次走结局、分卷、自查
- And 四步的产出逐段落进主线卡，每一步他都能改

#### Scenario: 免费用户点 AI 拆主线被拦
- Given 一位免费用户
- When 点主线卡的「AI 帮我拆」
- Then 收到会员拦截提示（与既有 AI 功能拦截口径一致），手动填写不受影响

#### Scenario: 向导中途退出可续
- Given 会员作者走完第 1、2 步后关掉了向导
- When 再次点「AI 帮我拆」
- Then 前两步的成果还在主线卡上，从第 3 步继续

### Requirement: 设定视图三段式布局

设定视图应与写作视图采用一致的三段式布局：左侧设定项导航、中间当前设定项表单、右侧 AI 栏。AI 相关功能在右侧 AI 栏呈现，而非嵌入表单内部。

#### Scenario: 三栏呈现

- **WHEN** 用户进入设定视图（≥1024px 宽）
- **THEN** 界面呈三栏：左为设定项导航与进度，中为当前设定项表单与确认按钮，右为 AI 栏
- **AND** AI 栏有左边框分隔，视觉与写作视图的右栏一致

#### Scenario: 主线面板的 AI 栏

- **WHEN** 用户选中「主线」设定项
- **THEN** 右侧 AI 栏显示「AI 帮我拆」四步向导（含步骤切换、输入框、产出落卡、中途可续）
- **AND** 主线表单中部不再渲染向导入口

#### Scenario: 其他面板的 AI 栏

- **WHEN** 用户选中「世界 / 风格 / AI痕迹控制」
- **THEN** AI 栏显示该设定项的 AI 能力说明与入口提示（字段内「AI 帮我填」按钮保持原位）
- **WHEN** 用户选中无 AI 能力的设定项（题材/简介/伏笔/角色/AI 模型）
- **THEN** AI 栏显示「当前设定项暂无 AI 功能」占位说明

#### Scenario: 多对象设定的内嵌子双栏

- **WHEN** 用户选中「角色」或「伏笔」设定项
- **THEN** 中间栏呈内嵌子双栏：左侧为对象列表（含新增入口），右侧为选中对象的配置表单
- **WHEN** 用户在内嵌左栏点「新增」
- **THEN** 列表加入新对象并选中，右侧表单切换为新对象的配置
- **WHEN** 用户在内嵌左栏切换选中对象
- **THEN** 右侧表单切换为该对象已保存的内容；未保存修改时的切换保护与现有面板切换口径一致
- **WHEN** 用户选中单对象设定项（题材/简介/主线/世界/风格/AI痕迹控制/AI 模型）
- **THEN** 中间栏保持单表单（无内嵌左栏）

#### Scenario: 窄屏堆叠

- **WHEN** 视口宽度 <1024px
- **THEN** 设定视图左栏置顶、主栏与 AI 栏纵向堆叠，AI 栏不隐藏（向导仍可用）

### Requirement: 主线卡结局基调选择

主线卡结局想法中的基调字段应以「问句 + 带解释的选项」形式呈现，用户无需任何说明即可理解在选什么、可否不选、如何取消。

#### Scenario: 呈现形式

- **WHEN** 用户打开主线卡的结局想法区
- **THEN** 基调区显示问句「故事读到最后，你想要哪种感觉？（可不选）」
- **AND** 显示四个选项，各带一句解释：悲（主角没得到想要的，或付出惨痛代价）、喜（目标达成，苦尽甘来）、开放（结局留白，答案交给读者）、自己写（作家自定义）
- **AND** 不出现「未定」「待定」字样

#### Scenario: 自定义基调

- **WHEN** 用户点选「自己写」
- **THEN** 出现一个填空框，用户输入的任意文本即基调值
- **WHEN** 用户清空填空框
- **THEN** 基调回到未选
- **WHEN** 用户从「自己写」切回任一预设
- **THEN** 自定义文本被清除，预设值生效
- **WHEN** 读取到存量 tone 为预设三值之外的非空文本
- **THEN** 按「自己写」态显示，文本进填空框

#### Scenario: 选择与取消

- **WHEN** 用户点击某选项
- **THEN** 该选项呈选中态，基调字段记为对应值
- **WHEN** 用户再次点击已选中的选项
- **THEN** 取消选择，基调字段回到未选

#### Scenario: 向导第 2 步跳过

- **WHEN** 会员在第 2 步点击「没想好，先跳过」
- **THEN** 基调字段保持原值不变（不写入任何占位值）

#### Scenario: 旧数据兼容

- **WHEN** 读取到存量数据 tone 为「待定」
- **THEN** 界面按未选显示；用户保存后该字段写为空
- **WHEN** 读取到 tone 为「悲」「喜」「开放」
- **THEN** 映射到对应选项的选中态

### Requirement: 多对象设定的内嵌子双栏

「角色」「伏笔」设定项的中间栏呈内嵌子双栏，且占满中间栏内容区。

#### Scenario: 子双栏占满中间栏

- **WHEN** 用户选中「角色」或「伏笔」设定项（≥1024px 宽）
- **THEN** 内嵌子双栏占满中间栏内容区的整宽（不受 660px 版心限制）与整高（列表自上而下贯穿，表单区内部滚动）
- **AND** 面板头部标题与底部确认按钮位置保持不变

#### Scenario: 单对象设定项不受影响

- **WHEN** 用户选中单对象设定项（题材/简介/主线/世界/风格/AI痕迹控制/AI 模型）
- **THEN** 中间栏保持 660px 版心卡居中不变

#### Scenario: 新增与切换对象

- **WHEN** 用户在内嵌左栏新增或切换对象
- **THEN** 行为与改版前一致（新增即选中、切换加载已保存内容、脏切换保护口径不变）
