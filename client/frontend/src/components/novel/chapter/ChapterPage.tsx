// 章工作台页壳（PR2）：tab 归属章页最外层，顺序=写作工作流 章纲→提示词→正文；
// 默认 tab 按进度推进；标题/位置/状态徽章在页头；状态只由系统维护（无选择器）。

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { request } from "@/lib/api";
import { computeChapterPosition } from "@/lib/chapterPosition";
import type { SelectionCapture } from "@/lib/selection";
import { Pencil } from "lucide-react";
import ChapterEditor, {
  type AIWritingState,
  type ChapterEditorHandle,
} from "../ChapterEditor";
import ChapterOutlineSummary from "./ChapterOutlineSummary";
import OutlineEditor, {
  type ChapterData as OutlineChapterData,
} from "../outline/OutlineEditor";
import PromptManagementPage from "../PromptManagementPage";
import RightToolbar from "../RightToolbar";
import TabProgressButton from "../TabProgressButton";
import VersionHistory from "../VersionHistory";
import { ChapterStatusBadge } from "../statusBadge";
import { useChapterData } from "@/hooks/useChapterData";
import { useDeviceActivation } from "@/hooks/useDeviceActivation";
import type { UseOutlineReturn } from "@/hooks/useOutline";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";

type ChapterTab = "outline" | "prompt" | "prose";

interface ChapterPageProps {
  projectId: string;
  chapterRef: string;
  volumes: WorkbenchVolume[];
  outline: UseOutlineReturn;
  focusMode: boolean;
  /** 正文 tab 的版本历史子面板（Workbench 持有） */
  showVersion: boolean;
  onShowVersion: () => void;
  onCloseVersion: () => void;
  onFocusNode: (ref: string) => void;
  editorRef: RefObject<ChapterEditorHandle | null>;
  aiState: AIWritingState;
  onAIStateChange: (state: AIWritingState) => void;
}

export default function ChapterPage({
  projectId,
  chapterRef,
  volumes,
  outline,
  focusMode,
  showVersion,
  onShowVersion,
  onCloseVersion,
  onFocusNode,
  editorRef,
  aiState,
  onAIStateChange,
}: ChapterPageProps) {
  const { chapter, status, wordCount, loading, error, reload } = useChapterData(
    projectId,
    chapterRef,
  );

  const [tab, setTab] = useState<ChapterTab | null>(null);
  const [hasPrompts, setHasPrompts] = useState<boolean | null>(null);
  const [activated, setActivated] = useState<{ loaded: boolean; value: boolean }>({
    loaded: false,
    value: false,
  });
  const defaultedRef = useRef(false);

  // 提示词列表（默认 tab + tab 进度点共用；404/空都算无提示词）。
  // 该端点过 require_ai_access 门控——这里是能力探测而非功能使用，走静默
  // 请求（quiet）：403 不弹升级引导、503 不跳 /config；失败一律视为「无提示词」。
  useEffect(() => {
    let cancelled = false;
    setHasPrompts(null);
    request(`/novels/${projectId}/chapters/${chapterRef}/prompts`, {
      quiet: true,
    })
      .then((files: unknown) => {
        if (!cancelled)
          setHasPrompts(Array.isArray(files) && files.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasPrompts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, chapterRef]);

  // 付费判定（/auth/devices/current activated）：默认 tab 的提示词/正文分流
  const { refreshStatus } = useDeviceActivation();
  useEffect(() => {
    let cancelled = false;
    void refreshStatus().then((s) => {
      if (cancelled) return;
      setActivated({ loaded: true, value: !!s?.activated });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  // 首次数据齐 → 定默认 tab（仅一次；后续切换由用户主导，点 tab 即取消默认）。
  // 有正文/提示词或未确认时可立即定档；仅「已确认且两者皆无」要等付费信号
  // （/auth/devices/current 经远端代理，可能秒级往返）再分流 提示词/正文。
  useEffect(() => {
    if (defaultedRef.current || loading || !chapter || hasPrompts === null)
      return;
    const hasProse =
      !!(chapter as Record<string, unknown>).has_prose ||
      !!chapter.prose?.trim();
    if (hasProse || hasPrompts) {
      defaultedRef.current = true;
      setTab("prose");
      return;
    }
    if (chapter.status !== "confirmed") {
      defaultedRef.current = true;
      setTab("outline");
      return;
    }
    if (!activated.loaded) return;
    defaultedRef.current = true;
    setTab(activated.value ? "prompt" : "prose");
  }, [loading, chapter, hasPrompts, activated]);

  // 用户切换 tab：同时取消任何待定的默认 tab 计算（避免晚到的默认值
  // 把用户已经进入的 tab 拽走）
  const selectTab = useCallback((next: ChapterTab) => {
    defaultedRef.current = true;
    setTab(next);
  }, []);

  // 版本历史仅属正文 tab
  useEffect(() => {
    if (tab !== "prose" && showVersion) onCloseVersion();
  }, [tab, showVersion, onCloseVersion]);

  // ── AI 桥接：从 editorRef 派生（正文 tab 专用） ─────────────────────────
  const handleContinue = useCallback(() => {
    editorRef.current?.handleContinueWriting();
  }, [editorRef]);
  const handlePolish = useCallback(
    (capture: SelectionCapture) => {
      editorRef.current?.handlePolish(capture);
    },
    [editorRef],
  );
  const handleExpand = useCallback(
    (capture: SelectionCapture) => {
      editorRef.current?.handleExpand(capture);
    },
    [editorRef],
  );
  const captureNow = useCallback(
    (): SelectionCapture | null => editorRef.current?.captureNow() ?? null,
    [editorRef],
  );

  // ── 专注模式：只渲染正文编辑器（页头/tab 均隐藏，Esc 由 Workbench 全局处理） ──
  if (focusMode) {
    return (
      <div className="flex h-full gap-0 flex-1">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <ChapterEditor
            ref={editorRef}
            projectId={projectId}
            chapterRef={chapterRef}
            onShowVersion={onShowVersion}
            onAIStateChange={onAIStateChange}
            focusMode
          />
        </div>
        <RightToolbar
          projectId={projectId}
          chapterRef={chapterRef}
          volumes={volumes}
          onFocusNode={onFocusNode}
          hasSelection={aiState.hasSelection}
          selectedText={aiState.selectedText}
          onContinue={handleContinue}
          onPolish={handlePolish}
          onExpand={handleExpand}
          captureNow={captureNow}
          continueLoading={aiState.continueLoading}
          polishLoading={aiState.polishLoading}
          expandLoading={aiState.expandLoading}
        />
      </div>
    );
  }

  if (loading && !chapter) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  if (error && !chapter) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4">
        <p className="text-error text-sm">{error}</p>
        <button onClick={() => void reload()} className="btn btn-primary btn-sm">
          重试
        </button>
      </div>
    );
  }

  if (!chapter) return null;

  const position = computeChapterPosition(volumes, chapterRef);
  const outlineStatus = (chapter as Record<string, unknown>)
    .outline_status as string | undefined;
  const hasProse =
    !!(chapter as Record<string, unknown>).has_prose ||
    !!chapter.prose?.trim();

  // tab 进度点：完成 ✓ / 进行中 ● / 未开始（无标记）
  const outlineTabStatus =
    status === "confirmed"
      ? ("complete" as const)
      : outlineStatus === "in_progress"
        ? ("in_progress" as const)
        : undefined;
  const proseTabStatus = hasProse
    ? ("complete" as const)
    : status === "writing" || status === "review"
      ? ("in_progress" as const)
      : undefined;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── 页头：标题 + 状态徽章 + 字数 + 位置行 ─────────────────────── */}
      <div className="max-w-3xl mx-auto w-full px-6 pt-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-serif font-semibold text-base-content truncate">
            {chapter.title || `第${chapter.chapter}章`}
          </h1>
          <span className="badge badge-ghost badge-sm shrink-0">{chapterRef}</span>
          <ChapterStatusBadge status={status} />
          <span className="ml-auto text-xs text-base-content/40 tabular-nums shrink-0">
            {wordCount.toLocaleString()} 字
          </span>
        </div>
        {position && (
          <p className="text-xs text-base-content/40 mt-1.5 tabular-nums">
            第{position.volumeNo}卷 · 本卷第{position.inVolumeIndex + 1}章 · 全书第
            {position.globalIndex + 1}章 / 共{position.totalChapters}章
          </p>
        )}
      </div>

      {/* ── 页面级 tab：章纲 → 提示词 → 正文（=写作工作流） ─────────────── */}
      <div className="max-w-3xl mx-auto w-full px-6 mt-4">
        <div className="flex items-center gap-1 border-b border-base-300 -mb-px">
          <TabProgressButton
            label="章纲"
            status={outlineTabStatus}
            active={tab === "outline"}
            onClick={() => selectTab("outline")}
          />
          <TabProgressButton
            label="提示词"
            status={hasPrompts ? "complete" : undefined}
            active={tab === "prompt"}
            onClick={() => selectTab("prompt")}
          />
          <TabProgressButton
            label="正文"
            status={proseTabStatus}
            active={tab === "prose"}
            onClick={() => selectTab("prose")}
          />
        </div>
      </div>

      {/* ── tab 内容 ────────────────────────────────────────────────── */}
      <div className={`flex flex-1 min-h-0 ${tab === "prose" ? "" : "overflow-y-auto"}`}>
        {tab === null ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : tab === "outline" ? (
          <ChapterOutlineTab
            projectId={projectId}
            chapterRef={chapterRef}
            outline={outline}
            onConfirmed={() => void reload()}
          />
        ) : tab === "prompt" ? (
          <div className="flex-1 min-w-0">
            <PromptManagementPage projectId={projectId} chapterRef={chapterRef} />
          </div>
        ) : showVersion ? (
          <div className="flex-1 min-w-0 p-4">
            <VersionHistory
              projectId={projectId}
              chapterRef={chapterRef}
              onBack={onCloseVersion}
            />
          </div>
        ) : (
          <div className="flex h-full gap-0 flex-1">
            <div className="flex-1 min-w-0 overflow-y-auto">
              <ChapterEditor
                ref={editorRef}
                projectId={projectId}
                chapterRef={chapterRef}
                onShowVersion={onShowVersion}
                onAIStateChange={onAIStateChange}
              />
            </div>
            <RightToolbar
              projectId={projectId}
              chapterRef={chapterRef}
              volumes={volumes}
              onFocusNode={onFocusNode}
              hasSelection={aiState.hasSelection}
              selectedText={aiState.selectedText}
              onContinue={handleContinue}
              onPolish={handlePolish}
              onExpand={handleExpand}
              captureNow={captureNow}
              continueLoading={aiState.continueLoading}
              polishLoading={aiState.polishLoading}
              expandLoading={aiState.expandLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 章纲 tab：未确认→OutlineEditor 编辑；已确认→只读摘要卡 + [✎ 编辑章纲]
// ---------------------------------------------------------------------------

function ChapterOutlineTab({
  projectId,
  chapterRef,
  outline,
  onConfirmed,
}: {
  projectId: string;
  chapterRef: string;
  outline: UseOutlineReturn;
  onConfirmed: () => void;
}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const data = outline.chaptersMap.get(chapterRef);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void outline
      .loadChapterData(chapterRef)
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadError((e as Error)?.message || "加载章纲失败");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterRef, outline.loadChapterData, retryKey]);

  // 确认后：重载章纲数据（chaptersMap 状态）+ 通知页壳同步正文 store 的 status
  const handleConfirm = useCallback(
    async (ref: string) => {
      await outline.confirmChapter(ref);
      await outline.loadChapterData(ref).catch(() => {});
      onConfirmed();
    },
    [outline, onConfirmed],
  );

  if (data) {
    const confirmed = data.status === "confirmed";
    if (confirmed && !editing) {
      return (
        <div className="max-w-3xl mx-auto w-full px-6 py-6">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setEditing(true)}
              className="btn btn-ghost btn-xs gap-1 border border-primary/30 bg-primary/10 text-primary"
            >
              <Pencil className="w-3 h-3" />
              编辑章纲
            </button>
          </div>
          <ChapterOutlineSummary data={data} />
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto w-full px-6 py-6">
        {confirmed && (
          <div className="mb-3 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-1.5">
            正在编辑已确认的章纲，保存不会改变确认状态
          </div>
        )}
        <OutlineEditor
          projectId={projectId}
          chapterRef={chapterRef}
          chapterData={data as OutlineChapterData}
          onSave={outline.saveChapter}
          onConfirm={handleConfirm}
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4">
        <p className="text-error text-sm">{loadError}</p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setRetryKey((k) => k + 1)}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="loading loading-spinner loading-md text-primary" />
    </div>
  );
}
