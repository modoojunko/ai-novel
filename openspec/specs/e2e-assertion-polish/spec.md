# e2e-assertion-polish Specification

## Purpose
TBD - created by archiving change 008-e2e-assertion-polish. Update Purpose after archive.

## Requirements

### Requirement: 免费主流程 E2E 在当前代码上通过

系统 SHALL 实现本条——`free-writing-flow.spec.ts` 的全部用例必须在当前代码（本地 Vite dev，代理到 docker client-backend）上通过：建书直达正文工作台、树常驻「+新建卷/章」、树 CRUD（双击重命名 + hover 删除）、空章「未写」弱化、实时字数 + 自动保存、免费归档不 500 + 树 📦 即时同步、全程零 phase-status 请求。

#### Scenario: 免费建书直达正文且零阶段请求

- Given docker 后端以 `tier=none` 会话运行、前端为当前代码
- When 免费用户建书并进入小说页
- Then 落点即正文工作台，EmptyState 三入口可见，NovelBar 带「高级配置 ▾」与「可选」标注
- And 全程无 `workflow/phase-status` 请求、无 PRO 阶段 tab、无阶段催促文案

#### Scenario: 直接写第一章到达编辑器并实时保存

- Given 免费用户建书
- When 点「直接写第一章」并输入正文
- Then 编辑器可达，树出现「第一卷/第一章」，空章「未写」弱化徽标可见
- And 输入「你好 世界」后实时字数显示「4 字」，随后出现「已保存」

#### Scenario: 树 CRUD 双击重命名与 hover 删除

- Given 免费用户已写入第一章
- When 双击章名改名为「改名第一章」并回车
- Then 树显示新名
- When hover 章节点点删除并确认
- Then 树清空回 EmptyState

#### Scenario: 免费归档不 500 且树 📦 即时同步

- Given 免费用户已写入长正文（≥100 字）
- When 点「归档」并接受确认
- Then 出现只读提示条（不 500），树该章出现 📦

### Requirement: PRO 创建流程 E2E 在当前代码上通过

系统 SHALL 实现本条——`creation-flow.spec.ts` 的全部用例必须在当前代码上通过：建书即进小说页、简介空不可完成设定、EmptyState 无门控直写第一章、设定 7 项确认后门控横幅消失、改名即时生效。

#### Scenario: 建书即进入小说页

- Given PRO（trial）会话
- When 仅以书名创建小说
- Then 直达小说页（正文工作台），无需先填设定

### Requirement: E2E 断言反映 DB 树迁移后的行为

系统 SHALL 实现本条——change 006/007 后树以 DB 为结构准、归档停写内嵌列表——E2E 断言不得再依赖旧行为（卷 YAML 内嵌列表、文件扫描树）。

#### Scenario: 树断言仅依赖 UI 呈现而非内部存储

- Given 当前代码的 DB 树
- When 建卷/章、归档、重命名、删除
- Then 树 UI 断言（标题文本、📦、EmptyState）通过，不读取卷 YAML 内嵌列表

### Requirement: 回归收口

系统 SHALL 实现本条——change 008 完成后全量回归必须全绿：后端 `pytest tests/`（当前 313）、前端 `tsc --noEmit`、`vitest`（44）、`npm run build`，外加两条 E2E flow spec。

#### Scenario: 全量回归零失败

- Given change 008 打磨完成
- When 运行后端 pytest + 前端 tsc/vitest/build + 两条 E2E flow spec
- Then 全部通过，无新增失败
