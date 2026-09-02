#!/usr/bin/env node
/**
 * 备案信息产物探针：校验 dist 构建产物与备案号注入口径一致（两层都要查）。
 *
 * - dist/site-config.json（运行时主源）必须存在且为合法 JSON；配置了号码时
 *   JSON 必须含同值——防「只改 secret 忘了换 JSON」的双层漂移（运行时层优先级
 *   更高，漂移会让 secret 侧的新号码被旧号压住）；
 * - 配置了号码：dist JS 资产必须同时包含该号码与工信部链接，缺失即 exit 1
 *   （防 CI 注入断链致「secret 在、产物无」的静默合规缺口）；
 * - 未配置号码：输出醒目 ⚠️ 告警后放行（secret 未建时不挡死其他部署），上线清单人工兜底。
 *
 * 用法：npm run build && npm run probe:beian（工作目录 server/frontend）
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const distDir = new URL('../dist', import.meta.url).pathname
const icp = (process.env.VITE_BEIAN_ICP ?? '').trim()

if (!existsSync(distDir)) {
  console.error('✗ 备案探针失败：找不到 dist/，请先执行 npm run build')
  process.exit(1)
}

// ── 运行时配置文件（site-config.json）检查：任何模式都强制 ──
const configPath = join(distDir, 'site-config.json')
let siteConfig = null
if (!existsSync(configPath)) {
  console.error('✗ 备案探针失败：dist/site-config.json 缺失——运行时配置换发点断链')
  process.exit(1)
}
try {
  siteConfig = JSON.parse(readFileSync(configPath, 'utf8'))
} catch {
  console.error('✗ 备案探针失败：dist/site-config.json 不是合法 JSON')
  process.exit(1)
}
if (!siteConfig || typeof siteConfig !== 'object' || Array.isArray(siteConfig)) {
  console.error('✗ 备案探针失败：dist/site-config.json 不是 JSON 对象')
  process.exit(1)
}

const jsFiles = []
;(function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) walk(p)
    else if (name.name.endsWith('.js')) jsFiles.push(p)
  }
})(distDir)

if (!icp) {
  console.warn('┌─────────────────────────────────────────────────────────┐')
  console.warn('│ ⚠️  VITE_BEIAN_ICP 未配置，本次构建产物不含备案号。       │')
  console.warn('│    网站底部将不显示备案信息，存在合规风险！              │')
  console.warn('│    请在 GitHub Secrets 配置 VITE_BEIAN_ICP 后重新发布。  │')
  console.warn('└─────────────────────────────────────────────────────────┘')
  process.exit(0)
}

const bundle = jsFiles.map((f) => readFileSync(f, 'utf8')).join('\n')
const problems = []
if (!bundle.includes(icp)) {
  problems.push(`备案号「${icp}」未出现在 JS 产物中——Secret 注入可能断链`)
}
if (!bundle.includes('beian.miit.gov.cn')) {
  problems.push('工信部链接 beian.miit.gov.cn 未出现在产物中——备案条组件可能被移除')
}
if (siteConfig.beianIcp !== icp) {
  problems.push(`dist/site-config.json 的 beianIcp（${siteConfig.beianIcp || '空'}）与注入值「${icp}」不一致——运行时层会压住烘焙层，换号须两层同步`)
}
if (problems.length > 0) {
  for (const p of problems) console.error(`✗ 备案探针失败：${p}`)
  process.exit(1)
}
console.log(`✓ 备案探针通过：JS 产物与 site-config.json 均含备案号，工信部链接在位`)
