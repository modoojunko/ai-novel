# outline-ai-draft Specification Delta

## MODIFIED Requirements

### Requirement: 输出校验与兜底

（承接既有骨架/枚举/字数兜底，本次收口段落字数与首章哨兵）

段落规划的 target_words 做数值规整：模型按字符串或非法值输出时转换为整数，失败回落 800，草稿不携带非整数段落字数。

#### Scenario: 段落字数字符串规整
- **WHEN** 模型返回 segments 为 [{summary: "潜入", target_words: "800"}]
- **THEN** 草稿中该段 target_words 为整数 800

#### Scenario: 段落字数非法回落
- **WHEN** target_words 为 "很多" / null / 缺省
- **THEN** 该段 target_words 回落 800

### Requirement: 素材汇集

首章前情排除逻辑引用统一哨兵常量（与正文上下文构建同一来源），不使用复制的字符串字面量。

#### Scenario: 哨兵单一来源
- **WHEN** 正文上下文的首章哨兵文案调整
- **THEN** 章纲起草的素材包同步生效，首章仍不携带前情段
