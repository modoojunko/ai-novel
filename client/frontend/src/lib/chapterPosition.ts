// 章位置计算：左树卷章结构 → 当前章的卷内/全书位置与前后章引用
// （章页头部位置行 + 右栏「章信息」导航共用）

import type { WorkbenchVolume } from "@/hooks/useWorkbench";

export interface ChapterPosition {
  volumeNo: number;
  chapterNo: number;
  /** 卷内序（0 起） */
  inVolumeIndex: number;
  inVolumeTotal: number;
  /** 全书序（0 起，卷章按树序展平） */
  globalIndex: number;
  totalChapters: number;
  prevRef: string | null;
  nextRef: string | null;
}

export function computeChapterPosition(
  volumes: WorkbenchVolume[],
  chapterRef: string,
): ChapterPosition | null {
  const flat: Array<{ vol: number; ref: string }> = [];
  for (const v of volumes) {
    const volNo = parseInt(v.name.replace("vol-", ""), 10) || 0;
    for (const c of v.chapters) {
      flat.push({ vol: volNo, ref: `vol-${volNo}-ch-${c.chapter}` });
    }
  }
  const idx = flat.findIndex((c) => c.ref === chapterRef);
  if (idx === -1) return null;
  const cur = flat[idx];
  const siblings = flat.filter((c) => c.vol === cur.vol);
  return {
    volumeNo: cur.vol,
    chapterNo: parseInt(cur.ref.split("-ch-")[1], 10) || 0,
    inVolumeIndex: siblings.findIndex((c) => c.ref === chapterRef),
    inVolumeTotal: siblings.length,
    globalIndex: idx,
    totalChapters: flat.length,
    prevRef: idx > 0 ? flat[idx - 1].ref : null,
    nextRef: idx < flat.length - 1 ? flat[idx + 1].ref : null,
  };
}
