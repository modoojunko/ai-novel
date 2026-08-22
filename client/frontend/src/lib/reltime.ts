/** 相对时间（原型文案口径：刚刚/N 分钟前/N 小时前/昨天/N 天前/超过一周落日期） */
export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  if (h < 48) return "昨天";
  const d = Math.floor(h / 24);
  if (d < 8) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}
