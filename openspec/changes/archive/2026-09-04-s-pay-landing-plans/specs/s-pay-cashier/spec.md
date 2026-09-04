# s-pay-cashier 变更

## ADDED Requirements

### Requirement: URL 参数预选套餐

收银台 SHALL 支持 `period` 与 `tier` 查询参数初始化选套餐区选中态（落地页带参跳转的消费端）；参数值 MUST 先对商品目录校验（period 在在售时长集合内、tier 在该时长下有可购 SKU），校验通过才采用，否则回落现有默认逻辑（包月+popular 档回退链）。不带参数或参数非法时，收银台行为 MUST 与现状完全一致。

#### Scenario: 合法参数预选

- **WHEN** 用户打开 `/pay?period=yearly&tier=pro` 且目录中该规格可购
- **THEN** 选套餐区时长 tab 选中年度、档位列选中 PRO，购买条展示「PRO · 包年（365 天）」及对应价格

#### Scenario: 非法参数回落默认

- **WHEN** 用户打开带不存在的档位或不在售时长的参数（如 `/pay?tier=max&period=daily`）
- **THEN** 收银台按现有默认逻辑初始化（包月+popular 档回退链），不报错、不出现不可购选中态

#### Scenario: 不带参行为不变

- **WHEN** 用户直接打开 `/pay`（无查询参数）
- **THEN** 初始化行为与参数功能上线前完全一致
