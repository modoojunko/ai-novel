import { useReducer, useRef, useEffect, useState } from "react";
import { api, importPersist } from "@/lib/api";
import type { VolumeImportData } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Wand2, Loader2, Upload, AlertCircle, AlertTriangle, X } from "lucide-react";
import ImportPreviewTree from "./ImportPreviewTree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Suggestion {
  titles: string[];
  synopsis: string;
  genre_profile: string;
  genre_label: string;
  atmosphere: string;
  elements?: Record<string, string>;
  missing?: string[];
}

interface ImportPreviewVolume {
  name: string;
  chapters: { name: string; content_length: number }[];
}

interface ImportPreview {
  title: string;
  volumes: ImportPreviewVolume[];
}

type ModalStage =
  | "entry-fork"
  | "ai-greeting"
  | "ai-loading"
  | "ai-error"
  | "ai-results"
  | "manual"
  | "import-upload"
  | "import-parsing"
  | "import-error"
  | "import-size-error"
  | "import-preview";

type ModalAction =
  | { type: "SELECT_FORK"; fork: "ai" | "manual" | "import" }
  | { type: "SUBMIT_PREMISE" }
  | { type: "AI_SUCCESS"; data: Suggestion }
  | { type: "AI_ERROR" }
  | { type: "RETRY_AI" }
  | { type: "GO_MANUAL" }
  | { type: "GO_BACK" }
  | { type: "SET_PREMISE"; value: string }
  | { type: "SET_NAME"; value: string }
  | { type: "FILE_SELECTED"; size: number }
  | { type: "PARSE_START" }
  | { type: "PARSE_SUCCESS"; preview: ImportPreview }
  | { type: "PARSE_ERROR"; msg: string }
  | { type: "SIZE_ERROR" }
  | { type: "UPDATE_VOLUMES"; volumes: VolumeImportData[] }
  | { type: "CREATE_ERROR"; msg: string }
  | { type: "DISMISS" };

interface ModalState {
  stage: ModalStage;
  premise: string;
  name: string;
  selectedTitle: string;
  suggestion: Suggestion | null;
  errorMsg: string;
  importPreview: ImportPreview | null;
  importFileName: string;
  currentVolumes: VolumeImportData[];
}

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (novelId: string) => void;
  /** 'none' when user is on the free tier */
  tier?: string;
  /** Current novel count, for free-limit check */
  novelCount?: number;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const INITIAL: ModalState = {
  stage: "entry-fork",
  premise: "",
  name: "",
  selectedTitle: "",
  suggestion: null,
  errorMsg: "",
  importPreview: null,
  importFileName: "",
  currentVolumes: [],
};

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "SELECT_FORK": {
      const map: Record<string, ModalStage> = {
        ai: "ai-greeting",
        manual: "manual",
        import: "import-upload",
      };
      return { ...state, stage: map[action.fork] ?? "entry-fork" };
    }
    case "SUBMIT_PREMISE":
      return { ...state, stage: "ai-loading" };
    case "AI_SUCCESS":
      return {
        ...state,
        stage: "ai-results",
        suggestion: action.data,
        name: action.data.titles[0] ?? "",
        selectedTitle: action.data.titles[0] ?? "",
      };
    case "AI_ERROR":
      return { ...state, stage: "ai-error" };
    case "RETRY_AI":
      return { ...state, stage: "ai-loading" };
    case "GO_MANUAL":
      return { ...state, stage: "manual" };
    case "GO_BACK":
      return { ...state, stage: "entry-fork", errorMsg: "", importFileName: "", currentVolumes: [] };
    case "SET_PREMISE":
      return { ...state, premise: action.value };
    case "SET_NAME":
      return { ...state, name: action.value, selectedTitle: action.value };
    case "FILE_SELECTED":
      if (action.size > 10 * 1024 * 1024) {
        return { ...state, stage: "import-size-error" };
      }
      return state;
    case "PARSE_START":
      return { ...state, stage: "import-parsing" };
    case "PARSE_SUCCESS":
      return {
        ...state,
        stage: "import-preview",
        importPreview: action.preview,
        currentVolumes: action.preview.volumes.map(v => ({
          title: v.name,
          chapters: v.chapters.map(c => ({ title: c.name })),
        })),
      };
    case "PARSE_ERROR":
      return { ...state, stage: "import-error", errorMsg: action.msg };
    case "SIZE_ERROR":
      return { ...state, stage: "import-size-error" };
    case "UPDATE_VOLUMES":
      return { ...state, currentVolumes: action.volumes };
    case "CREATE_ERROR":
      return { ...state, errorMsg: action.msg };
    case "DISMISS":
      return { ...INITIAL };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateProjectModal({
  open,
  onClose,
  onCreated,
  tier,
  novelCount,
}: CreateProjectModalProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevStageRef = useRef<ModalStage>(state.stage);

  // Reset on open
  useEffect(() => {
    if (open) {
      dispatch({ type: "DISMISS" });
      setShowSkeleton(false);
      setSubmitting(false);
      fileRef.current = null;
    }
  }, [open]);

  // Focus first interactive element on stage change
  useEffect(() => {
    if (state.stage === prevStageRef.current) return;
    prevStageRef.current = state.stage;
    // Small delay to let the DOM settle after animation start
    const id = requestAnimationFrame(() => {
      const el = contentRef.current;
      if (!el) return;
      const first = el.querySelector<HTMLElement>(
        "input, textarea, button:not([disabled])",
      );
      first?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [state.stage]);

  // Simulate file parsing when entering import-parsing
  useEffect(() => {
    if (state.stage !== "import-parsing" || !fileRef.current) return;
    setShowSkeleton(false);
    const skeletonTimer = setTimeout(() => setShowSkeleton(true), 3000);
    const parseTimer = setTimeout(() => {
      // Placeholder: import parsing is not yet implemented on the backend
      dispatch({ type: "PARSE_ERROR", msg: "导入解析功能开发中，即将上线" });
      fileRef.current = null;
      setShowSkeleton(false);
    }, 2000);
    return () => {
      clearTimeout(skeletonTimer);
      clearTimeout(parseTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage]);

  // ---- Event handlers ----

  async function handleAiSuggest() {
    if (!state.premise.trim()) return;
    dispatch({ type: "SUBMIT_PREMISE" });
    setSubmitting(true);
    try {
      const res = await api.post("/ai/suggest-meta", { premise: state.premise });
      dispatch({ type: "AI_SUCCESS", data: res as Suggestion });
    } catch {
      dispatch({ type: "AI_ERROR" });
      toast.error("AI 建议失败，请重试或手动输入书名");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreate() {
    if (!state.name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const body: { name: string; synopsis?: string; genre_profile?: string } = { name: state.name.trim() };
      if (state.suggestion) {
        body.synopsis = state.suggestion.synopsis;
        body.genre_profile = state.suggestion.genre_profile;
      }
      const novel = await api.createNovel(body);
      toast.success(`「${novel.name}」已创建`);
      onCreated(novel.id);
    } catch {
      toast.error("创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      dispatch({ type: "SIZE_ERROR" });
      return;
    }
    fileRef.current = file;
    dispatch({ type: "PARSE_START" });
  }

  async function handleImportPersist() {
    if (submitting || !state.importPreview || state.currentVolumes.length === 0) return;
    setSubmitting(true);
    try {
      const name = state.currentVolumes[0]?.title || state.importPreview.title;
      const result = await importPersist({
        name,
        volumes: state.currentVolumes,
      });
      toast.success(`「${name}」已导入`);
      onCreated((result as any).id);
    } catch (err) {
      dispatch({
        type: "CREATE_ERROR",
        msg: err instanceof Error ? err.message : "导入失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  // ---- Derived ----

  const freeLimitReached =
    tier === "none" && novelCount !== undefined && novelCount >= 1;

  // ---- Render helpers ----

  function renderStage() {
    switch (state.stage) {
      case "entry-fork":
        return renderEntryFork();
      case "ai-greeting":
        return renderAiGreeting();
      case "ai-loading":
        return renderAiLoading();
      case "ai-error":
        return renderAiError();
      case "ai-results":
        return renderAiResults();
      case "manual":
        return renderManual();
      case "import-upload":
        return renderImportUpload();
      case "import-parsing":
        return renderImportParsing();
      case "import-error":
        return renderImportError();
      case "import-size-error":
        return renderImportSizeError();
      case "import-preview":
        return renderImportPreview();
      default:
        return null;
    }
  }

  // ---- Stage renderers ----

  function renderEntryFork() {
    const cardClass = (disabled: boolean) =>
      `card bg-base-200/70 border border-base-300/40 p-6 text-center transition-all duration-200 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-primary/20 hover:shadow-lg cursor-pointer"
      }`;

    const handleCardClick = (fork: "ai" | "manual" | "import") => {
      if (!freeLimitReached) dispatch({ type: "SELECT_FORK", fork });
    };

    return (
      <div className="space-y-4">
        <h3 className="font-bold font-serif text-lg text-center">
          开始一部新小说
        </h3>
        <p className="text-sm text-base-content/50 text-center leading-relaxed">
          选择你的创作方式
        </p>

        {/* 禁用提示 */}
        {freeLimitReached && (
          <div className="alert alert-warning text-xs py-2">
            <AlertTriangle className="w-4 h-4" />
            <span>免费用户限 1 本。升级套餐可创建更多小说。</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* 从 0 创作 */}
          <div
            className={cardClass(freeLimitReached)}
            onClick={() => handleCardClick("ai")}
            role="button"
            tabIndex={freeLimitReached ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !freeLimitReached) handleCardClick("ai");
            }}
            aria-label="AI 辅助创作"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-semibold text-base mb-1">从 0 创作</h4>
            <p className="text-xs text-base-content/50">AI 辅助，从构思到成书</p>
          </div>

          {/* 导入已有稿子 */}
          <div
            className={cardClass(freeLimitReached)}
            onClick={() => handleCardClick("import")}
            role="button"
            tabIndex={freeLimitReached ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !freeLimitReached)
                handleCardClick("import");
            }}
            aria-label="导入已有稿子"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-6 h-6 text-secondary" />
            </div>
            <h4 className="font-semibold text-base mb-1">导入已有稿子</h4>
            <p className="text-xs text-base-content/50">
              把 Word/记事本里的稿子搬进来
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderAiGreeting() {
    return (
      <div className="space-y-4">
        <button
          className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content/70 -ml-2"
          onClick={() => dispatch({ type: "GO_BACK" })}
        >
          ← 返回
        </button>

        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Wand2 className="w-4 h-4 text-primary" />
          </div>
          <div className="bg-base-200 rounded-lg p-3 text-sm leading-relaxed">
            你想写一个什么样的故事？简单描述就行——主角是谁、在什么世界、发生了什么。
            不用想书名，先跟我聊聊你的故事。
          </div>
        </div>

        <textarea
          className="textarea textarea-bordered w-full h-28"
          placeholder="比如：一个退役刑警在调查三年前的悬案时，发现所有线索都指向他自己。"
          value={state.premise}
          onChange={(e) => dispatch({ type: "SET_PREMISE", value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAiSuggest();
            }
          }}
        />

        <button
          className="btn btn-primary w-full"
          onClick={handleAiSuggest}
          disabled={submitting || !state.premise.trim()}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
          {submitting ? "AI 正在构思…" : "AI 帮我起名 & 分析类型"}
        </button>

        <div className="divider text-[11px] text-base-content/40">或者</div>

        <button
          className="btn btn-ghost w-full text-sm"
          onClick={() => dispatch({ type: "GO_MANUAL" })}
        >
          跳过 — 我已经有书名和想法了
        </button>
      </div>
    );
  }

  function renderAiLoading() {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/50">AI 正在构思书名和类型…</p>
      </div>
    );
  }

  function renderAiError() {
    return (
      <div className="space-y-4">
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>AI 建议失败，请重试或手动输入</span>
        </div>

        <div className="flex gap-3">
          <button
            className="btn btn-outline flex-1"
            onClick={() => dispatch({ type: "RETRY_AI" })}
          >
            重试
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => dispatch({ type: "GO_MANUAL" })}
          >
            手动输入
          </button>
        </div>
      </div>
    );
  }

  function renderAiResults() {
    if (!state.suggestion) return null;

    return (
      <div className="space-y-4">
        <div>
          <span className="label-text text-xs font-medium">AI 为你准备了</span>
          <div className="space-y-2 mt-2">
            {state.suggestion.titles.map((t, i) => (
              <button
                key={i}
                className={`btn w-full justify-start text-sm ${
                  state.selectedTitle === t ? "btn-primary" : "btn-outline"
                }`}
                onClick={() =>
                  dispatch({ type: "SET_NAME", value: t })
                }
              >
                {t}
              </button>
            ))}
          </div>
          {state.selectedTitle && (
            <div className="mt-2">
              <label className="label-text text-xs text-base-content/40">
                或修改标题
              </label>
              <input
                className="input input-bordered w-full text-sm mt-1"
                value={state.name}
                onChange={(e) =>
                  dispatch({ type: "SET_NAME", value: e.target.value })
                }
                placeholder="修改标题…"
              />
            </div>
          )}
        </div>

        <div className="card bg-base-100 border border-base-300 p-3">
          <span className="text-[10px] text-base-content/60 uppercase">
            简介
          </span>
          <p className="text-sm mt-1 leading-relaxed">
            {state.suggestion.synopsis}
          </p>
        </div>

        <div className="flex gap-2 text-[11px] text-base-content/60">
          <span className="badge badge-outline">
            {state.suggestion.genre_label}
          </span>
          <span className="badge badge-outline">
            {state.suggestion.atmosphere}
          </span>
        </div>

        {state.suggestion.elements && (
          <div className="bg-base-200/50 border border-base-300/50 rounded-lg p-3 space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-base-content/40 font-medium">
              故事要素
            </span>
            {Object.entries(state.suggestion.elements).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className={val ? "text-success" : "text-warning"}>
                  {val ? "✅" : "⚠️"}
                </span>
                <span className="text-base-content/50 w-16 shrink-0">
                  {key}
                </span>
                <span
                  className={
                    val
                      ? "text-base-content/80"
                      : "text-base-content/30 italic"
                  }
                >
                  {val || "未提及"}
                </span>
              </div>
            ))}
            {state.suggestion.missing &&
              state.suggestion.missing.length > 0 && (
                <div className="mt-2 pt-2 border-t border-base-300/40">
                  <p className="text-[11px] text-warning/70">
                    {state.suggestion.missing.join("；")}
                  </p>
                </div>
              )}
          </div>
        )}

        <div className="text-[11px] text-base-content/50 bg-base-200 rounded p-2">
          创建后自动填好：小说简介、类型设定。可在设置页面修改。
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              dispatch({ type: "SUBMIT_PREMISE" });
              handleAiSuggest();
            }}
            disabled={submitting}
          >
            重新构思
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={submitting || !state.name.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                创建中…
              </>
            ) : (
              `创建《${state.name}》`
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderManual() {
    return (
      <div className="space-y-4">
        <button
          className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content/70 -ml-2"
          onClick={() => dispatch({ type: "GO_BACK" })}
        >
          ← 返回选择
        </button>

        <h3 className="font-bold font-serif text-lg">手动创建小说</h3>

        <div>
          <label className="label py-1">
            <span className="label-text text-xs font-medium">书名</span>
          </label>
          <input
            className="input input-bordered w-full"
            placeholder="给你的小说取个名字…"
            value={state.name}
            onChange={(e) => dispatch({ type: "SET_NAME", value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>

        <div className="text-[11px] text-base-content/50">
          书名确定后可以随时修改。简介和类型可以在设置页面补充。
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            className="btn btn-ghost"
            onClick={() => {
              dispatch({ type: "GO_BACK" });
            }}
            disabled={submitting}
          >
            返回
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={submitting || !state.name.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                创建中…
              </>
            ) : (
              "创建"
            )}
          </button>
        </div>
      </div>
    );
  }

  function renderImportUpload() {
    return (
      <div className="space-y-4">
        <button
          className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content/70 -ml-2"
          onClick={() => dispatch({ type: "GO_BACK" })}
        >
          ← 返回选择
        </button>

        <h3 className="font-bold font-serif text-lg">导入已有稿子</h3>
        <p className="text-sm text-base-content/50 leading-relaxed">
          支持 .txt、.md、.docx 格式，单文件不超过 10MB。
        </p>

        {/* Upload area */}
        <div
          className="border-2 border-dashed border-base-300/50 rounded-xl p-8 text-center hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") fileInputRef.current?.click();
          }}
        >
          <Upload className="w-10 h-10 mx-auto text-base-content/30 mb-3" />
          <p className="text-sm text-base-content/50">
            点击选择文件，或将文件拖到此处
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <div className="text-center">
          <a
            href="/templates/import-template.zip"
            className="text-xs link link-primary"
            onClick={(e) => {
              e.preventDefault();
              toast.info("模板下载功能即将上线");
            }}
          >
            下载导入模板
          </a>
        </div>
      </div>
    );
  }

  function renderImportParsing() {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        {showSkeleton ? (
          <>
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/50">
              文件较大，正在解析卷章结构…
            </p>
            <div className="w-full max-w-xs space-y-2 mt-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-5/6" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </>
        ) : (
          <>
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-sm text-base-content/50">
              正在解析文件结构…
            </p>
          </>
        )}
      </div>
    );
  }

  function renderImportError() {
    return (
      <div className="space-y-4">
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>{state.errorMsg || "解析失败"}</span>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-outline flex-1"
            onClick={() => dispatch({ type: "GO_BACK" })}
          >
            返回
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => {
              dispatch({ type: "GO_BACK" });
            }}
          >
            重新选择文件
          </button>
        </div>
      </div>
    );
  }

  function renderImportSizeError() {
    return (
      <div className="space-y-4">
        <div className="alert alert-warning">
          <AlertTriangle className="w-5 h-5" />
          <span>文件不能超过 10MB</span>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "GO_BACK" })}
          >
            返回
          </button>
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: "GO_BACK" })}
          >
            重新选择
          </button>
        </div>
        <p className="text-xs text-base-content/40 text-center">
          如果需要导入大文件，建议拆分多个文件后分别导入
        </p>
      </div>
    );
  }

  function renderImportPreview() {
    if (!state.importPreview) return null;

    return (
      <div className="space-y-4">
        {/* Error banner */}
        {state.errorMsg && (
          <div className="alert alert-error py-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{state.errorMsg}</span>
          </div>
        )}

        <ImportPreviewTree
          title={state.importPreview.title}
          volumes={state.currentVolumes}
          onVolumesChange={(volumes) =>
            dispatch({ type: "UPDATE_VOLUMES", volumes })
          }
          onConfirm={handleImportPersist}
          onBack={() => dispatch({ type: "GO_BACK" })}
          loading={submitting}
          onReset={() =>
            dispatch({
              type: "UPDATE_VOLUMES",
              volumes: state.importPreview!.volumes.map((v) => ({
                title: v.name,
                chapters: v.chapters.map((c) => ({ title: c.name })),
              })),
            })
          }
        />
      </div>
    );
  }

  // ---- Main render ----

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="modal modal-open" onClick={handleClose}>
        <div
          className="modal-box max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-serif text-lg">
              {state.stage === "entry-fork" ? "开始一部新小说" : ""}
            </h3>
            <button
              onClick={handleClose}
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="关闭"
              disabled={submitting}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Animated content area */}
          <div
            ref={contentRef}
            key={state.stage}
            style={{ animation: "fadeIn 300ms ease" }}
          >
            {renderStage()}
          </div>
        </div>
        <div className="modal-backdrop" onClick={handleClose} />
      </div>
    </>
  );
}
