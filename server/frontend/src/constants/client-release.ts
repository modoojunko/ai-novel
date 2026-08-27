/**
 * C端客户端发布版本单一事实源：落地页下载按钮与版本副行都从这里取值。
 * 发版时由 client-package.yml 的 release job 自动开 bump PR 更新此行（人合入后生效）；
 * 漏合入时落地页继续指向上一版资产（历史资产永久保留，链接不失效）。
 * 资产文件名与打包产物一一对应，双平台统一 v 前缀：
 *   exe = AI_Novel_Setup_v<版本>.exe（installer.iss 模板）
 *   dmg = AI_Novel_mac_v<版本>.dmg（workflow hdiutil 步骤）
 */
export const LATEST_CLIENT_VERSION = '0.11'

const RELEASES_DOWNLOAD_BASE = 'https://github.com/modoojunko/ai-novel/releases/download'

export const WINDOWS_INSTALLER_URL =
  `${RELEASES_DOWNLOAD_BASE}/v${LATEST_CLIENT_VERSION}/AI_Novel_Setup_v${LATEST_CLIENT_VERSION}.exe`
export const MACOS_INSTALLER_URL =
  `${RELEASES_DOWNLOAD_BASE}/v${LATEST_CLIENT_VERSION}/AI_Novel_mac_v${LATEST_CLIENT_VERSION}.dmg`
export const RELEASES_PAGE_URL = 'https://github.com/modoojunko/ai-novel/releases'
