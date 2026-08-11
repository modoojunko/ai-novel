import { useCallback, useEffect, useRef, useState } from "react";
import ChapterEditor from "./ChapterEditor";
import type { ChapterEditorHandle, AIWritingState } from "./ChapterEditor";
import VolumeEditor from "./VolumeEditor";
import EmptyState from "./EmptyState";
import WritingTree from "./WritingTree";
import Breadcrumb from "./Breadcrumb";
import BottomStatusBar from "./BottomStatusBar";
import VersionHistory from "./VersionHistory";
import RightToolbar from "./RightToolbar";
import OutlineEditor, {
  type ChapterData as OutlineChapterData,
} from "./outline/OutlineEditor";
import PromptManagementPage from "./PromptManagementPage";
import TabProgressButton from "./TabProgressButton";
import type { SelectionCapture } from "@/lib/selection";
import type { TreeNode } from "./StructureTree";
import type { UseWorkbenchReturn, WorkbenchNode } from "@/hooks/useWorkbench";
import type { UseOutlineReturn } from "@/hooks/useOutline";
import { useOutline } from "@/hooks/useOutline";
import { useChapterData } from "@/hooks/useChapterData";
import { TierGate } from "./license/FeatureTier";
import { Maximize2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// 章选中中部子 label：正文 / 章纲 / 提示词；卷选中 → 右侧抽屉（011）
// ---------------------------------------------------------------------------

type ChapterTab = "prose" | "outline" | "prompt";

interface WorkbenchProps {
  /** 由 NovelWorkspace（useWorkbench 唯一调用方）注入 —— 单一数据源 */
  wb: UseWorkbenchReturn;
}

export default function Workbench({ wb }: WorkbenchProps) {
  const {
    project,
    volumes,
    selectedId,
    selectedRef,
    viewPayload,
    expandedIds,
    onToggle,
    onSelectNode,
    createVolume,
    createChapter,
    renameNode,
    deleteNode,
    refresh,
    focusNode,
  } = wb;

  const [focusMode, setFocusMode] = useState(false);
  // 版本历史子面板（workbench 右区，非四态视图）：WritingTree / ChapterEditor 触发
  const [versionRef, setVersionRef] = useState<string | null>(null);

  // ── 章子 label 状态（011） ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ChapterTab>("prose");
  // ── 卷抽屉状态（011）：点卷节点 → 右侧覆盖面板 ─────────────────────
  const [drawerVol, setDrawerVol] = useState<string | null>(null);
  // 记录已触发过抽屉的卷：createVolume 路径仅对新卷开抽屉，手动关闭不重开
  const lastDrawerVolRef = useRef<string | null>(null);

  // archives「编辑」→ 回到 workbench 并聚焦该章（setView payload.focusRef）
  useEffect(() => {
    if (viewPayload?.focusRef) focusNode(viewPayload.focusRef);
  }, [viewPayload, focusNode]);

  // ── AI Writing: ref + mediated state（免费态不接线，RightToolbar 不渲染） ──
  const editorRef = useRef<ChapterEditorHandle>(null);
  const [aiState, setAIState] = useState<AIWritingState>({
    hasSelection: false,
    selectedText: "",
    continueLoading: false,
    polishLoading: false,
    expandLoading: false,
  });

  const handleAIStateChange = useCallback((state: AIWritingState) => {
    setAIState(state);
  }, []);

  const handleContinue = useCallback(() => {
    editorRef.current?.handleContinueWriting();
  }, []);

  const handlePolish = useCallback((capture: SelectionCapture) => {
    editorRef.current?.handlePolish(capture);
  }, []);

  const handleExpand = useCallback((capture: SelectionCapture) => {
    editorRef.current?.handleExpand(capture);
  }, []);

  const captureNow = useCallback((): SelectionCapture | null => {
    return editorRef.current?.captureNow() ?? null;
  }, []);

  // ── Focus mode: Esc 全局退出（C6） ──────────────────────────────────
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  // ── 卷抽屉：Esc 关闭（011，与专注模式一致） ────────────────────────
  useEffect(() => {
    if (!drawerVol) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerVol(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerVol]);

  const projectId = project?.id ?? "";
  const outline = useOutline(projectId);

  // 切到非正文子 label 时清除版本历史（版本历史仅属正文）
  useEffect(() => {
    if (activeTab !== "prose" && versionRef) setVersionRef(null);
  }, [activeTab, versionRef]);

  // ── 卷节点选择 → 打开抽屉（011） ────────────────────────────────────
  const handleSelectNode = useCallback(
    (node: TreeNode) => {
      const data = node.data as WorkbenchNode | undefined;
      if (data?.type === "volume") {
        lastDrawerVolRef.current = data.volume;
        setDrawerVol(data.volume);
      } else if (data?.type === "chapter") {
        setDrawerVol(null);
        lastDrawerVolRef.current = null;
        setActiveTab("prose");
      }
      onSelectNode(node);
    },
    [onSelectNode],
  );

  // createVolume 路径（不经 handleSelectNode）：仅新卷首次出现时开抽屉
  useEffect(() => {
    if (selectedRef) return;
    if (selectedId && /^vol-\d+$/.test(selectedId)) {
      if (lastDrawerVolRef.current !== selectedId) {
        lastDrawerVolRef.current = selectedId;
        setDrawerVol(selectedId);
      }
    } else {
      lastDrawerVolRef.current = null;
    }
  }, [selectedId, selectedRef]);

  const addChapterIn = useCallback(
    (volumeName: string) => {
      // 在指定卷下建章：临时选中该卷再调 createChapter
      onSelectNode({
        id: volumeName,
        data: { type: "volume", volume: volumeName },
      } as TreeNode);
      void createChapter();
    },
    [onSelectNode, createChapter],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 上下文行（012 合并）：面包屑 + 章子 label（正文/章纲/提示词）+ 专注开关 */}
      <div className="flex items-center border-b border-base-300 bg-base-100/60">
        <div className="flex-1 min-w-0">
          <Breadcrumb
            projectName={project?.name ?? ""}
            volumes={volumes}
            selectedId={selectedId}
            selectedRef={selectedRef}
            onSelectVolume={(volName) =>
              onSelectNode({
                id: volName,
                data: { type: "volume", volume: volName },
              } as TreeNode)
            }
            onSelectChapter={(ref) => focusNode(ref)}
          />
        </div>
        {selectedRef && (
          <>
            {/* 章子 label（提示词 PRO-only，011） */}
            <div className="flex items-center gap-1 px-2 shrink-0">
              <TabProgressButton
                label="正文"
                active={activeTab === "prose"}
                onClick={() => setActiveTab("prose")}
              />
              <TabProgressButton
                label="章纲"
                active={activeTab === "outline"}
                onClick={() => setActiveTab("outline")}
              />
              <TierGate feature="prompt-panel">
                <TabProgressButton
                  label="提示词"
                  active={activeTab === "prompt"}
                  onClick={() => setActiveTab("prompt")}
                />
              </TierGate>
            </div>
            <button
              onClick={() => setFocusMode((v) => !v)}
              className={`btn btn-ghost btn-xs gap-1 mr-2 ${
                focusMode ? "text-primary" : "text-base-content/50"
              }`}
              title={focusMode ? "退出专注模式 (Esc)" : "专注模式"}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              {focusMode ? "退出专注" : "专注"}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左树：专注模式隐藏 */}
        {!focusMode && (
          <aside className="w-56 flex-shrink-0 overflow-hidden border-r border-base-300 bg-base-200/30">
            <WritingTree
              volumes={volumes}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelectNode={handleSelectNode}
              onCreateVolume={() => void createVolume()}
              onCreateChapter={() => void createChapter()}
              onRename={(id, title) => void renameNode(id, title)}
              onDelete={(id) => void deleteNode(id)}
              onAddChapterIn={addChapterIn}
              onShowVersion={setVersionRef}
            />
          </aside>
        )}

        {/* 右编辑器区 */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* 章子 label 已并入上下文行（012） */}
          <div className={`flex flex-1 min-h-0 ${focusMode ? "" : "overflow-y-auto"}`}>
            {selectedRef ? (
              activeTab === "prose" ? (
                <div className="flex h-full gap-0 flex-1">
                  <div className="flex-1 min-w-0 overflow-y-auto">
                    {versionRef === selectedRef ? (
                      <div className="p-4">
                        <VersionHistory
                          projectId={projectId}
                          chapterRef={selectedRef}
                          onBack={() => setVersionRef(null)}
                        />
                      </div>
                    ) : (
                      <ChapterEditor
                        ref={editorRef}
                        projectId={projectId}
                        chapterRef={selectedRef}
                        onShowVersion={() => setVersionRef(selectedRef)}
                        onAIStateChange={handleAIStateChange}
                        focusMode={focusMode}
                      />
                    )}
                  </div>
                  {/* RightToolbar 仅 PRO（N14） */}
                  <TierGate feature="ai-generate">
                    <RightToolbar
                      projectId={projectId}
                      chapterRef={selectedRef}
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
                  </TierGate>
                </div>
              ) : activeTab === "outline" ? (
                <ChapterOutlinePanel
                  projectId={projectId}
                  chapterRef={selectedRef}
                  outline={outline}
                  onBack={() => setActiveTab("prose")}
                />
              ) : (
                <div className="flex-1 min-w-0 overflow-y-auto">
                  <TierGate feature="prompt-panel">
                    <PromptManagementPage
                      projectId={projectId}
                      chapterRef={selectedRef}
                    />
                  </TierGate>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col">
                <EmptyState
                  onCreateVolume={() => void createVolume()}
                  onCreateChapter={() => void createChapter()}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 卷抽屉（011）：点卷节点 → 右侧覆盖面板，遮罩点击关闭 */}
      {drawerVol && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setDrawerVol(null)}
          />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-[400px] bg-base-100 border-l border-base-300 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-base-300 shrink-0">
              <span className="text-sm font-medium text-base-content/70">
                卷纲
              </span>
              <button
                onClick={() => setDrawerVol(null)}
                className="btn btn-ghost btn-xs gap-1"
                title="关闭"
              >
                <X className="w-3.5 h-3.5" /> 关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <VolumeEditor
                projectId={projectId}
                volumeRef={drawerVol}
                onChapterSelect={(chapterRef) => {
                  setDrawerVol(null);
                  lastDrawerVolRef.current = null;
                  if (chapterRef) {
                    setActiveTab("prose");
                    focusNode(chapterRef);
                  }
                }}
                onVolumeChange={refresh}
              />
            </div>
          </aside>
        </>
      )}

      {/* 底部状态栏（专注模式保留，C6）：需选中章才显示字数/进度 */}
      {selectedRef && (
        <ChapterStatusBar key={selectedRef} projectId={projectId} chapterRef={selectedRef} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 章纲子 label：useOutline 按需加载单章数据 → OutlineEditor（自包含表单）
// ---------------------------------------------------------------------------

function ChapterOutlinePanel({
  projectId,
  chapterRef,
  outline,
  onBack,
}: {
  projectId: string;
  chapterRef: string;
  outline: UseOutlineReturn;
  onBack: () => void;
}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const data = outline.chaptersMap.get(chapterRef);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    void outline
      .loadChapterData(chapterRef)
      .catch((e: any) => {
        if (!cancelled) setLoadError(e?.message || "加载章纲失败");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterRef, outline.loadChapterData, retryKey]);

  if (data) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        <OutlineEditor
          projectId={projectId}
          chapterRef={chapterRef}
          chapterData={data as OutlineChapterData}
          onSave={outline.saveChapter}
          onConfirm={outline.confirmChapter}
          onBack={onBack}
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4">
        <p className="text-error text-sm">{loadError}</p>
        <div className="flex gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setRetryKey((k) => k + 1)}
          >
            重试
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            返回正文
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <span className="loading loading-spinner loading-md text-primary" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 内联状态栏：桥接 useChapterData 状态到 BottomStatusBar
// ---------------------------------------------------------------------------

function ChapterStatusBar({
  projectId,
  chapterRef,
}: {
  projectId: string;
  chapterRef: string;
}) {
  const {
    wordCount,
    targetWords,
    setTargetWords,
    saveState,
    save,
    retry,
    status,
  } = useChapterData(projectId, chapterRef);

  return (
    <BottomStatusBar
      wordCount={wordCount}
      targetWords={targetWords}
      onSetTargetWords={setTargetWords}
      saveState={saveState}
      onSave={save}
      onRetry={retry}
      isArchived={status === "archived"}
    />
  );
}
