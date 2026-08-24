/**
 * 图标注册表（Open Design v2）—— 路径照抄 C端 client/frontend/src/components/icons.tsx
 * （即原型内联 SVG），禁 lucide/emoji。
 * 尺寸不写死：由上下文 CSS 控制（.btn svg 15px、.empty svg 26px…），
 * 独立使用时传 size。
 */

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
  // 模型配置（model-config.html）
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  spinner: '<path d="M21 12a9 9 0 11-6.2-8.56"/>',
  // 书工作台（book.html）
  back: '<path d="M15 6l-6 6 6 6"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  focus: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  star: '<path d="M12 2l2.4 6.2L21 9l-5 4.4 1.6 6.6L12 16.6 6.4 20 8 13.4 3 9l6.6-.8z"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  tune: '<path d="M4 7h13M10 12h10M4 17h7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  dot: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
  spark:
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
  refresh: '<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  doc: '<path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.5h.01"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M3 20h18"/>',
  // ─── S端 扩展（同款单线、24 viewBox、图形约 14-16 单位居中） ───
  eyeOff: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 4l16 16"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M4 11l8-7 8 7M6 9.5V20h12V9.5"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2.5 2.5M13 9l2 2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9l3 3-3 3M12 15h5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.2 2.5 2.7.6 2-1.8 1.8 1.8-1.8 2 .6 2.7 2.5 1.2v2.5l-2.5 1.2-.6 2.7 1.8 2-1.8 1.8-2-1.8-2.7.6L12 21.5l-1.2-2.5-2.7-.6-2 1.8L4.3 18.4l1.8-2-.6-2.7L3 12.5V10l2.5-1.2.6-2.7-1.8-2 1.8-1.8 2 1.8 2.7-.6z"/>',
  logout: '<path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  tos: '<path d="M4 5h7l1 2h8v12H4z"/>',
  book: '<path d="M12 6c-1.6-1.4-3.9-2-7-2v14c3.1 0 5.4.6 7 2 1.6-1.4 3.9-2 7-2V4c-3.1 0-5.4.6-7 2z"/><path d="M12 6v14"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4"/>',
  wand: '<path d="M3 21l10-10M14 7l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 3l.8 1.6 1.7.9-1.7.9L19 8l-.8-1.6-1.7-.9 1.7-.9z"/>',
  bot: '<rect x="5" y="9" width="14" height="9" rx="2"/><path d="M12 9V5M9.5 5h5M9 12.5h.01M15 12.5h.01M9.5 15.5h5M3 12v3M21 12v3"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="10" y="10" width="4" height="4"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  brain: '<path d="M12 5.5a2.7 2.7 0 00-2.7 2.1A2.7 2.7 0 006.9 11a2.7 2.7 0 00-.6 4.2A2.7 2.7 0 009 18.5c.6 0 1.1-.1 1.5-.4a3 3 0 003 0c.4.3.9.4 1.5.4a2.7 2.7 0 002.7-3.3A2.7 2.7 0 0017.1 11a2.7 2.7 0 00-2.4-3.4A2.7 2.7 0 0012 5.5z"/><path d="M12 5.5v12.8"/>',
  link: '<path d="M10.5 13.5a4 4 0 005.7 0l3.2-3.2a4 4 0 10-5.7-5.7L12 6.3"/><path d="M13.5 10.5a4 4 0 00-5.7 0l-3.2 3.2a4 4 0 105.7 5.7l1.7-1.7"/>',
  messages: '<path d="M3 5h10v7H7l-4 3z"/><path d="M11 10h9v7h-5l-2 2v-2h-2z"/>',
} as const;
