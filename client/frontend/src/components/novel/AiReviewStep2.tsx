import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Step1Result } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Loader2, RefreshCw, AlertCircle, ChevronDown, Book } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiReviewStep2Props {
  novelId: string;
  step1Result: Step1Result;
  onComplete: () => void;
  onBack: () => void;
}

interface OutlineVolume {
  title: string;
  summary?: string;
  chapters: OutlineChapter[];
}

interface OutlineChapter {
  title: string;
  summary?: string;
  ref: string;
}

interface Step2Result {
  volumes: OutlineVolume[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countItems(result: Step1Result): string {
  const parts: string[] = [];
  if (result.synopsis) parts.push('简介');
  if (result.genre_profile) parts.push('类型');
  if (result.characters && result.characters.length > 0) {
    parts.push(`角色表(${result.characters.length}个)`);
  }
  if (result.world_setting && Object.keys(result.world_setting).length > 0) {
    parts.push('世界设定');
  }
  if (result.writing_style && Object.keys(result.writing_style).length > 0) {
    parts.push('写作风格');
  }
  return parts.map(p => `✓ ${p}`).join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AiReviewStep2({ novelId, step1Result, onComplete, onBack }: AiReviewStep2Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<OutlineVolume[]>([]);
  const [expandedVols, setExpandedVols] = useState<Set<number>>(() => new Set([0]));
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Context summary
  const contextSummary = countItems(step1Result);

  // -----------------------------------------------------------------------
  // Fetch outline
  // -----------------------------------------------------------------------

  const fetchOutline = useCallback(async (volumeIndex?: number) => {
    if (volumeIndex !== undefined) {
      setRegenerating(volumeIndex);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result: Step2Result = await api.aiBackfillStep2(novelId, step1Result);
      const vols = result.volumes || [];

      if (volumeIndex !== undefined) {
        // Replace only the regenerated volume
        setVolumes(prev => {
          const next = [...prev];
          if (vols[volumeIndex]) {
            next[volumeIndex] = vols[volumeIndex];
          }
          return next;
        });
      } else {
        setVolumes(vols);
      }
    } catch (err: any) {
      setError(err.message || '生成大纲失败');
    } finally {
      setLoading(false);
      setRegenerating(null);
    }
  }, [novelId, step1Result]);

  useEffect(() => {
    fetchOutline();
  }, [fetchOutline]);

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Save each volume/chapter outline to the server
      for (const vol of volumes) {
        for (const ch of vol.chapters) {
          await api.put(`/novels/${novelId}/chapters/${ch.ref}`, {
            outline: {
              summary: ch.summary || '',
            },
            title: ch.title,
          });
        }
        // TODO: save volume-level data if needed
      }
      toast.success('大纲已保存');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [novelId, volumes, onComplete]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <p className="text-sm text-base-content/50">AI 正在生成大纲…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <div className="flex justify-center">
          <button onClick={() => fetchOutline()} className="btn btn-primary btn-sm">
            <RefreshCw className="w-3 h-3" />
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Context summary banner */}
      <div className="alert bg-base-200/50 border border-base-300/40 text-xs py-2">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-base-content/50">AI 将根据以下设定生成大纲：</span>
          <span className="text-base-content/70">{contextSummary}</span>
        </div>
      </div>

      {/* Outline list */}
      {volumes.length === 0 ? (
        <div className="text-center py-8 text-sm text-base-content/40">
          <Book className="w-8 h-8 mx-auto mb-2 text-base-content/20" />
          <p>未生成大纲内容。请重试。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {volumes.map((vol, vi) => (
            <div
              key={vi}
              className="border border-base-300/50 rounded-lg bg-base-200/20 overflow-hidden"
            >
              {/* Volume header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-base-200/40 transition-colors"
                onClick={() => setExpandedVols(prev => {
                  const next = new Set(prev);
                  if (next.has(vi)) next.delete(vi);
                  else next.add(vi);
                  return next;
                })}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown className={`w-4 h-4 text-base-content/30 transition-transform duration-200 ${
                    expandedVols.has(vi) ? 'rotate-0' : '-rotate-90'
                  }`} />
                  <Book className="w-4 h-4 text-primary/60" />
                  <span className="text-sm font-medium">{vol.title || `第${vi + 1}卷`}</span>
                  {vol.summary && (
                    <span className="text-xs text-base-content/40 ml-2 truncate max-w-[200px]">
                      {vol.summary}
                    </span>
                  )}
                  <span className="text-xs text-base-content/30">({vol.chapters.length}章)</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); fetchOutline(vi); }}
                  disabled={regenerating === vi}
                  className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content/70"
                  title="重新生成本卷大纲"
                >
                  {regenerating === vi ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  重新生成
                </button>
              </div>

              {/* Chapters list */}
              {expandedVols.has(vi) && (
                <div className="border-t border-base-300/30 divide-y divide-base-300/20">
                  {vol.chapters.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-base-content/30 italic">
                      本章无章节内容
                    </div>
                  ) : (
                    vol.chapters.map((ch, ci) => (
                      <div key={ci} className="px-4 py-3 pl-10">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {ch.title || `第${ci + 1}章`}
                          </span>
                        </div>
                        {ch.summary && (
                          <p className="text-xs text-base-content/50 mt-1 leading-relaxed line-clamp-2">
                            {ch.summary}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-2 border-t border-base-300/40">
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          返回
        </button>
        <button
          onClick={handleSave}
          disabled={saving || volumes.length === 0}
          className="btn btn-primary btn-sm"
        >
          {saving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              保存中…
            </>
          ) : (
            '全部保存并开始写作'
          )}
        </button>
      </div>
    </div>
  );
}
