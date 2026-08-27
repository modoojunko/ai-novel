#!/usr/bin/env node
/**
 * 备案信息产物探针：校验 dist 构建产物与 VITE_BEIAN_ICP 注入口径一致。
 *
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
  problems.push(`备案号「${icp}」未出现在产物中——Secret 注入可能断链`)
}
if (!bundle.includes('beian.miit.gov.cn')) {
  problems.push('工信部链接 beian.miit.gov.cn 未出现在产物中——备案条组件可能被移除')
}
if (problems.length > 0) {
  for (const p of problems) console.error(`✗ 备案探针失败：${p}`)
  process.exit(1)
}
console.log(`✓ 备案探针通过：产物含备案号与工信部链接`)
