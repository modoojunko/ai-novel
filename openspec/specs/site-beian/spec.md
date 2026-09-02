# site-beian Specification

## Purpose

S端 网站底部备案信息条：满足工信部对已完成 ICP 备案的网站"底部悬挂备案号并链接工信部系统"的合规要求，并保证对外入口域名（www.awesomenovel.com）正常可见。

## Requirements

### Requirement: 备案号展示

网站 SHALL 在页面底部渲染一条备案信息条，其中 ICP 备案号为指向 `https://beian.miit.gov.cn/` 的超链接（新标签页打开，带 `rel="noopener"`）。备案号文本与腾讯云备案批复一致；广东主体备案以「粤ICP备×号」、非广东接入以服务备案号格式呈现，系统不对号码文本做任何加工。

#### Scenario: 已配置备案号的公开页面
- **WHEN** 访客打开任一未登录可访问页面（首页、登录、注册、激活过渡页、404）
- **THEN** 页面底部出现备案信息条，ICP 备案号是 `<a>` 链接，`href` 为 `https://beian.miit.gov.cn/`，且新标签页打开

#### Scenario: 登录后的控制台页面
- **WHEN** 已登录用户进入 /dashboard 下任意页面
- **THEN** 页面底部同样出现该备案信息条

### Requirement: 公安备案号可选追加

WHEN 环境配置了公安备案号时 THEN 备案信息条 SHALL 在 ICP 号同排追加公安备案号链接（默认指向公安部查询页 `https://beian.mps.gov.cn/#/query/webSearch?code=<编号数字>`）；WHEN 未配置时 THEN 对应片段 MUST 整体不渲染，不留占位文案。

#### Scenario: 未配置公安备案号
- **WHEN** 构建产物中未注入公安备案号变量
- **THEN** 底部仅显示 ICP 备案号链接，无空壳元素或「待填写」字样

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

### Requirement: 同屏不重复渲染

同一可视视口内备案信息条 MUST 只出现一次：自带完整页脚的落地页 FooterSection 内嵌该条后，外层公共布局对同路由 MUST NOT 再额外追加第二份。

#### Scenario: 首页只出现一份
- **WHEN** 访客在首页滚动到页尾
- **THEN** 备案信息条仅出现一次（位于版权行之后），不存在两条相邻重复内容

### Requirement: 对外入口域名可达性

2026-08-27 运维拍板：以 `www.awesomenovel.com` 作为对外唯一入口域名；主域名 apex 因 CloudBase 自定义域名名额限制未续挂绑定，裁定放弃、不再作为验收口径。系统 SHALL 保证访客经 `https://www.awesomenovel.com` 可正常以 HTTP(S) 访问站点并看到上述备案信息条。

#### Scenario: 核查方从对外入口进入
- **WHEN** 访客通过 `https://www.awesomenovel.com` 打开站点
- **THEN** TLS 握手有效、页面加载成功，页底可见备案号链接且 JS 产物含备案号文本
