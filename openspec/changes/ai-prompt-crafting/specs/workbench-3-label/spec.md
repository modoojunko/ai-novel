# workbench-3-label Specification (Delta)

## MODIFIED Requirements

### Requirement: 章节点点击 → 中部子 label 切换 正文 / 章纲 / 提示词

- Selecting a chapter node SHALL render a sub-label bar in the main area: 正文 / 章纲 / 提示词.
- 正文 SHALL render the existing `ChapterEditor` + `RightToolbar`; `ChapterEditor`'s internal 正文/提示词 view tabs SHALL be removed.
- 章纲 SHALL render `OutlineEditor` fed by `useOutline` (chapter data loaded on demand via `loadChapterData`), including the prompt-crafting fields (场景卡权重/焦点、读者获得、章末落点).
- 提示词 SHALL render the chapter's single whole-chapter prompt view: 当前整章提示词内容（查看/编辑保存）、「AI 润色」入口、润色状态说明；分段提示词文件列表 SHALL NOT 渲染.
- With no chapter selected, the sub-label bar SHALL NOT render.

#### Scenario: Selecting a chapter shows sub-labels

- Given a novel with a chapter
- When the user clicks the chapter node
- Then the sub-label bar renders 正文 / 章纲 / 提示词 (提示词 PRO-only)
- And the default sub-label is 正文 (prose editor)

#### Scenario: 提示词子 label 呈现整章提示词

- **WHEN** PRO 用户打开某章的「提示词」子 label
- **THEN** 呈现该章唯一整章提示词的查看/编辑视图与「AI 润色」入口
- **AND** 不呈现分段提示词列表或分段生成按钮

### Requirement: 提示词子 label PRO-only

- The 提示词 sub-label button and its content SHALL be gated by `TierGate feature="prompt-panel"` (PRO-only).
- In free tier, the 提示词 sub-label SHALL be hidden; the sub-label bar SHALL show only 正文 / 章纲.
- The prompt view SHALL be scoped to the currently selected chapter (`chapterRef`), loading and saving that chapter's whole-chapter prompt only.

#### Scenario: Free hides the prompt sub-label

- Given a free session with a chapter selected
- Then the sub-label bar renders 正文 and 章纲
- And no 提示词 sub-label is rendered

#### Scenario: PRO shows the prompt sub-label filtered by chapter

- Given a PRO session with a chapter selected
- When the user opens 提示词
- Then the view shows only the selected chapter's whole-chapter prompt, with an AI-polish entry and editable content
