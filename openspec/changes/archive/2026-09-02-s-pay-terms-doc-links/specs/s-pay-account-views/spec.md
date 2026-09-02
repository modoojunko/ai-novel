## ADDED Requirements

### Requirement: 退款页提供退款政策全文直达入口
退款流程页尾部的「退款政策全文」入口 SHALL 以新标签打开 `/legal/refund-policy.html`，MUST NOT 指向客服页等其他页面；点击该入口 MUST NOT 使当前退款页丢失填写与预览状态。

#### Scenario: 退款页可达退款政策全文
- **WHEN** 用户在退款页点击「看看退款政策全文」
- **THEN** 退款政策文档在新标签页打开，原退款页停留在当前状态（表单与金额预览不丢）
