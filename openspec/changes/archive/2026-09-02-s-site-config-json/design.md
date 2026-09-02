# s-site-config-json — Design

## Context

现状（server/frontend，Vue 3 + axios）：

- API 基址：`src/api/request.ts:36` 在模块 import 时用 `normalizeApiBase(import.meta.env.VITE_API_BASE)` 定死 axios 实例 `baseURL`；CI 部署线把 `TCB_BACKEND_DOMAIN` 烘进 `.env.production.local`（云端重建读包内 .env），`.env.production` 兜底 `/api`。
- 备案号：`src/constants/site-beian.ts` 模块初始化时内联 `VITE_BEIAN_ICP/POLICE/POLICE_LINK`，导出普通对象 `siteBeian` 与常量 `hasBeianInfo`；唯一消费组件 `SiteBeianBar.vue`（五挂点）。
- 启动入口：`src/main.ts` 同步 `createApp → mount`，随后 `warmUpBackend()`（单例预热门闩）。
- 测试：无 vitest；playwright e2e 跑在 dev server（5175），playwright.config.ts 用 env 注入测试备案号。
- 部署：`tcb app deploy` 上传 dist 全量；仓库内 `public/` 目录文件原样进产物。

## Goals / Non-Goals

**Goals:**
- 换 API 基址/备案号 = 仅替换托管上一个 JSON 文件，免重建
- 本机部署（无 CI Secrets）产物自带正确生产配置
- 生产/开发行为严格分离：dev 与 e2e 零感知

**Non-Goals:**
- 不收编客服邮箱等法律口径字段（与 docs/legal 逐字一致约束不适合开运行时后门）
- 不做管理界面/热更新（改配置仍是人工上传文件）
- 不改 C端（桌面端已有 `data/config.json` 运行时机制）
- 不改 `s-server-deploy.yml` 与 `.env.production.local` 烘焙链路（保留为兜底层）

## Decisions

### D1. 启动时序：main.ts 异步 bootstrap，挂载前应用配置

```ts
// main.ts
async function bootstrap() {
  const cfg = await loadSiteConfig()          // PROD 才真 fetch；dev 同步返回空
  if (cfg.apiBase) setApiBase(cfg.apiBase)    // request.ts 新导出，改 request.defaults.baseURL
  applyBeianOverride(cfg)                     // site-beian.ts 新导出，就地改 siteBeian 字段
  const app = createApp(App); …; app.mount('#app')
  warmUpBackend()
}
bootstrap()
```

选它而非两个替代方案：

- *顶层 await*：静态 import 会先于 await 求值（axios 实例照样先以烘焙值创建），要么倒置整个 import 图为动态 import（破坏分包），要么依赖 build target 支持 TLA——平白添变量。
- *每请求时惰性取基址*：要把 `baseURL` 改成函数/拦截器，触及 request.ts 更多面；且备案条同样需要挂载前定值，绕不开启动时序问题。

关键事实：axios 在**每次请求时**才读 `defaults.baseURL`，挂载前改写它对后续所有请求生效；挂载前不存在在途请求。`warmUpBackend()` 在应用之后调用，天然吃到最终基址，预热门闩语义不变。

### D2. 加载策略：生产 only、同源相对路径、no-store、3s 超时、fail-open

- `import.meta.env.DEV === true` 时直接返回空配置——dev 代理、e2e 全 mock、playwright 注入的测试备案号全部不受影响（这是「现有 e2e 零改动」的根基）。
- `fetch('site-config.json', { cache: 'no-store' })`：同源相对路径无 SSRF 面；no-store 保证「换文件秒生效」不被浏览器缓存拖延；文件 <300B，每会话多一次小请求可接受。
- `AbortController` 3s 超时；解析后白名单清洗（仅 4 个已知键、字符串 trim、空串视为缺省），非对象/异常一律按空配置 + `console.warn`。
- 备选 `cache: 'default'` 被否：省一次请求但违背「独立换发立即生效」的 spec 要求。

### D3. 仓库内文件承载生产真实值（spec 口径修订的由来）

`public/site-config.json` 直写 `apiBase = https://www.awesomenovel.com/api`、`beianIcp = 琼ICP备2026012341号`。备案号是法定必须公开展示的信息，仓库为私有库，无泄露面；换来本机部署彻底摆脱对 CI Secrets 的依赖（09-02 丢备案号事故的根治）。代价是修订 site-beian spec 的「代码库零硬编码号码」口径——该口径的原始动机（换号不改源码、可移植）由「换号只换 JSON 文件」更好满足。备选「仓库留空 + CI 生成该文件」被否：本机部署问题原样复发，等于没治。

### D4. 三层优先级，构建期烘焙层原样保留

运行时 JSON 非空值 > `.env.production.local`/`.env.production` 烘焙值 > 内置默认（`/api`、空号）。CI 零改动：烘焙链路继续工作，运行时层只是多一层覆盖；任一层缺失都有下一层兜底，回滚任何一层都不产生空窗。

### D5. 探针扩展：probe:beian 增查 site-config.json

沿用「secret 在、产物无 = exit 1」的防断链思路：dist 必须含 `site-config.json` 且为合法 JSON；当 `VITE_BEIAN_ICP` 已配置时，进一步断言 JSON 内含同值（JS 产物与 JSON 双口径一致，防两层漂移）。未配置时维持现有告警放行。

### D6. hasBeianInfo 从常量改为函数

覆盖发生在挂载前，普通模块常量会快照旧值。`site-beian.ts` 导出 `hasBeianInfo()`，唯一消费点 `SiteBeianBar.vue` 的 `v-if` 改为函数调用；模板首次渲染即读最终值，无需引入响应式开销。

## Risks / Trade-offs

- [启动多一次同源请求拖慢首屏] → <300B + no-store + 3s 超时 + fail-open；请求与 vue 资源加载并行度高于任何 API 调用，实测预期 <10ms（同源静态文件）
- [托管/CDN 边缘缓存导致换文件不立即生效] → 浏览器侧 no-store 已排除本地层；边缘层最坏情况 = 退化为「等缓存过期」，仍严格优于现状的「必须重建」；如实测边缘缓存顽固，可加查询串版本参数（留作后续，不预做）
- [dev 不加载 → e2e 对生产路径失明] → 三道补偿：probe:beian 静态断言产物；apply 时本地 `vite preview` + 一次性浏览器冒烟（配置文件单方面携带备案号、烘焙值留空，页面渲染出该号 = 运行时覆盖链路实证）；上线后 curl 线上 `/site-config.json` + 备案条目检
- [JSON 与烘焙值漂移] → 优先级规则本身语义明确（运行时赢）；probe 在 env 配置时强制两层一致；spec 的「仅覆盖部分字段」场景锁定回落行为
- [模块对象就地变异违反响应式直觉] → 变异严格先于首次渲染，全应用仅 bootstrap 一处调用点；注释写明「挂载前定值」约束，防后人误挂到运行中

## Migration Plan

1. 合并 PR → `s-server-deploy` 自动部署（并发已串行化）；产物自带头一次带上 `site-config.json`
2. 上线验证：`curl https://novel-s-web-….webapps.tcloudbase.com/site-config.json` 返回生产值；站点备案条可见；API 请求基址不变（值相同，行为应零变化）
3. 回滚：revert PR 即可——运行时层消失，构建期烘焙层原样兜底，无数据/状态残留
