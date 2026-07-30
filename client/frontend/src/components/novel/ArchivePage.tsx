import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  Archive,
  ArrowLeft,
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import ArchiveReader from "./ArchiveReader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchiveItem {
  filename: string;
  chapterRef: string;
  volume: number;
  chapter: number;
  title: string;
  wordCount: number;
  archiveDate: string;
  summary: string;
  isNew: boolean;
}

interface ArchivePageProps {
  projectId: string;
  projectName: string;
  onNavigateToEditor: (chapterRef: string) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseChapterRef(filename: string): string | null {
  const match = filename.match(/^(vol-\d+-ch-\d+)/);
  return match?.[1] ?? null;
}

function isRecentlyArchived(dateStr: string): boolean {
  if (!dateStr || dateStr === "—") return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

function buildArchiveItem(filename: string, chapter: any | null): ArchiveItem {
  const ref = parseChapterRef(filename) ?? filename;
  const vol = parseInt(filename.match(/vol-(\d+)/)?.[1] ?? "0", 10);
  const ch = parseInt(filename.match(/ch-(\d+)/)?.[1] ?? "0", 10);

  return {
    filename,
    chapterRef: ref,
    volume: vol,
    chapter: ch,
    title: chapter?.title ?? `\u{7B2C}${ch}\u{7AE0}`,
    wordCount:
      chapter?.prose ? chapter.prose.replace(/\s/g, "").length : 0,
    archiveDate: chapter?.archive_date ?? "—",
    summary: chapter?.archive_summary ?? "暂无摘要",
    isNew: isRecentlyArchived(chapter?.archive_date),
  };
}

function sortArchives(items: ArchiveItem[]): ArchiveItem[] {
  return [...items].sort(
    (a, b) => a.volume * 1000 + a.chapter - (b.volume * 1000 + b.chapter)
  );
}

interface VolumeGroup {
  volume: number;
  items: ArchiveItem[];
}

function groupByVolume(items: ArchiveItem[]): VolumeGroup[] {
  const groups: VolumeGroup[] = [];
  for (const item of items) {
    let group = groups.find((g) => g.volume === item.volume);
    if (!group) {
      group = { volume: item.volume, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// ArchiveCard
// ---------------------------------------------------------------------------

function formatDate(d: string): string {
  if (d === "—") return d;
  try {
    return new Date(d).toLocaleDateString("zh-CN");
  } catch {
    return d;
  }
}

function ArchiveCard({
  title,
  wordCount,
  archiveDate,
  summary,
  isNew,
  metadataFailed,
  onRead,
  onEdit,
}: {
  title: string;
  wordCount: number;
  archiveDate: string;
  summary: string;
  isNew: boolean;
  metadataFailed?: boolean;
  onRead: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="border border-base-300 rounded-lg p-3.5 hover:border-base-content/20 hover:bg-base-200/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isNew && (
              <span className="badge badge-accent badge-sm">新</span>
            )}
            <h3
              className={`text-sm font-medium truncate ${
                metadataFailed
                  ? "text-base-content/40 italic"
                  : "text-base-content"
              }`}
            >
              {title}
            </h3>
          </div>
          {summary && summary !== "暂无摘要" ? (
            <p className="text-xs text-base-content/50 leading-relaxed line-clamp-2 mt-1">
              {summary}
            </p>
          ) : (
            <p className="text-xs text-base-content/30 italic mt-1">
              {metadataFailed ? "元数据加载失败" : "暂无摘要"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-base-content/40 tabular-nums">
            {wordCount.toLocaleString()}
            {"字"}
          </span>
          <span className="text-xs text-base-content/40">
            {formatDate(archiveDate)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button
          onClick={onRead}
          className="btn btn-primary btn-xs gap-1"
        >
          <BookOpen className="w-3 h-3" />
          {"阅读"}
        </button>
        <button
          onClick={onEdit}
          className="btn btn-ghost btn-xs gap-1 text-base-content/50"
        >
          <ExternalLink className="w-3 h-3" />
          {"编辑"}
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ArchivePage
// ---------------------------------------------------------------------------

export default function ArchivePage({
  projectId,
  projectName,
  onNavigateToEditor,
  onBack,
}: ArchivePageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [panel, setPanel] = useState<"browser" | "reader">("browser");
  const [currentFilename, setCurrentFilename] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyNew, setOnlyNew] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "volume">(
    "volume"
  );
  const [collapsedVolumes, setCollapsedVolumes] = useState<Set<string>>(
    new Set()
  );

  // Load archives
  const loadArchives = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files: { filename: string; path: string }[] = await api.get(
        `/novels/${projectId}/archives`
      );

      const items = await Promise.all(
        files.map(async (f) => {
          const ref = parseChapterRef(f.filename);
          if (!ref) {
            return buildArchiveItem(f.filename, null);
          }
          try {
            const chapter = await api.get(
              `/novels/${projectId}/chapters/${ref}`
            );
            return buildArchiveItem(f.filename, chapter);
          } catch {
            return buildArchiveItem(f.filename, null);
          }
        })
      );
      setArchives(sortArchives(items));
    } catch (e: any) {
      setError(e.message || "加载归档列表失败");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  // Filter and sort
  const processedArchives = useMemo(() => {
    let items = [...archives];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q)
      );
    }

    if (onlyNew) {
      items = items.filter((a) => a.isNew);
    }

    switch (sortOrder) {
      case "newest":
        items.sort((a, b) => {
          if (a.archiveDate === "—") return 1;
          if (b.archiveDate === "—") return -1;
          return (
            new Date(b.archiveDate).getTime() -
            new Date(a.archiveDate).getTime()
          );
        });
        break;
      case "oldest":
        items.sort((a, b) => {
          if (a.archiveDate === "—") return 1;
          if (b.archiveDate === "—") return -1;
          return (
            new Date(a.archiveDate).getTime() -
            new Date(b.archiveDate).getTime()
          );
        });
        break;
      case "volume":
        items = sortArchives(items);
        break;
    }

    return items;
  }, [archives, searchQuery, onlyNew, sortOrder]);

  const volumeGroups = useMemo(
    () => groupByVolume(processedArchives),
    [processedArchives]
  );

  // Navigation handlers
  const handleRead = useCallback((filename: string) => {
    setCurrentFilename(filename);
    setPanel("reader");
  }, []);

  const handleBackToBrowser = useCallback(() => {
    setPanel("browser");
    setCurrentFilename(null);
  }, []);

  const sortedForNav = useMemo(() => sortArchives(archives), [archives]);

  const currentIndex = useMemo(() => {
    if (!currentFilename) return -1;
    return sortedForNav.findIndex((a) => a.filename === currentFilename);
  }, [sortedForNav, currentFilename]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentFilename(sortedForNav[currentIndex - 1].filename);
    }
  }, [currentIndex, sortedForNav]);

  const handleNext = useCallback(() => {
    if (currentIndex < sortedForNav.length - 1) {
      setCurrentFilename(sortedForNav[currentIndex + 1].filename);
    }
  }, [currentIndex, sortedForNav]);

  const currentItem =
    currentIndex >= 0 ? sortedForNav[currentIndex] : null;

  const toggleVolume = useCallback((volKey: string) => {
    setCollapsedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volKey)) {
        next.delete(volKey);
      } else {
        next.add(volKey);
      }
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Reader view
  // -----------------------------------------------------------------------

  if (panel === "reader" && currentFilename) {
    return (
      <ArchiveReader
        key={currentFilename}
        projectId={projectId}
        filename={currentFilename}
        chapterRef={currentItem?.chapterRef ?? ""}
        volume={currentItem?.volume}
        chapter={currentItem?.chapter}
        title={currentItem?.title}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < sortedForNav.length - 1}
        onPrev={handlePrev}
        onNext={handleNext}
        onBack={handleBackToBrowser}
        onEdit={onNavigateToEditor}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Browser view: Loading skeleton
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        {[1, 2].map((g) => (
          <div key={g}>
            <div className="skeleton h-5 w-32 mb-3" />
            {[1, 2].map((c) => (
              <div
                key={c}
                className="border border-base-300 rounded-lg p-3.5 mb-2"
              >
                <div className="flex justify-between mb-2">
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-3 w-16" />
                </div>
                <div className="skeleton h-3 w-full mb-2" />
                <div className="skeleton h-3 w-3/4 mb-3" />
                <div className="flex gap-2">
                  <div className="skeleton h-7 w-14" />
                  <div className="skeleton h-7 w-14" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Browser view: Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
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

  // -----------------------------------------------------------------------
  // Browser view: Empty state (no archives at all)
  // -----------------------------------------------------------------------

  if (archives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5">
        <BookMarked className="w-16 h-16 opacity-30 text-base-content/40" />
        <h2 className="text-xl font-serif text-base-content">
          还没有已归档的章节
        </h2>
        <p className="text-sm text-base-content/50 max-w-sm text-center">
          完成写作后点击&ldquo;归档&rdquo;按钮，章节会出现在这里
        </p>
        <button onClick={onBack} className="btn btn-primary btn-sm">
          回到正文
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Browser view: Normal
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn btn-ghost btn-sm gap-1 text-base-content/60 hover:text-base-content"
          >
            <ArrowLeft className="w-4 h-4" />
            返回项目
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-base-content/40" />
          <h2 className="text-base font-medium text-base-content">
            归档
          </h2>
          <span className="badge badge-ghost badge-sm">
            {archives.length}章
          </span>
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="join flex-1">
          <div className="join-item flex items-center pl-3 text-base-content/30">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            placeholder="搜索章节标题..."
            className="input input-bordered input-sm join-item w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="join-item btn btn-ghost btn-xs px-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-base-content/50 cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={onlyNew}
            onChange={(e) => setOnlyNew(e.target.checked)}
          />
          新归档
        </label>
        <select
          value={sortOrder}
          onChange={(e) =>
            setSortOrder(e.target.value as "newest" | "oldest" | "volume")
          }
          className="select select-bordered select-sm text-xs max-w-[120px]"
        >
          <option value="volume">按卷排序</option>
          <option value="newest">按时间降序</option>
          <option value="oldest">按时间升序</option>
        </select>
      </div>

      {/* No search results */}
      {processedArchives.length === 0 && searchQuery && (
        <div className="text-center py-10 text-sm text-base-content/40">
          没有找到匹配 &ldquo;{searchQuery}&rdquo; 的章节
        </div>
      )}

      {processedArchives.length === 0 && onlyNew && !searchQuery && (
        <div className="text-center py-10 text-sm text-base-content/40">
          没有新归档的章节
        </div>
      )}

      {/* Volume groups */}
      {volumeGroups.map((group) => {
        const volKey = `vol-${group.volume}`;
        const isCollapsed = collapsedVolumes.has(volKey);

        return (
          <div key={volKey} className="mb-4">
            <button
              onClick={() => toggleVolume(volKey)}
              className="w-full flex items-center gap-2 py-1.5 text-xs uppercase tracking-wider text-base-content/40 font-medium hover:text-base-content/60 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              第{group.volume}卷
              <span className="badge badge-ghost badge-xs">
                {group.items.length}章
              </span>
            </button>

            {!isCollapsed && (
              <div className="space-y-2 mt-1">
                {group.items.map((item) => (
                  <ArchiveCard
                    key={item.filename}
                    title={item.title}
                    wordCount={item.wordCount}
                    archiveDate={item.archiveDate}
                    summary={item.summary}
                    isNew={item.isNew}
                    onRead={() => handleRead(item.filename)}
                    onEdit={() => onNavigateToEditor(item.chapterRef)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
