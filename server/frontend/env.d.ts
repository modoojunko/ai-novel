/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ICP 备案号（如 粤ICP备XXXXXXXXX号）；部署时由 CI Secret 内联注入，仓库不留真实值 */
  readonly VITE_BEIAN_ICP?: string
  /** 公安备案号（可选） */
  readonly VITE_BEIAN_POLICE?: string
  /** 公安备案查询链接覆盖项（可选） */
  readonly VITE_BEIAN_POLICE_LINK?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
