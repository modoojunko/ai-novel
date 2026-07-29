import { test, expect } from '../fixtures'

test('debug: test getByLabel with aria-label', async ({ page, mockApi }) => {
  mockApi.registerUser()
  await page.goto('/login')

  // Check inputs
  const inputs = page.locator('input')
  const count = await inputs.count()
  console.log('input count:', count)

  // Check input attributes
  for (let i = 0; i < count; i++) {
    const attrs = await inputs.nth(i).evaluate(el => ({
      ariaLabel: el.getAttribute('aria-label'),
      id: el.getAttribute('id'),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
    }))
    console.log(`input[${i}]:`, JSON.stringify(attrs))
  }

  // Try getByLabel
  try {
    const usernameInput = page.getByLabel('用户名')
    await usernameInput.fill('wrong_user')
    console.log('getByLabel("用户名") WORKS')
  } catch (e: any) {
    console.log('getByLabel("用户名") FAILS:', e.message?.slice(0, 100))
  }

  // Try getByRole textbox
  try {
    const textboxes = page.getByRole('textbox')
    const tbCount = await textboxes.count()
    console.log('textbox count:', tbCount)
    for (let i = 0; i < tbCount; i++) {
      const name = await textboxes.nth(i).getAttribute('aria-label')
      console.log(`textbox[${i}]: aria-label="${name}"`)
    }
  } catch (e: any) {
    console.log('getByRole textbox error:', e.message?.slice(0, 100))
  }
})
