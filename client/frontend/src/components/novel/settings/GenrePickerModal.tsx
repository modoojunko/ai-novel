// ── GenrePickerModal ──────────────────────────────────────────────────────
// Modal for selecting novel genre from 24 types across 6 categories.
// Uses daisyUI modal pattern (modal modal-open + modal-box).

import { useState, useMemo } from "react";
import { Search, X, Check, ChevronRight, Sparkles } from "lucide-react";
import {
  GENRE_CATEGORIES,
  getGenresByCategory,
  searchGenres,
  getGenreById,
  type GenreCategory,
  type GenreDefinition,
} from "@/data/genres";

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

// ── Component ────────────────────────────────────────────────────────────

export default function GenrePickerModal({
  open,
  currentGenreId,
  onConfirm,
  onClose,
}: GenrePickerModalProps) {
  const [category, setCategory] = useState<GenreCategory>("urban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(currentGenreId);

  const currentGenre = selectedId ? getGenreById(selectedId) : undefined;

  // Filter genres based on search or selected category
  const displayedGenres = useMemo(() => {
    if (searchQuery.trim()) {
      return searchGenres(searchQuery);
    }
    return getGenresByCategory(category);
  }, [category, searchQuery]);

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm(selectedId);
    }
    onClose();
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
          <button
            onClick={onClose}
            className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          >
            <X className="w-4 h-4" />
          </button>
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
            {displayedGenres.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-base-content/30">
                没有匹配的题材
              </div>
            ) : (
              displayedGenres.map((genre) => {
                const isSelected = selectedId === genre.id;
                const Icon = genre.icon;
                return (
                  <button
                    key={genre.id}
                    onClick={() => setSelectedId(genre.id)}
                    className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                      isSelected
                        ? "bg-primary/10 border border-primary/25"
                        : "border border-transparent hover:bg-base-200/50 hover:border-base-300/40"
                    }`}
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

                    {/* Arrow hint */}
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 mt-1 transition-opacity ${
                        isSelected
                          ? "text-primary/60"
                          : "text-base-content/10 group-hover:text-base-content/30"
                      }`}
                    />
                  </button>
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
    </div>
  );
}
