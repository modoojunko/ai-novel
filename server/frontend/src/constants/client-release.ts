/**
 * C端客户端发布信息（前端侧）：
 * - 线上事实源是静态托管的 download/latest.json（CI 发版时自动更新），
 *   下载弹窗打开时同源获取；本文件的 FALLBACK_VERSION 仅为请求失败时的兜底，
 *   改线上下载版本不需要发前端版本。
 * - 资产文件名与打包产物一一对应，双平台统一 v 前缀：
 *   exe = AI_Novel_Setup_v<版本>.exe（installer.iss 模板）
 *   dmg = AI_Novel_mac_v<版本>.dmg（workflow hdiutil 步骤）
 */
export const FALLBACK_VERSION = '0.11'

const DOWNLOAD_BASE = 'https://www.awesomenovel.com/download'

export function windowsInstallerUrl(ver: string): string {
  return `${DOWNLOAD_BASE}/v${ver}/AI_Novel_Setup_v${ver}.exe`
}

export function macosInstallerUrl(ver: string): string {
  return `${DOWNLOAD_BASE}/v${ver}/AI_Novel_mac_v${ver}.dmg`
}

export const RELEASES_PAGE_URL = 'https://github.com/modoojunko/ai-novel/releases'

export interface LatestRelease {
  version: string
  /** true = latest.json 请求失败，已降级为兜底版本 */
  degraded: boolean
}

/** 打开下载弹窗时调用：解析线上最新版本；请求失败降级为兜底版本（degraded=true） */
export async function fetchLatestRelease(): Promise<LatestRelease> {
  try {
    const res = await fetch('/download/latest.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: unknown = await res.json()
    const version = (data as { version?: unknown }).version
    if (typeof version !== 'string' || !/^\d+(\.\d+)*$/.test(version)) {
      throw new Error('invalid version format')
    }
    return { version, degraded: false }
  } catch {
    return { version: FALLBACK_VERSION, degraded: true }
  }
}
