## Why

awesomenovel.com 已完成 ICP 备案，按工信部要求（腾讯云《备案号悬挂说明》：[243/61412](https://cloud.tencent.com/document/product/243/61412)），必须在网站底部展示备案号并以链接指向工信部 BeIAN 系统（https://beian.miit.gov.cn/），否则有被通信管理局抽查判定为"未悬挂备案号"进而取消接入的风险。同时主域名与 www 域名都要保持可访问且可见备案号。

## What Changes

- S端 前端新增统一「备案信息条」组件：展示 ICP 备案号，`<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">`；如配置了公安备案号，同排追加公安备案号链接（https://beian.mps.gov.cn/）。
- 号码值不入代码库：从 Vite 环境变量读取（`VITE_ICP_BEIAN`、可选 `VITE_POLICE_BEIAN` + `VITE_POLICE_BEIAN_LINK`）；变量为空时对应片段整体隐藏，保证批复下来之前线上不出占位错误文案。
- 挂载点覆盖全部公开可访问页面：
  - 首页落地页现有 `FooterSection.vue` 版权行下追加（主域名 / www 域名核查入口）；
  - `PublicLayout` 对 login/register 在 main 之后渲染同一条（landing 已含 FooterSection 时跳过，防重复）;
  - `/auth` 设备激活过渡页、404 页、登录后 Dashboard 各页底部同挂。
- 运维校验项：确认 www.awesomenovel.com 有解析且能与主域名一样打开含备案号的站点；若无则在 CloudBase 托管/网关补绑定。
- 地域口径按腾讯云文档：广东备案悬挂**主体备案号**（如 粤ICP备XXXXXXX号），非广东悬挂**服务备案号**——号码字符串本身自带地域前缀，组件不做再加工。

### Non-goals

- 不改 C端 应用（其目前经 awesomenovel.com 反代仅承载 API 与静态书文件，对外入口以 S端 为准）。
- 不做备案号自动核验、亮照徽章、EDI 许可证等扩展资质展示。

## Capabilities

### New Capabilities

- `site-beian`: S端 网站底部备案信息条的展示规则——哪些页面必须出现、号码来源与缺省隐藏行为、外链指向与安全属性、重复渲染抑制。

### Modified Capabilities

（无既有能力的需求级变化）

## Impact

- **代码**：`server/frontend/src/components/site/SiteBeianBar.vue`（新）、`src/constants/site-beian.ts`（新，env 读取单一事实源）、`FooterSection.vue`、`PublicLayout.vue`、`AuthLayout.vue`、`DashboardLayout.vue`、`NotFoundPage.vue`（均小幅引用）。
- **构建**：`server/frontend/.env.production` 增补待填项；Vite env 类型声明（`env.d.ts`）。
- **e2e**：S端 Playwright 增加探针——首页含 ICP 链接且 href 指向 beian.miit.gov.cn；未配置环境变量的干净环境下条目不渲染。
- **部署/运维**：上线前在 CloudBase 静态托管/应用部署的环境变量中填入真实备案号后重新发布；DNS 侧核实 www 子域解析。
