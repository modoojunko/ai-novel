// theme-preferences · 截图证据（任务 4.2）
// 各主题控制台态 + 选择器卡片。一次性验收脚本，change 归档时可删。
import { test } from '../fixtures'
import path from 'node:path'
import fs from 'node:fs'

const OUT = path.resolve(process.cwd(), '../../openspec/changes/theme-preferences/screenshots')
fs.mkdirSync(OUT, { recursive: true })

const THEMES: Array<[string, string]> = [
  ['teal', '默认'],
  ['ink', '玄墨'],
  ['bamboo', '竹青'],
  ['rouge', '胭脂'],
  ['wisteria', '紫藤'],
  ['celadon', '青瓷'],
]

test('六主题截图', async ({ page, mockApi }) => {
  for (const [key, label] of THEMES) {
    mockApi.registerUser({ theme: key })
    await page.goto('/')
    await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
    await page.goto('/dashboard/account')
    await page.getByRole('heading', { name: '账户设置' }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(OUT, `theme-${key}.png`) })
    await page.evaluate(() => localStorage.clear())
  }
  console.log('saved 6 theme screenshots to', OUT)
})

test('landing 默认态（主题不外溢）', async ({ page, mockApi }) => {
  mockApi.registerUser({ theme: 'ink' })
  await page.goto('/')
  await page.evaluate((token) => localStorage.setItem('token', token), mockApi.token)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(OUT, 'landing-default.png') })
})
