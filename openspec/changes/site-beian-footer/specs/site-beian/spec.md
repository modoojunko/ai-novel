## Purpose

S端 网站底部备案信息条：满足工信部对已完成 ICP 备案的网站"底部悬挂备案号并链接工信部系统"的合规要求，并保证主域名与 www 域名的公开页面均可见。

## ADDED Requirements

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

备案信息条内容 SHALL 全部来自构建期环境变量（ICP 必填项、公安备案可选项），代码库内 MUST NOT 硬编码任何具体号码；所有挂载点引用同一数据源，值变更后一次重新发布即可全站生效。

#### Scenario: 换发新备案号
- **WHEN** 运维更新环境变量中的 ICP 号并重新构建发布
- **THEN** 全部挂载点展示新号码，无需要改动源码

### Requirement: 同屏不重复渲染

同一可视视口内备案信息条 MUST 只出现一次：自带完整页脚的落地页 FooterSection 内嵌该条后，外层公共布局对同路由 MUST NOT 再额外追加第二份。

#### Scenario: 首页只出现一份
- **WHEN** 访客在首页滚动到页尾
- **THEN** 备案信息条仅出现一次（位于版权行之后），不存在两条相邻重复内容

### Requirement: www 域名可达性

主域名 apex 与 www 子域 SHALL 均能以 HTTP(S) 正常访问站点且看到上述备案信息条；www 无解析或未绑定托管时 MUST 在上线清单中作为阻断项处理。

#### Scenario: 核查方从 www 进入
- **WHEN** 访客通过 `https://www.awesomenovel.com` 打开站点
- **THEN** 与 apex 域名相同的站点内容呈现，页底可见备案号链接
