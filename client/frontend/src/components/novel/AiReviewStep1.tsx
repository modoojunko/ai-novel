import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Step1Result } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Sparkles, Loader2, AlertCircle, RefreshCw, ChevronDown, Info } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiReviewStep1Props {
  novelId: string;
  onComplete: (step1Result: Step1Result) => void;
  onBack: () => void;
}

type CategoryStatus = 'pending' | 'loading' | 'success' | 'error';

interface ApiStatus {
  synopsis: CategoryStatus;
  world_style: CategoryStatus;
  characters: CategoryStatus;
}

interface CategoryData {
  synopsis: string;
  genre_profile: string;
  world_setting: Record<string, any>;
  writing_style: Record<string, any>;
  characters: Array<{ name: string; role: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function countCompleted(status: ApiStatus): number {
  let n = 0;
  if (status.synopsis === 'success') n++;
  if (status.world_style === 'success') n++;
  if (status.characters === 'success') n++;
  return n;
}

function CollapseSection({ title, defaultOpen, children }: {
  title: string; defaultOpen: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapse collapse-arrow border border-base-300/60 rounded-lg bg-base-200/30">
      <input type="checkbox" checked={open} onChange={() => setOpen(!open)} className="min-h-0" />
      <div className="collapse-title min-h-0 py-3 px-4 text-sm font-medium flex items-center gap-2">
        {title}
      </div>
      <div className="collapse-content px-4 pb-4">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AiReviewStep1({ novelId, onComplete, onBack }: AiReviewStep1Props) {
  const [status, setStatus] = useState<ApiStatus>({
    synopsis: 'pending',
    world_style: 'pending',
    characters: 'pending',
  });
  const [data, setData] = useState<CategoryData | null>(null);
  const [truncated, setTruncated] = useState(false);

  // Store latest data for retry merging
  const latestData = useRef<CategoryData | null>(null);

  // Abort controllers for each category
  const abortRef = useRef<{ synopsis?: AbortController; world_style?: AbortController; characters?: AbortController }>({});

  // -----------------------------------------------------------------------
  // Fetch helper — calls the same endpoint but tracks per-category
  // -----------------------------------------------------------------------

  const fetchCategory = useCallback(async (category: keyof ApiStatus) => {
    // Abort previous request for this category
    abortRef.current[category]?.abort();
    const controller = new AbortController();
    abortRef.current[category] = controller;

    setStatus(prev => ({ ...prev, [category]: 'loading' }));

    try {
      const result: Step1Result = await api.post(`/novels/${novelId}/ai-backfill/step1`);

      if (controller.signal.aborted) return;

      // Merge into accumulated data
      const merged: CategoryData = {
        synopsis: result.synopsis || latestData.current?.synopsis || '',
        genre_profile: result.genre_profile || latestData.current?.genre_profile || '',
        world_setting: result.world_setting || latestData.current?.world_setting || {},
        writing_style: result.writing_style || latestData.current?.writing_style || {},
        characters: result.characters || latestData.current?.characters || [],
      };
      latestData.current = merged;
      setData(merged);
      if (result.truncated) setTruncated(true);

      // Mark only this category as success — if other categories already have
      // data from a previous response they keep success too, but the current
      // category is explicitly success
      setStatus(prev => {
        const next = { ...prev };
        next[category] = 'success';
        // Infer sister categories from same response
        if (result.synopsis) next.synopsis = 'success';
        if (result.world_setting || result.writing_style) next.world_style = 'success';
        if (result.characters && result.characters.length > 0) next.characters = 'success';
        return next;
      });
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setStatus(prev => ({ ...prev, [category]: 'error' }));
    }
  }, [novelId]);

  // -----------------------------------------------------------------------
  // Initial fetch — start all three in parallel
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Start all categories
    fetchCategory('synopsis');
    fetchCategory('world_style');
    fetchCategory('characters');

    return () => {
      // Cleanup: abort all on unmount
      abortRef.current.synopsis?.abort();
      abortRef.current.world_style?.abort();
      abortRef.current.characters?.abort();
    };
  }, [fetchCategory]);

  // -----------------------------------------------------------------------
  // Edit handlers
  // -----------------------------------------------------------------------

  const updateSynopsis = useCallback((v: string) => {
    setData(prev => prev ? { ...prev, synopsis: v } : null);
  }, []);

  const updateGenreProfile = useCallback((v: string) => {
    setData(prev => prev ? { ...prev, genre_profile: v } : null);
  }, []);

  const updateWorldSetting = useCallback((key: string, value: string) => {
    setData(prev => {
      if (!prev) return null;
      return { ...prev, world_setting: { ...prev.world_setting, [key]: value } };
    });
  }, []);

  const updateWritingStyle = useCallback((key: string, value: string) => {
    setData(prev => {
      if (!prev) return null;
      return { ...prev, writing_style: { ...prev.writing_style, [key]: value } };
    });
  }, []);

  const updateCharacter = useCallback((index: number, field: 'name' | 'role' | 'description', value: string) => {
    setData(prev => {
      if (!prev) return null;
      const chars = [...prev.characters];
      if (chars[index]) {
        chars[index] = { ...chars[index], [field]: value };
      }
      return { ...prev, characters: chars };
    });
  }, []);

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const completedCount = countCompleted(status);
  const allSuccess = completedCount === 3;
  const loading = status.synopsis === 'loading' || status.world_style === 'loading' || status.characters === 'loading';

  const statusLabel = allSuccess
    ? '3/3 完成'
    : `${completedCount}/3 完成`;

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  function renderStatusCard(category: keyof ApiStatus, label: string) {
    const s = status[category];
    return (
      <div className={`flex-1 border rounded-lg px-3 py-2.5 text-xs ${
        s === 'success' ? 'border-success/30 bg-success/5' :
        s === 'loading' ? 'border-info/30 bg-info/5' :
        s === 'error' ? 'border-error/30 bg-error/5' :
        'border-base-300/40 bg-base-200/30'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-base-content/60">{label}</span>
          {s === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-info" />}
          {s === 'success' && <span className="text-success text-xs">完成</span>}
          {s === 'error' && <AlertCircle className="w-3 h-3 text-error" />}
          {s === 'pending' && <span className="text-base-content/20">待开始</span>}
        </div>
      </div>
    );
  }

  function renderRetryButton(category: keyof ApiStatus) {
    if (status[category] !== 'error') return null;
    return (
      <button
        onClick={() => fetchCategory(category)}
        className="btn btn-ghost btn-xs text-error gap-1"
      >
        <RefreshCw className="w-3 h-3" />
        重试
      </button>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Truncated banner */}
      {truncated && (
        <div className="alert alert-info text-xs py-2">
          <Info className="w-4 h-4" />
          <span>你的稿子较长，AI 仅分析了最近 5 万字</span>
        </div>
      )}

      {/* Top status bar */}
      <div className="flex items-center gap-3">
        {renderStatusCard('synopsis', '简介/类型')}
        {renderStatusCard('world_style', '世界/风格')}
        {renderStatusCard('characters', '角色表')}
        <span className="text-xs text-base-content/40 whitespace-nowrap">{statusLabel}</span>
      </div>

      {/* Loading overlay */}
      {!allSuccess && loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-xs text-base-content/40">AI 正在分析你的稿子…</p>
          </div>
        </div>
      )}

      {/* Error state — all failed */}
      {completedCount === 0 && !loading && (
        <div className="text-center py-8 space-y-3">
          <AlertCircle className="w-8 h-8 text-error/60 mx-auto" />
          <p className="text-sm text-base-content/50">AI 分析失败</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => { fetchCategory('synopsis'); fetchCategory('world_style'); fetchCategory('characters'); }} className="btn btn-primary btn-sm">
              <RefreshCw className="w-3 h-3" />
              全部重试
            </button>
          </div>
        </div>
      )}

      {/* Merged review sections */}
      {data && completedCount > 0 && (
        <div className="space-y-3">
          {/* Synopsis + Genre */}
          <CollapseSection title="简介 / 类型" defaultOpen={true}>
            {status.synopsis === 'error' ? (
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-error/60">生成失败</span>
                {renderRetryButton('synopsis')}
              </div>
            ) : status.synopsis === 'loading' ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-info" />
                <span className="text-xs text-base-content/40">生成中…</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={data ? 'border-l-2 border-primary/30 pl-3' : ''}>
                  <label className="text-xs text-base-content/60 font-medium block tracking-wide flex items-center gap-1 mb-1">
                    小说简介
                    <Sparkles className="w-3 h-3 text-primary/40" />
                  </label>
                  <textarea
                    className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 resize-y min-h-[80px]"
                    value={data.synopsis}
                    onChange={(e) => updateSynopsis(e.target.value)}
                  />
                </div>
                <div className="border-l-2 border-primary/30 pl-3">
                  <label className="text-xs text-base-content/60 font-medium block tracking-wide flex items-center gap-1 mb-1">
                    类型设定
                    <Sparkles className="w-3 h-3 text-primary/40" />
                  </label>
                  <textarea
                    className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 resize-y min-h-[60px]"
                    value={data.genre_profile}
                    onChange={(e) => updateGenreProfile(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CollapseSection>

          {/* World setting + Writing style */}
          <CollapseSection title="世界设定 / 写作风格" defaultOpen={true}>
            {status.world_style === 'error' ? (
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-error/60">生成失败</span>
                {renderRetryButton('world_style')}
              </div>
            ) : status.world_style === 'loading' ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-info" />
                <span className="text-xs text-base-content/40">生成中…</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border-l-2 border-primary/30 pl-3">
                  <label className="text-xs text-base-content/60 font-medium block tracking-wide flex items-center gap-1 mb-1">
                    世界设定
                    <Sparkles className="w-3 h-3 text-primary/40" />
                  </label>
                  <div className="space-y-2">
                    {Object.entries(data.world_setting).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-base-content/40 w-20 shrink-0">{key}</span>
                        <input
                          className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60"
                          value={String(val || '')}
                          onChange={(e) => updateWorldSetting(key, e.target.value)}
                        />
                      </div>
                    ))}
                    {Object.keys(data.world_setting).length === 0 && (
                      <p className="text-xs text-base-content/30 italic">暂无世界设定内容</p>
                    )}
                  </div>
                </div>
                <div className="border-l-2 border-primary/30 pl-3">
                  <label className="text-xs text-base-content/60 font-medium block tracking-wide flex items-center gap-1 mb-1">
                    写作风格
                    <Sparkles className="w-3 h-3 text-primary/40" />
                  </label>
                  <div className="space-y-2">
                    {Object.entries(data.writing_style).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-base-content/40 w-20 shrink-0">{key}</span>
                        <input
                          className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60"
                          value={String(val || '')}
                          onChange={(e) => updateWritingStyle(key, e.target.value)}
                        />
                      </div>
                    ))}
                    {Object.keys(data.writing_style).length === 0 && (
                      <p className="text-xs text-base-content/30 italic">暂无写作风格内容</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CollapseSection>

          {/* Characters */}
          <CollapseSection title={`角色表（${data.characters.length} 个）`} defaultOpen={true}>
            {status.characters === 'error' ? (
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-error/60">生成失败</span>
                {renderRetryButton('characters')}
              </div>
            ) : status.characters === 'loading' ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-info" />
                <span className="text-xs text-base-content/40">生成中…</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data.characters.length === 0 ? (
                  <p className="text-xs text-base-content/30 italic">未识别到角色</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-xs">
                      <thead>
                        <tr className="text-base-content/40">
                          <th>姓名</th>
                          <th>角色</th>
                          <th className="w-full">描述</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.characters.map((ch, i) => (
                          <tr key={i} className="hover:bg-base-200/40">
                            <td>
                              <input
                                className="w-24 bg-transparent border-b border-transparent hover:border-base-300/40 focus:border-primary/40 text-sm outline-none px-1"
                                value={ch.name}
                                onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="w-20 bg-transparent border-b border-transparent hover:border-base-300/40 focus:border-primary/40 text-sm outline-none px-1"
                                value={ch.role}
                                onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="w-full bg-transparent border-b border-transparent hover:border-base-300/40 focus:border-primary/40 text-sm outline-none px-1"
                                value={ch.description}
                                onChange={(e) => updateCharacter(i, 'description', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CollapseSection>
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-2 border-t border-base-300/40">
        <button onClick={onBack} className="btn btn-ghost btn-sm">
          返回
        </button>
        <button
          onClick={() => data && onComplete({
            synopsis: data.synopsis,
            genre_profile: data.genre_profile,
            world_setting: data.world_setting,
            writing_style: data.writing_style,
            characters: data.characters,
            truncated,
          })}
          disabled={!allSuccess}
          className="btn btn-primary btn-sm"
        >
          {allSuccess ? '确认并继续至大纲' : '等待 AI 分析…'}
        </button>
      </div>
    </div>
  );
}
