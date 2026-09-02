# s-site-config-json

## Why

S端 站点级配置（API 基址、备案号）目前全部烤死在前端构建产物里：换域名要重新构建发布，不经 CI 的本机部署（`tcb app deploy`）拿不到 GitHub Secrets 会静默丢备案号、丢基址——09-01 前端 CORS 事故与 09-02 本地部署丢备案号两起事故同根。需要一个运行时单点：改一个同源 JSON 文件即全站生效，无需重新构建。

## What Changes

- 新增同源运行时配置文件 `public/site-config.json`（随构建产物一起发布；后续改配置 = 改这一个文件重新上传，秒级生效）：`apiBase`、`beianIcp`、`beianPolice`、`beianPoliceLink` 四个可选字段
- 前端启动引导改造：应用挂载前加载并应用该配置。生产构建才加载（`import.meta.env.DEV` 跳过，本地 dev 与 e2e 零影响）；任何失败（404/网络/解析/超时 3s）一律 fail-open 回落构建期烘焙值，不阻塞渲染
- 字段级优先级：运行时 JSON 非空值 > 构建期 env 烘焙（`.env.production.local` / `.env.production`）> 内置安全默认（apiBase=`/api`、备案空）
- API 基址从模块 import 时定死改为启动期可覆盖（axios 实例 `defaults.baseURL`）
- 备案条数据源从纯构建期内联改为「运行时覆盖 + 构建期兜底」，五挂点渲染逻辑与视觉不变
- 产物探针 `probe:beian` 扩展：校验 dist 含 `site-config.json`，且配置注入值时 JSON 与 JS 产物口径一致
- **口径修订**：仓库内 `site-config.json` 直接承载生产真实值。备案号是法定必须公开展示的信息（网站页脚可见），仓库为私有库，入库无泄露面；这换来「本机部署不再依赖 CI Secrets」的根治。原 site-beian spec「代码库内零硬编码号码」的口径随之修订
- 明确不收编：客服邮箱等法律口径字段留在源码单源（`constants/support.ts` 与 docs/legal 四件套逐字一致的约束，不适合开运行时后门制造口径漂移）

## Capabilities

### New Capabilities
- `site-config`: S端 前端运行时站点配置——同源 `site-config.json` 的加载、清洗、字段级覆盖与应用时机（挂载前、生产 only、fail-open）

### Modified Capabilities
- `site-beian`: 「号码来源单一事实源」requirement 变更——主源改为运行时 `site-config.json`（仓库内文件允许承载真实号码），构建期环境变量降级为兜底层；展示行为（链接、挂点、同屏唯一）不变

## Impact

- 代码：仅 `server/frontend/`——`src/main.ts`（启动引导）、`src/api/request.ts`（基址可覆盖）、`src/constants/site-beian.ts`（覆盖入口）、新增 `src/lib/site-config.ts` 与 `public/site-config.json`、`scripts/probe-beian.mjs`（探针扩展）
- CI/CD：`s-server-deploy.yml` **零改动**（`.env.production.local` 烘焙保留为兜底层，运行时 JSON 只是多一层覆盖）；`server-frontend-ci.yml` 不变
- e2e：现有全部不受影响（dev 不加载配置文件）；备案条 spec 的断言语义不变
- 风险：启动链路新增一次同源小请求（<300B，`no-store`）——所有失败路径 fail-open 回落构建期值；生产包/dev 行为分离，本地与 CI 不会误连生产 API

## Design Impact

- 受影响端：仅 S端
- 受影响屏/弹层：无——备案条五挂点渲染结果不变（值相同），无新增对象状态（对照状态语言总表：零新增）、无语气词、无组件形态变化
- 不触碰两端共享段（零 CSS/token/组件类改动），无需原型先行（纯 S端 且零视觉差异）；设计工件由实现侧自查，落地后可补线上截图对照
- 用户可见文案：零新增
