import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChapterEditor from "./ChapterEditor";
import type { ChapterEditorHandle, AIWritingState } from "./ChapterEditor";
import VolumeEditor from "./VolumeEditor";
import EmptyState from "./EmptyState";
import WritingTree from "./WritingTree";
import Breadcrumb from "./Breadcrumb";
import BottomStatusBar from "./BottomStatusBar";
import VersionHistory from "./VersionHistory";
import RightToolbar from "./RightToolbar";
import type { SelectionCapture } from "@/lib/selection";
import type { TreeNode } from "./StructureTree";
import type { UseWorkbenchReturn } from "@/hooks/useWorkbench";
import { useChapterData } from "@/hooks/useChapterData";
import { TierGate } from "./license/FeatureTier";
import { Maximize2 } from "lucide-react";

interface WorkbenchProps {
  /** 由 NovelWorkspace（useWorkbench 唯一调用方）注入 —— 单一数据源 */
  wb: UseWorkbenchReturn;
  onGoAdvancedSettings: () => void;
  onGoAdvancedOutline: () => void;
}

export default function Workbench({
  wb,
  onGoAdvancedSettings,
  onGoAdvancedOutline,
}: WorkbenchProps) {
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

  // 选中卷 → 解析卷名（selectedId 可能是 vol-N 卷名或章 ref）
  const selectedVolumeName = useMemo(() => {
    if (selectedRef) return null; // 选中章时右区是 ChapterEditor
    if (selectedId && /^vol-\d+$/.test(selectedId)) return selectedId;
    return null;
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

  const projectId = project?.id ?? "";

  return (
    <div className="flex flex-col h-full">
      {/* 面包屑（专注模式保留，N17）+ 专注开关 */}
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
              onSelectNode={onSelectNode}
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
          <div className={`flex flex-1 min-h-0 ${focusMode ? "" : "overflow-y-auto"}`}>
            {selectedRef && versionRef === selectedRef ? (
              <div className="flex-1 min-w-0 overflow-y-auto p-4">
                <VersionHistory
                  projectId={projectId}
                  chapterRef={selectedRef}
                  onBack={() => setVersionRef(null)}
                />
              </div>
            ) : selectedRef ? (
              <div className="flex h-full gap-0 flex-1">
                <div className="flex-1 min-w-0 overflow-y-auto">
                  <ChapterEditor
                    ref={editorRef}
                    projectId={projectId}
                    chapterRef={selectedRef}
                    onShowVersion={() => setVersionRef(selectedRef)}
                    onAIStateChange={handleAIStateChange}
                    focusMode={focusMode}
                  />
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
            ) : selectedVolumeName ? (
              <VolumeEditor
                projectId={projectId}
                volumeRef={selectedVolumeName}
                onChapterSelect={(chapterRef) => focusNode(chapterRef)}
                onVolumeChange={refresh}
              />
            ) : (
              <div className="flex-1 flex flex-col">
                <EmptyState
                  onCreateVolume={() => void createVolume()}
                  onCreateChapter={() => void createChapter()}
                  onGoAdvanced={onGoAdvancedSettings}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 底部状态栏（专注模式保留，C6）：需选中章才显示字数/进度 */}
      {selectedRef && (
        <ChapterStatusBar key={selectedRef} projectId={projectId} chapterRef={selectedRef} />
      )}
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
