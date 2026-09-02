## MODIFIED Requirements

### Requirement: 号码来源单一事实源

备案信息条内容 SHALL 采用双层来源、字段级优先级：运行时同源配置文件 `site-config.json`（`beianIcp`/`beianPolice`/`beianPoliceLink` 字段）为主源，构建期环境变量（ICP 必填项、公安备案可选项）为兜底层；运行时字段为空或缺省时回落构建期值，两层皆空时整条隐藏。仓库内 `site-config.json` 允许承载真实号码（备案号为法定公开信息）；源码内 MUST NOT 硬编码任何具体号码。所有挂载点引用同一数据源，值变更后仅需换发配置文件（免重建）或一次重新发布即可全站生效。

#### Scenario: 运行时配置优先于构建期值

- **WHEN** 构建期注入了 ICP 号 A，同源 `site-config.json` 配置了 ICP 号 B
- **THEN** 全部挂载点展示号码 B，链接与展示行为不变

#### Scenario: 运行时配置缺失时构建期值兜底

- **WHEN** `site-config.json` 缺失、损坏或备案字段为空，构建期注入了 ICP 号 A
- **THEN** 全部挂载点仍展示号码 A，备案条不因运行时层缺失而消失

#### Scenario: 两层皆空整条隐藏

- **WHEN** 运行时与构建期均未提供任何备案号
- **THEN** 备案信息条整体不渲染，不留占位空壳（与既有行为一致）

#### Scenario: 换发新备案号

- **WHEN** 运维更新构建期环境变量中的 ICP 号并重新构建发布，且运行时配置未覆盖该字段
- **THEN** 全部挂载点展示新号码，无需要改动源码

#### Scenario: 免重建换号

- **WHEN** 运维仅替换静态托管上的 `site-config.json` 中的号码，不做前端构建
- **THEN** 用户下次加载页面时全部挂载点展示新号码
