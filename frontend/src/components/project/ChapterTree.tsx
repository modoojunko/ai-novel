"use client";

import { cn } from "@/lib/utils";

export type ChapterInfo = {
  ref: string;
  volume: number;
  chapter: number;
  title: string;
  status?: string;
  wordCount?: number;
};

export type VolumeInfo = {
  name: string;
  volNum: number;
  chapters: ChapterInfo[];
};

export function ChapterTree({
  volumes,
  selectedRef,
  onSelect,
  expanded = {},
  onToggle,
  showWordCount = false,
}: {
  volumes: VolumeInfo[];
  selectedRef: string | null;
  onSelect: (ref: string) => void;
  expanded?: Record<string, boolean>;
  onToggle?: (name: string) => void;
  showWordCount?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {volumes.map((vol) => {
        const isOpen = expanded[vol.name] !== false;
        return (
          <div key={vol.name}>
            <button
              onClick={() => onToggle?.(vol.name)}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left hover:bg-muted/50 rounded transition-colors"
            >
              <span className="text-[10px] text-muted-foreground">
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="text-xs text-muted-foreground font-medium truncate">
                第{vol.volNum}卷
              </span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto">
                {vol.chapters.length}章
              </span>
            </button>
            {isOpen && (
              <div className="ml-3 border-l border-border/50 pl-2">
                {vol.chapters.map((ch) => {
                  const isSelected = selectedRef === ch.ref;
                  const isDone = ch.status === "confirmed" || ch.status === "archived";
                  return (
                    <button
                      key={ch.ref}
                      onClick={() => onSelect(ch.ref)}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 text-left rounded transition-colors text-xs",
                        isSelected
                          ? "bg-primary/8 border-l-[1.5px] border-primary text-primary font-medium"
                          : "hover:bg-muted/30 text-muted-foreground border-l-[1.5px] border-transparent"
                      )}
                    >
                      <div
                        className={cn(
                          "w-[7px] h-[7px] rounded-full flex-shrink-0",
                          isDone
                            ? "bg-emerald-600"
                            : isSelected
                              ? "border-[1.5px] border-primary"
                              : "border-[1.5px] border-muted-foreground/30"
                        )}
                      />
                      <span className="truncate">
                        ch-{ch.chapter} {ch.title || "(未命名)"}
                      </span>
                      {showWordCount && ch.wordCount && (
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">
                          {ch.wordCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Parse "vol-1-ch-2" style refs into structured data */
export function parseChapterRefs(
  volumes: any[]
): { volumes: VolumeInfo[]; chapterRefs: string[] } {
  const result: VolumeInfo[] = [];
  const chapterRefs: string[] = [];

  volumes.forEach((v: any) => {
    const volNum = parseInt(v.name.replace("vol-", ""), 10);
    const chapters: ChapterInfo[] = (v.chapters || []).map((ch: any) => {
      const ref = `vol-${ch.volume}-ch-${ch.chapter}`;
      chapterRefs.push(ref);
      return {
        ref,
        volume: ch.volume,
        chapter: ch.chapter,
        title: ch.title || "",
        status: ch.status,
      };
    });
    result.push({ name: v.name, volNum, chapters });
  });

  return { volumes: result, chapterRefs };
}
