import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import * as Story from "@/lib/story";
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  StepForward,
  Rewind,
  Square,
  Settings2,
  Clock,
  GitBranch,
  Sigma,
  FileText,
  Redo,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import type { SelectionCapture } from "@/lib/selection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RightToolbarProps {
  projectId: string;
  chapterRef: string;
  // AI Writing
  hasSelection: boolean;
  selectedText: string;
  onContinue: () => void;
  onPolish: (capture: SelectionCapture) => void;
  onExpand: (capture: SelectionCapture) => void;
  captureNow: () => SelectionCapture | null;
  continueLoading: boolean;
  polishLoading: boolean;
  expandLoading: boolean;
}

interface Version {
  version: string;
  time: number;
  comment: string;
  isCurrent: boolean;
}

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-base-200/80">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3.5 py-2.5 text-sm hover:bg-base-200/30 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-base-content/80">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-base-content/30" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-base-content/30" />
        )}
      </button>
      {open && <div className="px-3.5 pb-3.5">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RightToolbar
// ---------------------------------------------------------------------------

export default function RightToolbar({
  projectId,
  chapterRef,
  hasSelection,
  selectedText,
  onContinue,
  onPolish,
  onExpand,
  captureNow,
  continueLoading,
  polishLoading,
  expandLoading,
}: RightToolbarProps) {
  // ---- Version list state ----
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);

  // ---- Deduction state (simplified - moved from DeductionPanel) ----
  const [deductionId, setDeductionId] = useState<string | null>(null);
  const [deductionRound, setDeductionRound] = useState(0);
  const [deductionLoading, setDeductionLoading] = useState(false);
  const [deductionMissing, setDeductionMissing] = useState<string[]>([]);

  // Word count - computed from editor (we'll show the chapterRef as placeholder)
  // In a real app, this would be passed from the editor state or fetched

  // -----------------------------------------------------------------------
  // Load versions
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!projectId || !chapterRef) return;
    setVersionsLoading(true);
    api
      .get(`/projects/${projectId}/chapters/${chapterRef}/versions`)
      .then((data: Version[]) => setVersions(data))
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false));
  }, [projectId, chapterRef]);

  // -----------------------------------------------------------------------
  // Deduction handlers
  // -----------------------------------------------------------------------

  const handleDeductionInit = useCallback(async () => {
    setDeductionLoading(true);
    try {
      const res = await Story.initDeduction(projectId, chapterRef);
      setDeductionId(res.deduction_id);
      setDeductionMissing(res.missing || []);
      if (!res.missing || res.missing.length === 0) {
        // Auto-seed with empty string
        await Story.setSeed(res.deduction_id, "");
        // Auto-run first round
        const result = await Story.runRound(res.deduction_id);
        setDeductionRound(result.round);
      }
    } catch {
      // ignore
    } finally {
      setDeductionLoading(false);
    }
  }, [projectId, chapterRef]);

  const handleDeductionNextRound = useCallback(async () => {
    if (!deductionId) return;
    setDeductionLoading(true);
    try {
      const result = await Story.runRound(deductionId);
      setDeductionRound(result.round);
    } catch {
      // ignore
    } finally {
      setDeductionLoading(false);
    }
  }, [deductionId]);

  const handleDeductionRewind = useCallback(async () => {
    if (!deductionId || deductionRound < 1) return;
    setDeductionLoading(true);
    try {
      await Story.rewind(deductionId, Math.max(0, deductionRound - 1));
      setDeductionRound((r) => Math.max(0, r - 1));
    } catch {
      // ignore
    } finally {
      setDeductionLoading(false);
    }
  }, [deductionId, deductionRound]);

  const handleDeductionStop = useCallback(async () => {
    setDeductionId(null);
    setDeductionRound(0);
  }, []);

  // -----------------------------------------------------------------------
  // Format time
  // -----------------------------------------------------------------------

  function formatTime(ts: number): string {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <aside className="w-64 flex-shrink-0 border-l border-base-200/80 bg-base-100/50 overflow-y-auto flex flex-col">
      {/* ── AI 写作 ────────────────────────────────────────────── */}
      <Section
        title="AI 写作"
        icon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
      >
        <div className="bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-900/5 rounded-lg p-3 space-y-2">
          <div className="text-xs text-base-content/50 leading-relaxed px-2 py-1.5 bg-base-100/80 border border-base-200/60 rounded font-serif border-l-2 border-l-amber-300/60">
            <span className="block text-[10px] font-sans text-base-content/40 font-medium mb-0.5">
              续写上下文
            </span>
            从当前光标位置继续写作
          </div>
          <button
            onClick={onContinue}
            disabled={false}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md hover:from-amber-600 hover:to-amber-700 transition-all active:scale-[0.98]"
          >
            {continueLoading ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                ⏹ 停止
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                继续写作
              </>
            )}
          </button>
          <div className="flex gap-2">
            {!hasSelection || polishLoading ? (
              <button
                disabled
                title={!hasSelection ? "请先选中文字" : undefined}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/30 cursor-not-allowed"
              >
                {polishLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                润色
              </button>
            ) : (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  const capture = captureNow();
                  if (capture) onPolish(capture);
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/60 hover:text-base-content hover:border-base-300 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                润色
              </button>
            )}
            {!hasSelection || expandLoading ? (
              <button
                disabled
                title={!hasSelection ? "请先选中文字" : undefined}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/30 cursor-not-allowed"
              >
                {expandLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <BookOpen className="w-3 h-3" />
                )}
                扩写
              </button>
            ) : (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  const capture = captureNow();
                  if (capture) onExpand(capture);
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/60 hover:text-base-content hover:border-base-300 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                扩写
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* ── 剧情推演 ──────────────────────────────────────────── */}
      <Section
        title="剧情推演"
        icon={<span className="text-base">💡</span>}
        defaultOpen={false}
      >
        <div className="space-y-2.5">
          {deductionId ? (
            <>
              {/* Status */}
              <div className="flex items-center justify-between px-3 py-2 bg-base-100 border border-base-200 rounded-lg">
                <span className="text-xs text-base-content/50">当前状态</span>
                <span className="text-xs text-green-600/80 font-medium">
                  已初始化 · 第 {deductionRound} 轮
                </span>
              </div>
              {/* Actions */}
              <div className="space-y-1.5">
                <button
                  onClick={handleDeductionNextRound}
                  disabled={deductionLoading}
                  className="w-full flex items-center justify-between px-3 py-2 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/70 hover:border-amber-300/50 hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-1.5">
                    <StepForward className="w-3.5 h-3.5" />
                    下一回合
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100/60 dark:bg-amber-900/20 text-amber-700/70 dark:text-amber-400/70 text-[10px] font-medium">
                    {deductionLoading ? "进行中" : "新回合"}
                  </span>
                </button>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleDeductionRewind}
                    disabled={deductionRound < 1 || deductionLoading}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/50 hover:text-base-content transition-colors disabled:opacity-30"
                  >
                    <Rewind className="w-3 h-3" />
                    回退
                  </button>
                  <button
                    onClick={handleDeductionStop}
                    disabled={deductionLoading}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-base-200 bg-base-100 rounded-lg text-xs text-base-content/50 hover:text-error transition-colors disabled:opacity-30"
                  >
                    <Square className="w-3 h-3" />
                    结束
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {deductionMissing.length > 0 && (
                <div className="text-xs text-amber-600/70 leading-relaxed px-1">
                  {deductionMissing.map((m, i) => (
                    <p key={i}>{m}</p>
                  ))}
                </div>
              )}
              <button
                onClick={handleDeductionInit}
                disabled={deductionLoading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-base-300 bg-base-100/50 rounded-lg text-xs text-base-content/50 hover:text-base-content hover:border-base-300 transition-colors disabled:opacity-40"
              >
                {deductionLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Settings2 className="w-3.5 h-3.5" />
                )}
                初始化推演
              </button>
            </>
          )}
        </div>
      </Section>

      {/* ── 版本历史 ──────────────────────────────────────────── */}
      <Section
        title="版本历史"
        icon={<GitBranch className="w-3.5 h-3.5 text-base-content/50" />}
        defaultOpen={false}
      >
        {versionsLoading ? (
          <div className="flex justify-center py-3">
            <span className="loading loading-spinner loading-xs text-primary" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-xs text-base-content/30 text-center py-3">
            暂无版本记录
          </div>
        ) : (
          <div className="space-y-0.5">
            {versions.slice(0, 5).map((v) => (
              <div
                key={v.version}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                  v.isCurrent
                    ? "bg-base-200/60 border border-base-200"
                    : "hover:bg-base-200/30 cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileText
                    className={`w-3 h-3 ${
                      v.isCurrent ? "text-amber-500" : "text-base-content/30"
                    }`}
                  />
                  <span
                    className={
                      v.isCurrent ? "text-base-content font-medium" : "text-base-content/60"
                    }
                  >
                    {v.version}
                  </span>
                </span>
                <span className="text-[10px] text-base-content/40">
                  {formatTime(v.time)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 字数统计 ──────────────────────────────────────────── */}
      <Section
        title="字数统计"
        icon={<Sigma className="w-3.5 h-3.5 text-base-content/50" />}
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2 bg-base-100 border border-base-200 rounded-lg text-center">
            <div className="font-serif text-lg font-bold text-base-content tabular-nums">
              —
            </div>
            <div className="text-[10px] text-base-content/40 mt-0.5">本章字数</div>
          </div>
          <div className="px-3 py-2 bg-base-100 border border-base-200 rounded-lg text-center">
            <div className="font-serif text-lg font-bold text-base-content tabular-nums">
              —
            </div>
            <div className="text-[10px] text-base-content/40 mt-0.5">全书总字数</div>
          </div>
          <div className="px-3 py-2 bg-base-100 border border-base-200 rounded-lg text-center">
            <div className="font-serif text-lg font-bold text-base-content tabular-nums">
              —
            </div>
            <div className="text-[10px] text-base-content/40 mt-0.5">本卷页数</div>
          </div>
          <div className="px-3 py-2 bg-base-100 border border-base-200 rounded-lg text-center">
            <div className="font-serif text-lg font-bold text-base-content tabular-nums">
              —
            </div>
            <div className="text-[10px] text-base-content/40 mt-0.5">今日新增</div>
          </div>
        </div>
      </Section>
    </aside>
  );
}
