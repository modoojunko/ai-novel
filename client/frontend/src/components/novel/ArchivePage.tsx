import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import ArchiveReader from "./ArchiveReader";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";

// ---------------------------------------------------------------------------
// 预览小说（归档阅读页）—— 纯阅读布局
//   左树：全部卷章结构（来源 wb.volumes），已归档可点读、未归档灰显
//   右侧：归档正文阅览（serif 阅读器，按全书顺序前后翻章）
//   管理（恢复归档）在正文编辑页；本页只读，无任何写操作
// ---------------------------------------------------------------------------

interface ArchivePageProps {
  projectId: string;
  /** 全量卷章结构（含未归档章 → 灰显）；归档事件即时刷新（useWorkbench 监听） */
  volumes: WorkbenchVolume[];
  /** 挂载时重拉卷章结构（wb.volumes 常驻内存可能滞后于本页外的结构变更） */
  onRefresh: () => void;
  onBack: () => void;
}

/** 树行章条目：结构 + 可读性（有归档文件即可读） */
interface TreeChapter {
  ref: string;
  chapterNo: number;
  title: string;
  wordCount: number;
  readable: boolean;
  filename?: string;
}

interface TreeVolume {
  volumeNo: number;
  title?: string;
  chapters: TreeChapter[];
  archivedCount: number;
}

/** 阅读顺序里的已归档章（全书顺序 = 卷升序 + 章升序） */
interface ReadableChapter {
  ref: string;
  filename: string;
  volumeNo: number;
  chapterNo: number;
  title: string;
}

function parseChapterRef(filename: string): string | null {
  const match = filename.match(/^(vol-\d+-ch-\d+)/);
  return match?.[1] ?? null;
}

function lastReadKey(projectId: string): string {
  return `preview-last-${projectId}`;
}

export default function ArchivePage({
  projectId,
  volumes,
  onRefresh,
  onBack,
}: ArchivePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** ref(vol-N-ch-M) → 归档文件名（阅读端点按文件名寻址） */
  const [refToFilename, setRefToFilename] = useState<Record<string, string>>({});
  const [currentRef, setCurrentRef] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(new Set());

  // 卷章结构重拉（wb.volumes 在工作台挂载时加载，此后仅靠事件增量刷新；
  // 预览页可能展示非本页操作产生的结构变化 → 挂载时对齐一次）
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  // -----------------------------------------------------------------------
  // Load archives（仅拉文件名清单；树元数据来自 volumes，无 N+1 章请求）
  // -----------------------------------------------------------------------

  const loadArchives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files: { filename: string; path: string }[] = await api.get(
        `/novels/${projectId}/archives`
      );
      const map: Record<string, string> = {};
      for (const f of files) {
        const ref = parseChapterRef(f.filename);
        if (ref) map[ref] = f.filename;
      }
      setRefToFilename(map);
    } catch (e: any) {
      setError(e.message || "加载归档列表失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  // -----------------------------------------------------------------------
  // Tree：全部卷章 + 可读性；阅读顺序（已归档，全书顺序）
  // -----------------------------------------------------------------------

  const tree = useMemo<TreeVolume[]>(() => {
    return volumes.map((v) => {
      const volumeNo =
        parseInt(v.name.match(/vol-(\d+)/)?.[1] ?? "0", 10) || 0;
      const chapters: TreeChapter[] = v.chapters.map((c) => {
        const ref = `${v.name}-ch-${c.chapter}`;
        const filename = refToFilename[ref];
        return {
          ref,
          chapterNo: c.chapter,
          title: c.title,
          wordCount: c.word_count || 0,
          readable: !!filename,
          filename,
        };
      });
      return {
        volumeNo,
        title: v.title,
        chapters,
        archivedCount: chapters.filter((c) => c.readable).length,
      };
    });
  }, [volumes, refToFilename]);

  /** 已归档章按全书顺序（前后章导航 + 默认定档的候选序列） */
  const readable = useMemo<ReadableChapter[]>(() => {
    return tree
      .flatMap((v) =>
        v.chapters
          .filter((c) => c.readable && c.filename)
          .map((c) => ({
            ref: c.ref,
            filename: c.filename!,
            volumeNo: v.volumeNo,
            chapterNo: c.chapterNo,
            title: c.title,
          }))
      )
      .sort((a, b) => a.volumeNo * 1000 + a.chapterNo - (b.volumeNo * 1000 + b.chapterNo));
  }, [tree]);

  // -----------------------------------------------------------------------
  // 默认定档：最近阅读章（localStorage）→ 首个已归档章
  // -----------------------------------------------------------------------

  const selectChapter = useCallback(
    (ref: string) => {
      setCurrentRef(ref);
      localStorage.setItem(lastReadKey(projectId), ref);
    },
    [projectId]
  );

  useEffect(() => {
    if (loading || error || currentRef) return;
    if (readable.length === 0) return;
    // 最近阅读章有效 → 恢复；无效（已恢复/已删）→ 回退首个已归档章。
    // 走 selectChapter：默认定档也算一次阅读，落 localStorage。
    const saved = localStorage.getItem(lastReadKey(projectId));
    const target =
      saved && readable.some((r) => r.ref === saved) ? saved : readable[0].ref;
    selectChapter(target);
  }, [loading, error, currentRef, readable, projectId, selectChapter]);

  // -----------------------------------------------------------------------
  // Prev / Next（已归档章全书顺序）
  // -----------------------------------------------------------------------

  const currentIndex = useMemo(
    () => (currentRef ? readable.findIndex((r) => r.ref === currentRef) : -1),
    [readable, currentRef]
  );
  const currentItem = currentIndex >= 0 ? readable[currentIndex] : null;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) selectChapter(readable[currentIndex - 1].ref);
  }, [currentIndex, readable, selectChapter]);

  const handleNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < readable.length - 1) {
      selectChapter(readable[currentIndex + 1].ref);
    }
  }, [currentIndex, readable, selectChapter]);

  // -----------------------------------------------------------------------
  // Tree: search filter + collapse
  // -----------------------------------------------------------------------

  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tree;
    return tree
      .map((v) => ({
        ...v,
        chapters: v.chapters.filter((c) => c.title.toLowerCase().includes(q)),
      }))
      .filter((v) => v.chapters.length > 0);
  }, [tree, searchQuery]);

  const toggleVolume = useCallback((volKey: string) => {
    setCollapsedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volKey)) next.delete(volKey);
      else next.add(volKey);
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Full-area states: loading / error / empty（无任何已归档章）
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error text-xl">
          !
        </div>
        <p className="text-sm text-error">{error}</p>
        <button onClick={loadArchives} className="btn btn-ghost btn-sm">
          重试
        </button>
      </div>
    );
  }

  if (readable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <BookMarked className="w-16 h-16 opacity-30 text-base-content/40" />
        <h2 className="text-xl font-serif text-base-content">
          还没有已归档的章节
        </h2>
        <p className="text-sm text-base-content/50 max-w-sm text-center">
          在正文编辑页完成写作并点击“归档”后，即可在这里按卷章结构阅读全书
        </p>
        <button onClick={onBack} className="btn btn-primary btn-sm">
          回到正文
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Normal: 左树 + 阅读区
  // -----------------------------------------------------------------------

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 左树：全部卷章结构 ─────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-base-300 bg-base-200/30">
        <div className="p-2 border-b border-base-300/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索章节标题..."
              className="input input-sm input-bordered w-full pl-7 bg-base-100 text-xs placeholder:text-base-content/30"
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-base-content/40">
            章节归档后即可在此通读全书，未归档章节灰显暂不可读
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-1.5" data-testid="preview-tree">
          {filteredTree.map((vol) => {
            const volKey = `vol-${vol.volumeNo}`;
            const collapsed = collapsedVolumes.has(volKey);
            return (
              <div key={volKey} className="mb-1">
                <button
                  onClick={() => toggleVolume(volKey)}
                  className="flex items-center gap-1 w-full px-1.5 py-1.5 text-xs font-medium text-base-content/60 hover:text-base-content hover:bg-base-200 rounded"
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    第{vol.volumeNo}卷{vol.title ? ` · ${vol.title}` : ""}
                  </span>
                  <span className="ml-auto text-[10px] tabular-nums text-base-content/35 flex-shrink-0">
                    {vol.archivedCount}/{vol.chapters.length}
                  </span>
                </button>

                {!collapsed && (
                  <div className="mt-0.5">
                    {vol.chapters.map((ch) => {
                      const active = ch.ref === currentRef;
                      return ch.readable ? (
                        <button
                          key={ch.ref}
                          onClick={() => selectChapter(ch.ref)}
                          className={`flex items-center gap-1.5 w-full px-2 py-1.5 pl-6 rounded text-xs transition-colors ${
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-base-content/80 hover:bg-base-200 hover:text-base-content"
                          }`}
                        >
                          <span className="truncate text-left">
                            第{ch.chapterNo}章 {ch.title}
                          </span>
                          <span className="ml-auto text-[10px] tabular-nums text-base-content/30 flex-shrink-0">
                            {ch.wordCount > 0
                              ? `${ch.wordCount.toLocaleString()}字`
                              : ""}
                          </span>
                        </button>
                      ) : (
                        <div
                          key={ch.ref}
                          className="flex items-center gap-1.5 w-full px-2 py-1.5 pl-6 rounded text-xs text-base-content/30 cursor-not-allowed select-none"
                          title="尚未归档，暂不可读"
                        >
                          <span className="truncate text-left">
                            第{ch.chapterNo}章 {ch.title}
                          </span>
                          <span className="ml-auto badge badge-ghost badge-xs opacity-60 flex-shrink-0">
                            未归档
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredTree.length === 0 && (
            <p className="px-2 py-6 text-xs text-base-content/40 text-center">
              没有找到匹配的章节
            </p>
          )}
        </nav>
      </aside>

      {/* ── 阅读区 ────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {currentItem ? (
          <ArchiveReader
            key={currentItem.ref}
            projectId={projectId}
            filename={currentItem.filename}
            volumeNo={currentItem.volumeNo}
            chapterNo={currentItem.chapterNo}
            title={currentItem.title}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < readable.length - 1}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}
      </main>
    </div>
  );
}
