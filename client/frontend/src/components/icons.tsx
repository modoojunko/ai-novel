/**
 * 图标注册表（Open Design v2）—— 路径照抄原型内联 SVG，禁 lucide/emoji。
 * 尺寸不写死：由上下文 CSS 控制（.btn svg 15px、.genre svg 12px…），
 * 与原型的 svg 用法完全一致；独立使用时传 size。
 */
import type { CSSProperties } from "react";

export const P = {
  // 通用
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  upload: '<path d="M12 15V4M7 8l5-5 5 5M5 20h14"/>',
  dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  // 题材（list.html GENRE_ICON 原样）
  scifi: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
  mystery: '<path d="M9.5 11a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/><path d="M9.5 11v6M7 7L4.5 3.5M12 7l2.5-3.5M9.5 14H8M9.5 17H8"/>',
  city: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h4v6"/><path d="M9 10h.01M13 10h.01M11 7h.01"/>',
  fantasy: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/>',
  wuxia: '<path d="M4 20c6-2 12-8 15-15M13 7l4 4M6 14l4 4"/>',
  history: '<path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  other: '<path d="M12 3v18M3 12h18"/>',
} as const;

/** 题材名 → 图标：含 8 题材库全名（悬疑刑侦/都市言情…）到原型 7 图标的归类 */
export function genreIconPath(genre?: string | null): string {
  const g = genre || "";
  if (/科幻/.test(g)) return P.scifi;
  if (/悬疑|刑侦|推理/.test(g)) return P.mystery;
  if (/都市|言情|日常/.test(g)) return P.city;
  if (/玄幻|仙侠|奇幻/.test(g)) return P.fantasy;
  if (/武侠/.test(g)) return P.wuxia;
  if (/历史|古风/.test(g)) return P.history;
  return P.other;
}

interface IcoProps {
  d: string;
  /** 线宽：原型惯例 2（通用）/ 2.2-2.4（强调）；默认 2 */
  sw?: number;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

/** 原型内联 SVG 的 React 等价物：viewBox 24、stroke currentColor、fill none */
export function Ico({ d, sw = 2, size, style, className }: IcoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      width={size}
      height={size}
      style={style}
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
