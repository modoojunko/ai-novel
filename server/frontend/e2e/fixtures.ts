import { test as base } from '@playwright/test'
import { MockApi } from './mocks/api-handlers'

export const test = base.extend<{ mockApi: MockApi }>({
  // auto：所有用例统一挂 mock 层（不声明 fixture 的落地页类用例也会注册路由）。
  // 否则应用启动的 check-auth 预热在无路由页面上穿透 vite proxy——CI 无 19000
  // 后端，门闩空转重试，且密闭性名存实亡。
  mockApi: [
    async ({ page }, use) => {
      const mockApi = new MockApi(page)
      await mockApi.setup()
      await use(mockApi)
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
