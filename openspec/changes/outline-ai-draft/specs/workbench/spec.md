# workbench Specification Delta

## MODIFIED Requirements

### Requirement: 章纲面板 AI 起草入口

章纲面板提供「AI 起草」入口（需 AI 访问门通过；免费态隐藏或禁用，与提示词子面板同口径）。

#### Scenario: 空章纲一键起草
- **WHEN** 作者在章纲尚为空的章节点击 AI 起草
- **THEN** 发起起草请求，成功后将返回的结构化草稿回填进章纲表单（不落库），作者可直接修改后保存

#### Scenario: 已有内容需二次确认
- **WHEN** 章纲表单已有内容时点击 AI 起草
- **THEN** 弹出确认（说明将覆盖当前表单内容），确认后才发起；取消不发请求

#### Scenario: 起草失败可重试
- **WHEN** 起草请求返回错误（校验失败/模型错误/无主线卡）
- **THEN** toast 显示后端错误消息，表单内容保持不变

#### Scenario: 回填内容过既有校验
- **WHEN** 草稿回填表单后作者直接保存
- **THEN** 与手填完全同一条链路：ogFormIssues 拦截（场景名门槛/字数区间）、ogGaps 缺项提示、确认门照常生效
