// ── GenrePickerModal ──────────────────────────────────────────────────────
// Modal for selecting a novel genre from the global genre library.
// 打开时从后端拉全量题材（含自定义），内存分组/搜索；预置只读，自定义可编辑/删除。
// Uses daisyUI modal pattern (modal modal-open + modal-box).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Check,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  GENRE_CATEGORIES,
  fetchGenres,
  deleteGenre,
  genreIcon,
  type GenreCategory,
  type GenreDefinition,
} from "@/data/genres";
import GenreEditModal from "./GenreEditModal";
import DeleteConfirmModal from "../DeleteConfirmModal";

// ── Props ────────────────────────────────────────────────────────────────

interface GenrePickerModalProps {
  open: boolean;
  /** Currently selected genre id */
  currentGenreId?: string;
  /** Called when user confirms a genre selection */
  onConfirm: (genreId: string) => void;
  /** Called when modal is dismissed without saving */
  onClose: () => void;
}

interface DeleteError {
  message: string;
  projects?: string[];
}

// ── Component ────────────────────────────────────────────────────────────

export default function GenrePickerModal({
  open,
  currentGenreId,
  onConfirm,
  onClose,
}: GenrePickerModalProps) {
  const [genres, setGenres] = useState<GenreDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState<GenreCategory>("urban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(currentGenreId);

  // CRUD sessions
  const [editSession, setEditSession] = useState<
    { mode: "create" } | { mode: "edit"; genre: GenreDefinition } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<GenreDefinition | null>(null);
  const [deleteError, setDeleteError] = useState<DeleteError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setGenres(await fetchGenres());
    } catch (e: any) {
      setLoadError(e.message || "加载题材失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedId(currentGenreId);
      setSearchQuery("");
      setDeleteError(null);
      refresh();
    }
  }, [open, currentGenreId, refresh]);

  const currentGenre = useMemo(
    () => (selectedId ? genres.find((g) => g.id === selectedId) : undefined),
    [genres, selectedId],
  );

  // Filter based on search or selected category
  const displayedGenres = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return genres.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.category.includes(q),
      );
    }
    return genres.filter((g) => g.category === category);
  }, [genres, category, searchQuery]);

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm(selectedId);
    }
    onClose();
  };

  // ── Create / edit ────────────────────────────────────────────────
  const handleSaved = async (saved: GenreDefinition) => {
    setEditSession(null);
    setSelectedId(saved.id);
    await refresh();
  };

  // ── Delete ───────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteGenre(deleteTarget.id);
      setGenres((gs) => gs.filter((g) => g.id !== deleteTarget.id));
      setSelectedId((s) => (s === deleteTarget.id ? undefined : s));
      setDeleteTarget(null);
    } catch (e: any) {
      // 409 时 e.projects 已由 request() 透传
      setDeleteTarget(null);
      setDeleteError({ message: e.message || "删除失败", projects: e?.projects });
    }
  };

  if (!open) return null;

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-2xl p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-serif font-semibold text-base-content">
            选择题材
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditSession({ mode: "create" })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 border border-primary/30 text-primary rounded-lg font-medium hover:bg-primary/20 transition-all duration-200"
            >
              <Plus className="w-3.5 h-3.5" />
              新建题材
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Search ────────────────────────────────────────────── */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
            <input
              type="text"
              placeholder="搜索题材..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-base-200/40 border border-base-300/60 rounded-lg pl-9 pr-3.5 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/20 hover:text-base-content/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Delete error banner ───────────────────────────────── */}
        {deleteError && (
          <div className="px-6 pb-3">
            <div className="flex items-start gap-2 bg-error/10 border border-error/25 rounded-lg px-3.5 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-error/90 leading-relaxed">{deleteError.message}</p>
                {deleteError.projects && deleteError.projects.length > 0 && (
                  <p className="text-xs text-error/70 mt-1">
                    使用该题材的作品：{deleteError.projects.join("、")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDeleteError(null)}
                className="text-error/50 hover:text-error transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── Body: two-column layout ────────────────────────────── */}
        <div className="flex border-t border-base-300/60 min-h-[340px]">
          {/* Left: Category navigation */}
          <nav className="w-36 flex-shrink-0 border-r border-base-300/60 bg-base-200/20 py-2">
            {GENRE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.id);
                  setSearchQuery("");
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  category === cat.id && !searchQuery
                    ? "text-primary font-medium bg-primary/5 border-r-2 border-primary"
                    : "text-base-content/50 hover:text-base-content hover:bg-base-200/40"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>

          {/* Right: Genre list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {loading ? (
              <div className="flex justify-center py-16">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            ) : loadError ? (
              <div className="flex items-center justify-center h-48 text-sm text-error/70 px-6 text-center">
                {loadError}
              </div>
            ) : displayedGenres.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-base-content/30">
                没有匹配的题材
              </div>
            ) : (
              displayedGenres.map((genre) => {
                const isSelected = selectedId === genre.id;
                const Icon = genreIcon(genre);
                return (
                  <div
                    key={genre.id}
                    className={`group flex items-center gap-1 rounded-lg transition-all duration-150 ${
                      isSelected
                        ? "bg-primary/10 border border-primary/25"
                        : "border border-transparent hover:bg-base-200/50 hover:border-base-300/40"
                    }`}
                  >
                    <button
                      onClick={() => setSelectedId(genre.id)}
                      className="flex-1 min-w-0 flex items-start gap-3 px-3 py-2.5 text-left"
                    >
                      {/* Icon */}
                      <span
                        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-primary/20 text-primary"
                            : "bg-base-200/60 text-base-content/40 group-hover:text-base-content/70"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>

                      {/* Name + Description */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              isSelected ? "text-primary" : "text-base-content/80"
                            }`}
                          >
                            {genre.name}
                          </span>
                          {genre.isPreset && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-base-200/60 text-base-content/40 border border-base-300/40">
                              预置
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-primary">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-base-content/40 leading-relaxed mt-0.5 line-clamp-2">
                          {genre.description}
                        </p>
                      </div>
                    </button>

                    {/* ── Custom genre actions (hover) ─────────── */}
                    {!genre.isPreset && (
                      <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditSession({ mode: "edit", genre })}
                          title="编辑题材"
                          className="p-1.5 rounded-md text-base-content/30 hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(genre)}
                          title="删除题材"
                          className="p-1.5 rounded-md text-base-content/30 hover:text-error hover:bg-error/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Arrow hint for selected */}
                    {isSelected && (
                      <ChevronRight className="w-4 h-4 shrink-0 mr-2 text-primary/60" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Footer: selected preview ───────────────────────────── */}
        <div className="px-6 py-4 border-t border-base-300/60 bg-base-200/20">
          {currentGenre ? (
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-base-content">
                    {currentGenre.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/80">
                    {GENRE_CATEGORIES.find((c) => c.id === currentGenre.category)
                      ?.label ?? ""}
                  </span>
                </div>
                <p className="text-xs text-base-content/50 leading-relaxed">
                  <span className="text-base-content/60 font-medium">叙事者：</span>
                  {currentGenre.narratorRole}
                </p>
                <p className="text-xs text-base-content/40 leading-relaxed mt-0.5">
                  <span className="text-base-content/50 font-medium">典型故事弧：</span>
                  {currentGenre.typicalArc}
                </p>
              </div>
              <button
                onClick={handleConfirm}
                disabled={!selectedId}
                className="shrink-0 px-5 py-2 text-sm font-medium bg-primary text-primary-content rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                应用题材
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-base-content/30">
                从左侧选择一个题材
              </p>
              <button
                onClick={handleConfirm}
                disabled={!selectedId}
                className="shrink-0 px-5 py-2 text-sm font-medium bg-primary text-primary-content rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                应用题材
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="modal-backdrop" onClick={onClose} />

      {/* ── Create / edit modal ─────────────────────────────────── */}
      {editSession && (
        <GenreEditModal
          genre={editSession.mode === "edit" ? editSession.genre : null}
          onClose={() => setEditSession(null)}
          onSaved={handleSaved}
        />
      )}

      {/* ── Delete confirm modal ────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="题材"
          confirmText={deleteTarget.name}
          description="该题材定义将被永久删除。正在使用它的作品会进入「定义缺失」降级态（覆盖项仍可保存），但无法再获得该题材的完整设定。"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
