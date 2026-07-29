import { test as base } from '@playwright/test'
import { MockApi } from './mocks/api-handlers'

export const test = base.extend<{ mockApi: MockApi }>({
  mockApi: async ({ page }, use) => {
    const mockApi = new MockApi(page)
    await mockApi.setup()
    await use(mockApi)
  },
})

export { expect } from '@playwright/test'
