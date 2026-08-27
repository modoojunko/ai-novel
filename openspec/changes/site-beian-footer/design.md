## Context

S端 前端为 Vue 3 + Vite 单页应用（`server/frontend/`），三种布局壳：

| 路由 | 壳 | 底部现状 |
| --- | --- | --- |
| `/`（landing） | PublicLayout + 页内 `FooterSection` | 有完整页脚（版权行 `foot-cr` 结尾） |
| `/login` `/register` | PublicLayout（`pub-root` flex column） | 仅 header + main，无页脚 |
| `/auth`（激活过渡）、404 | 各自独立的 `.auth-wrap` 居中容器 | 无页脚 |
| `/dashboard/*` | DashboardLayout（`dash-main` 内容区） | 无页脚 |

构建期注入已有成熟先例：deploy 工作流前端构建行以 `VITE_API_BASE="${BASE}/api" npm run build` 内联展开变量（#202 教训：曾发生过经 environment 间接传递的 VITE_ 变量注入失效、产物回退默认值，故以「内联展开 + 产物探针」为口径）。线上经自定义域名 awesomenovel.com 接入（网关剥 `/api` 前缀转发后端），www 子域可达性属 DNS/托管绑定问题，代码无法单方面保证。

动机见 proposal.md「Why」；行为契约见 specs/site-beian/spec.md。

## Goals / Non-Goals

**Goals:**
- 一个数据源 + 一个展示组件，五个挂载点全部引用它
- 号码值零硬编码：源码里只有变量名，真实值仅存在于环境配置
- e2e 能用确定性断言验证「有号时的形态」和「缺号时的隐藏」两种世界

**Non-Goals:**
- 不做运行时从后端拉取备案信息（见决策 D2）
- 不动网关/DNS 配置的自动化——www 可达性列入人工上线清单项

## Decisions

### D1. 组件 + 常量模块双文件，全站单一事实源

新建 `src/components/site/SiteBeianBar.vue` 与 `src/constants/site-beian.ts`（后者聚合 `import.meta.env` 读取与公安链接推导，导出 `siteBeian` 与 `hasBeianInfo`）。所有挂载点只引用组件，不存在第二处文案来源。
*备选*：每页各写一份 → 号码换发时改五处，违背全站一次生效的 spec 要求，弃。

### D2. 备案信息走构建期环境变量注入（变量替换），源码与仓库零写入

备案号变更频率≈年；首屏多一次请求换不来任何收益，还给落地页增加后端可用性耦合，且会破坏「静态托管独立可用」的现状。用 `import.meta.env.VITE_*` 读取；**真实号码绝不进仓库**——部署工作流在构建行用 GitHub Secrets 内联展开完成变量替换（同 `VITE_API_BASE="${BASE}/api"` 既有模式），`.env.production` 只留空占位与说明注释。
*备选*：① 后端 `/api/config/beian` 动态下发 → 弃，理由如上；② 号码写死 `.env.production` → 弃（用户拍板不写死，仓库属公开面）；③ 值写 `.env.production` 以规避 CI 注入失效旧坑 → 不需要：该坑指通过 environment 变量间接传递的失稳，内联 `${{ secrets.* }}` 展开每轮可见于构建日志，且有产物探针兜底检测。

### D3. 变量清单与缺省行为

```
VITE_BEIAN_ICP          必填才显示 ICP 段，如：粤ICP备2026XXXXXX号
VITE_BEIAN_POLICE       可选，公安备案号（纯文本身份），如：粤公网安备 4403XXXXXXXXX号
VITE_BEIAN_POLICE_LINK  可选，覆盖公安链接；缺省按编号数字拼 beian.mps.gov.cn 查询 URL
```
ICP 缺失但公安号存在 → 只显示公安段；两者皆空 → 整条隐藏（不留灰条占位）。省份口径（广东主体备案 vs 其他省服务备案）由运维填入对应格式字符串承担，前端不做地域分支逻辑——号码字符串即最终展示文本，这与腾讯云文档示例一致且避免维护省份枚举。

### D4. 挂载点矩阵（同屏唯一性）

| 位置 | 方式 |
| --- | --- |
| `FooterSection.vue` | 版权行 `foot-cr` 之后内嵌一条（首页核查入口） |
| `PublicLayout.vue` | `main` 之后追加；`route.name === 'landing'` 时跳过，防同屏双条 |
| `AuthLayout.vue`（/auth 过渡页） | `auth-wrap` 改为纵向 flex，条 `margin-top: auto` 吸底 |
| `NotFoundPage.vue` | 同上处理自身 `auth-wrap` 容器 |
| `DashboardLayout.vue` | `dash-shell` 内容流尾部追加，滚动可见即可 |

样式沿用 `.foot-cr` 的字级体系（12px、muted 混色、行间距 14px），纯普通流元素，不涉及 fixed 定位与 portal，规避此前 daisyUI modal 的 containing block / 层叠历史坑。

### D5. 验证策略：e2e 注入测试号 + 双构建产物探针，不新增 vitest 依赖

S端 前端现有测试面是 Playwright（无 vitest），不为此需求引入新依赖：

1. **e2e 有号世界**：`playwright.config.ts` 的 webServer 注入固定测试号 `VITE_BEIAN_ICP=粤ICP备TEST0000001号`，新增 `beian.spec.ts` 断言首页/登录页//auth/404/dashboard 均存在 `a[href="https://beian.miit.gov.cn/"]` 且文本为注入值；首页该链接计数为 1（防双条回归）。
2. **缺号世界走产物级验证**：「两段皆空 → 整条隐藏」的补集等价于——空 env 构建的 dist 中不含号码字符串、配置 env 构建的 dist 中必含。以 `scripts/probe-beian.mjs` 对 dist 资产做 grep 断言表达，本地/CI 各跑得动且零依赖。

## Risks / Trade-offs

- [构建期 secret 注入断链致线上白号（静默合规缺口）] → 部署工作流构建后跑 `probe:beian` 产物探针：配置了号码却不在产物里=部署 fail；未配置号码=输出醒目 ⚠️ 告警不拦截，避免 secret 未建时挡死全部其他部署；上线清单含人工复查线上响应体。
- [`auth-wrap` 居中布局使吸底条被挤压或溢出] → 外包一层纵向 flex 壳接管 100dvh，原居中区降级为壳内弹性区，条 `margin-top:auto` 吸底；移动端注册长卡场景下条随内容自然下移。
- [www.awesomenovel.com 当前未解析/未绑定] → 任务清单设前置探测（dig + curl 探活看响应体）；若缺失，按现托管类型走 CloudBase 自定义域名绑定或 DNS 加 CNAME，作为上线阻断项，不在本 change 代码范围内消化。
- [备案号被后续批量改版误删] → e2e 有号世界断言已在 CI 兜底。

## Migration Plan

纯前端增量发布，无数据迁移：GitHub 仓库建 Secrets（`VITE_BEIAN_ICP` 等）→ 合入 main 自动部署即完成变量替换注入 → 探活 apex/www 域名响应体含备案号。回滚 = 重发上一版本产物。

## Open Questions

- 真实备案号文本与公安备案号有无（apply 时提供，填 `.env.production` 即可，不影响结构）。
- www 子域当前解析状态——由上线清单第一步探测结果决定补救动作。
