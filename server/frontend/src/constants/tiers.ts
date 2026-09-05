/** 套餐档位代码 → 用户可读名称（单源；LicensePage 与 AuthPage 共用）。
 *  none/free 无有效套餐：调用方应隐藏档位 pill 而非展示裸代码。 */
export const TIER_NAMES: Record<string, string> = {
  trial: '试用',
  pro: 'PRO',
  max: 'MAX',
  lifetime: '永久',
}

export function tierName(tier: string): string {
  return TIER_NAMES[tier] || tier
}

export function tierHasPlan(tier: string): boolean {
  return tier !== '' && tier !== 'none' && tier !== 'free'
}
