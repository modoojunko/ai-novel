import { test } from '../fixtures'

test('probe cashier', async ({ page, mockApi }) => {
  mockApi.registerUser()
  mockApi.setPurchaseEnabled(false)
  page.on('request', (r) => { if (r.url().includes('/api/')) console.log('REQ', r.method(), r.url()) })
  page.on('response', async (r) => {
    if (r.url().includes('/api/')) console.log('RES', r.status(), r.url(), (await r.text()).slice(0, 90))
  })
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('token', 'e2e-token'))
  await page.goto('/pay')
  await page.waitForTimeout(4000)
})
