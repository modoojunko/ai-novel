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

export default function ChapterTree({
  volumes,
  selectedRef,
  onSelect,
  expanded = {},
  onToggle,
}: {
  volumes: VolumeInfo[];
  selectedRef: string | null;
  onSelect: (ref: string) => void;
  expanded?: Record<string, boolean>;
  onToggle?: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {volumes.map((vol) => {
        const isOpen = expanded[vol.name] !== false;
        return (
          <div key={vol.name}>
            <button
              onClick={() => onToggle?.(vol.name)}
              className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left hover:bg-base-300/50 rounded transition-colors"
            >
              <span className="text-[10px] text-base-content/50">
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="text-xs text-base-content/60 font-medium truncate">
                第{vol.volNum}卷
              </span>
              <span className="text-[10px] text-base-content/30 ml-auto">
                {vol.chapters.length}章
              </span>
            </button>
            {isOpen && (
              <div className="ml-3 border-l border-base-300/50 pl-2">
                {vol.chapters.map((ch) => {
                  const isSelected = selectedRef === ch.ref;
                  const isDone = ch.status === "confirmed" || ch.status === "archived";
                  return (
                    <button
                      key={ch.ref}
                      onClick={() => onSelect(ch.ref)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 text-left rounded transition-colors text-xs ${
                        isSelected
                          ? "bg-primary/10 border-l-[1.5px] border-primary text-primary font-medium"
                          : "hover:bg-base-300/30 text-base-content/60 border-l-[1.5px] border-transparent"
                      }`}
                    >
                      <div
                        className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${
                          isDone
                            ? "bg-success"
                            : isSelected
                              ? "border-[1.5px] border-primary"
                              : "border-[1.5px] border-base-content/20"
                        }`}
                      />
                      <span className="truncate">
                        ch-{ch.chapter} {ch.title || "(未命名)"}
                      </span>
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

export function parseChapterRefs(volumes: any[]): {
  volumes: VolumeInfo[];
  chapterRefs: string[];
} {
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
