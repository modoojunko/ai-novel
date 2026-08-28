// 界面主题目录（theme-preferences）：key 与后端白名单（app/domain/identity/theme.py）
// 及两端 base.css @cross 覆盖层三方一致；swatch 色值 = 该主题 --accent 实际值。
export interface ThemeOption {
  key: string
  label: string
  color: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { key: 'teal', label: '默认', color: 'oklch(48% 0.11 170)' },
  { key: 'ink', label: '玄墨', color: 'oklch(37% 0.01 250)' },
  { key: 'bamboo', label: '竹青', color: 'oklch(60% 0.076 152)' },
  { key: 'rouge', label: '胭脂', color: 'oklch(58% 0.11 8)' },
  { key: 'wisteria', label: '紫藤', color: 'oklch(58% 0.084 296)' },
  { key: 'celadon', label: '青瓷', color: 'oklch(65% 0.066 184)' },
]

export const DEFAULT_THEME_KEY = 'teal'

/** 前端本地的 key 合法性（发送前置防线；服务端白名单是最终裁决）。 */
export function isKnownThemeKey(key: string | null | undefined): boolean {
  return !!key && THEME_OPTIONS.some(t => t.key === key)
}
