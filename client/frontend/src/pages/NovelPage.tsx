import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { TreeNode } from "@/components/novel/StructureTree";
import StructureTree from "@/components/novel/StructureTree";
import EmptyState from "@/components/novel/EmptyState";
import VolumeEditor from "@/components/novel/VolumeEditor";
import ChapterEditor from "@/components/novel/ChapterEditor";
import type { ChapterEditorHandle, AIWritingState } from "@/components/novel/ChapterEditor";
import VersionHistory from "@/components/novel/VersionHistory";
import SettingsFormField from "@/components/novel/SettingsFormField";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import { useOnboarding } from "@/hooks/useOnboarding";
import RightToolbar from "@/components/novel/RightToolbar";
import PromptManagementPage from "@/components/novel/PromptManagementPage";
import ArchivePage from "@/components/novel/ArchivePage";
import { Globe, Feather, Shield, Anchor, Users, Brain, Book, FileText, Trash2, ClipboardList } from "lucide-react";
import { useOutline } from "@/hooks/useOutline";
import OutlineOverview from "@/components/novel/outline/OutlineOverview";
import OutlineEditor from "@/components/novel/outline/OutlineEditor";
import PerspectiveModal from "@/components/novel/outline/PerspectiveModal";
import type { SelectionCapture } from "@/lib/selection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "settings" | "volume" | "chapter" | "prompts" | "writing" | "archives";

type ViewState =
  | { tab: "settings"; panel: string }
  | { tab: "writing"; panel: "empty" }
  | { tab: "writing"; panel: "volume"; volumeId: string }
  | { tab: "writing"; panel: "chapter"; chapterRef: string }
  | { tab: "writing"; panel: "versions"; chapterRef: string }
  | { tab: "prompts" }
  | { tab: "archives"; panel: "browser" }
  | { tab: "archives"; panel: "reader"; filename: string }
  | { tab: "volume"; panel: "overview" }
  | { tab: "volume"; panel: string; volumeId: string }
  | { tab: "chapter"; panel: "editor"; chapterRef: string };

// ---------------------------------------------------------------------------
// Tab labels
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: "settings", label: "设定" },
  { id: "volume", label: "卷纲" },
  { id: "chapter", label: "章纲" },
  { id: "prompts", label: "提示词" },
  { id: "writing", label: "正文" },
  { id: "archives", label: "归档" },
];

const SETTINGS_TREE_ITEMS: { id: string; icon: React.ReactNode; label: string }[] = [
  { id: "world", icon: <Globe className="w-3.5 h-3.5" />, label: "世界设定" },
  { id: "style", icon: <Feather className="w-3.5 h-3.5" />, label: "写作风格" },
  { id: "anti-ai", icon: <Shield className="w-3.5 h-3.5" />, label: "AI痕迹控制" },
  { id: "hooks", icon: <Anchor className="w-3.5 h-3.5" />, label: "伏笔管理" },
  { id: "characters", icon: <Users className="w-3.5 h-3.5" />, label: "角色管理" },
  { id: "ai-model", icon: <Brain className="w-3.5 h-3.5" />, label: "AI 模型" },
];

// ---------------------------------------------------------------------------
// NovelPage component
// ---------------------------------------------------------------------------

export default function NovelPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [tab, setTab] = useState<TabId>("settings");
  const [showDelete, setShowDelete] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({
    tab: "settings",
    panel: "world",
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { settingsStatus, allConfirmed, isNew, confirmSetting, loading: onboardingLoading } =
    useOnboarding(project?.id, volumes);

  const outline = useOutline(project?.id ?? "");

  const [perspectiveState, setPerspectiveState] = useState<{
    open: boolean;
    chapterRef: string;
    chapterSummary: string;
  }>({ open: false, chapterRef: "", chapterSummary: "" });

  // -----------------------------------------------------------------------
  // AI Writing: ref + mediated state for ChapterEditor <-> RightToolbar
  // -----------------------------------------------------------------------

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

  // Stable callbacks that reference the latest editor handle at call time
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

  // Switch default tab based on onboarding state
  useEffect(() => {
    if (!project || loading || onboardingLoading) return;
    if (isNew && tab === "writing") {
      setTab("settings");
      setViewState({ tab: "settings", panel: "world" });
    }
  }, [isNew, loading, onboardingLoading, project]);

  // -----------------------------------------------------------------------
  // Fetch project by id
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/projects/${id}`)
      .then((p: any) => {
        setProject(p);
      })
      .catch(() => {
        setProject(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // -----------------------------------------------------------------------
  // Load volumes when project is available
  // -----------------------------------------------------------------------

  const loadVolumes = useCallback(async () => {
    if (!project?.id) return;
    try {
      const vols = await api.get(`/projects/${project.id}/volumes`);
      const withChapters: any[] = [];
      for (const v of vols) {
        const data = await api.get(
          `/projects/${project.id}/volumes/${v.filename}`
        );
        withChapters.push({ ...v, chapters: data?.chapters || [] });
      }
      setVolumes(withChapters);
    } catch {
      // volumes might not be available yet
    }
  }, [project?.id]);

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  // Auto-expand the first volume on load
  useEffect(() => {
    if (volumes.length > 0 && expandedIds.size === 0) {
      const firstVolId = volumes[0].name || `vol-1`;
      setExpandedIds(new Set([firstVolId]));
    }
  }, [volumes, expandedIds.size]);

  // -----------------------------------------------------------------------
  // Derive writing tree nodes from volumes
  // -----------------------------------------------------------------------

  const writingTreeNodes: TreeNode[] = useMemo(() => {
    return volumes.map((v) => {
      const volNum = parseInt((v.name || "").replace("vol-", ""), 10) || 0;
      const chapterNodes: TreeNode[] = (v.chapters || []).map((ch: any) => {
        const ref = `vol-${volNum}-ch-${ch.chapter}`;
        const isDone =
          ch.status === "confirmed" || ch.status === "archived";
        return {
          id: ref,
          icon: <FileText className="w-3.5 h-3.5" />,
          label: ch.title || `ch-${ch.chapter}`,
          badge: isDone ? "done" : undefined,
          badgeColor: isDone ? "var(--su)" : undefined,
          data: { type: "chapter", ref, volume: ch.volume, chapter: ch.chapter },
          actions: [
            {
              icon: <ClipboardList className="w-3 h-3" />,
              label: "版本历史",
              onClick: (node: TreeNode) => {
                setViewState({
                  tab: "writing",
                  panel: "versions",
                  chapterRef: node.id,
                });
              },
            },
          ],
        };
      });

      return {
        id: v.name || `vol-${volNum}`,
        icon: <Book className="w-3.5 h-3.5" />,
        label: `第${volNum}卷`,
        badge: `${chapterNodes.length}章`,
        children: chapterNodes,
        data: { type: "volume", name: v.name, volNum },
      };
    });
  }, [volumes]);

  // -----------------------------------------------------------------------
  // Outline tree nodes
  // -----------------------------------------------------------------------

  const outlineTreeNodes: TreeNode[] = useMemo(() => {
    return outline.volumes.map((v) => {
      const chapterNodes: TreeNode[] = v.chapters.map((ch) => {
        const status = outline.chapterStatuses.get(ch.ref);
        const isDone = status === "confirmed";
        return {
          id: ch.ref,
          icon: <FileText className="w-3.5 h-3.5" />,
          label: ch.title || ch.ref,
          badge: isDone ? "done" : status === "in_progress" ? "进行中" : undefined,
          badgeColor: isDone ? "var(--su)" : status === "in_progress" ? "var(--wa)" : undefined,
          data: { type: "outline-chapter", ref: ch.ref },
        };
      });

      return {
        id: v.ref,
        icon: <Book className="w-3.5 h-3.5" />,
        label: v.title,
        badge: `${chapterNodes.length}章`,
        children: chapterNodes,
        data: { type: "outline-volume", ref: v.ref },
      };
    });
  }, [outline.volumes, outline.chapterStatuses]);

  // -----------------------------------------------------------------------
  // Settings tree nodes
  // -----------------------------------------------------------------------

  const settingsTreeNodes: TreeNode[] = useMemo(() => {
    return SETTINGS_TREE_ITEMS.map((item) => ({
      id: item.id,
      icon: item.icon,
      label: item.label,
      data: { type: "settings", key: item.id },
    }));
  }, []);

  // -----------------------------------------------------------------------
  // Tree callbacks
  // -----------------------------------------------------------------------

  const activeNodes =
    tab === "settings" ? settingsTreeNodes : (tab === "volume" || tab === "chapter") ? outlineTreeNodes : writingTreeNodes;

  const selectedId =
    tab === "settings"
      ? viewState.tab === "settings"
        ? viewState.panel
        : undefined
      : tab === "outline"
        ? viewState.tab === "chapter" && viewState.panel === "editor"
          ? viewState.chapterRef
          : undefined
        : viewState.tab === "writing" &&
            (viewState.panel === "chapter" || viewState.panel === "versions")
          ? viewState.chapterRef
          : undefined;

  const handleSelect = useCallback(
    (node: TreeNode) => {
      const data = node.data as Record<string, any> | undefined;
      if (!data) return;

      if (tab === "settings") {
        setViewState({ tab: "settings", panel: data.key as string });
      } else if (tab === "volume" || tab === "chapter") {
        if (data.type === "outline-chapter") {
          outline.loadChapterData(data.ref as string);
          setViewState({
            tab: "chapter",
            panel: "editor",
            chapterRef: data.ref as string,
          });
        }
      } else {
        // writing tab
        switch (data.type) {
          case "volume":
            setViewState({
              tab: "writing",
              panel: "volume",
              volumeId: data.name as string,
            });
            break;
          case "chapter":
            setViewState({
              tab: "writing",
              panel: "chapter",
              chapterRef: node.id,
            });
            break;
        }
      }
    },
    [tab, outline]
  );

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Tab switching
  // -----------------------------------------------------------------------

  const getCurrentChapterRef = useCallback((): string | undefined => {
    if (viewState.tab === "writing" && (viewState.panel === "chapter" || viewState.panel === "versions")) {
      return viewState.chapterRef;
    }
    return undefined;
  }, [viewState]);

  // -----------------------------------------------------------------------
  // Create volume from empty state
  // -----------------------------------------------------------------------

  const handleCreateVolume = useCallback(async () => {
    if (!project?.id) return;
    try {
      const volNum = volumes.length + 1;
      const result = await api.post(`/projects/${project.id}/volumes`, {
        title: `第${volNum}卷`,
        vol_num: volNum,
      });
      await loadVolumes();
      setViewState({
        tab: "writing",
        panel: "volume",
        volumeId: result.filename?.replace(".yaml", "") || `vol-${volNum}`,
      });
      // Auto-expand the new volume
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(result.filename?.replace(".yaml", "") || `vol-${volNum}`);
        return next;
      });
    } catch (e: any) {
      console.error("创建卷失败", e);
    }
  }, [project?.id, volumes.length, loadVolumes]);

  // -----------------------------------------------------------------------
  // Create chapter from empty state (auto-create a volume first if needed)
  // -----------------------------------------------------------------------

  const handleCreateChapter = useCallback(async () => {
    if (!project?.id) return;
    try {
      // If no volumes exist, create one first
      let targetVol = volumes[0];
      if (!targetVol) {
        const volResult = await api.post(`/projects/${project.id}/volumes`, {
          title: `第一卷`,
          vol_num: 1,
        });
        await loadVolumes();
        targetVol = { name: volResult.filename?.replace(".yaml", "") || "vol-1" };
      }

      const volRef = targetVol.name || "vol-1";
      const volNum = parseInt(volRef.replace("vol-", ""), 10) || 1;

      // Get current chapter count from this volume
      const volData = await api.get(`/projects/${project.id}/volumes/${volRef}.yaml`);
      const nextCh = (volData?.chapters?.length || 0) + 1;

      const result = await api.post(`/projects/${project.id}/chapters`, {
        volume: volNum,
        chapter: nextCh,
        title: `第${nextCh}章`,
      });
      await loadVolumes();
      const ref = (result.chapter_ref as string) || `vol-${volNum}-ch-${nextCh}`;
      setViewState({ tab: "writing", panel: "chapter", chapterRef: ref });
    } catch (e: any) {
      console.error("创建章节失败", e);
    }
  }, [project?.id, volumes, loadVolumes]);

  const handleGoSettings = useCallback(() => {
    setTab("settings");
    setViewState({ tab: "settings", panel: "world" });
  }, []);

  const handleTabSwitch = useCallback((newTab: TabId) => {
    setTab(newTab);
    if (newTab === "settings") {
      setViewState({ tab: "settings", panel: "world" });
    } else if (newTab === "volume") {
      setViewState({ tab: "volume", panel: "overview" });
    } else if (newTab === "chapter") {
      setViewState({ tab: "volume", panel: "overview" });
    } else if (newTab === "prompts") {
      setViewState({ tab: "prompts" });
    } else if (newTab === "archives") {
      setViewState({ tab: "archives", panel: "browser" });
    } else {
      setViewState({ tab: "writing", panel: "empty" });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Render right panel content
  // -----------------------------------------------------------------------

  const renderContent = useCallback(() => {
    switch (viewState.tab) {
      case "settings":
        return (
          <SettingsFormField
            projectId={project.id}
            settingKey={viewState.panel}
            confirmed={settingsStatus?.[viewState.panel] ?? false}
            onConfirm={() => confirmSetting(viewState.panel)}
          />
        );
      case "writing":
        switch (viewState.panel) {
          case "empty":
            return (
              <EmptyState
                onCreateVolume={handleCreateVolume}
                onCreateChapter={handleCreateChapter}
                onGoSettings={handleGoSettings}
                settingsComplete={allConfirmed}
              />
            );
          case "volume":
            return (
              <VolumeEditor
                projectId={project.id}
                volumeRef={viewState.volumeId}
                onChapterSelect={(chapterRef) =>
                  setViewState({
                    tab: "writing",
                    panel: "chapter",
                    chapterRef,
                  })
                }
                onVolumeChange={loadVolumes}
              />
            );
          case "chapter":
            return (
              <div className="flex h-full gap-0">
                <div className="flex-1 min-w-0 overflow-y-auto">
                  <ChapterEditor
                    ref={editorRef}
                    projectId={project.id}
                    chapterRef={viewState.chapterRef}
                    onShowVersion={() =>
                      setViewState({
                        tab: "writing",
                        panel: "versions",
                        chapterRef: viewState.chapterRef,
                      })
                    }
                    onAIStateChange={handleAIStateChange}
                  />
                </div>
                <RightToolbar
                  projectId={project.id}
                  chapterRef={viewState.chapterRef}
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
          case "versions":
            return (
              <VersionHistory
                projectId={project.id}
                chapterRef={viewState.chapterRef}
                onBack={() =>
                  setViewState({
                    tab: "writing",
                    panel: "chapter",
                    chapterRef: viewState.chapterRef,
                  })
                }
              />
            );
          default:
            return (
              <EmptyState
                onCreateVolume={handleCreateVolume}
                onCreateChapter={handleCreateChapter}
                onGoSettings={handleGoSettings}
                settingsComplete={allConfirmed}
              />
            );
        }
      case "volume":
        if (viewState.panel !== "overview" && viewState.panel) {
          return (
            <VolumeEditor
              projectId={project.id}
              volumeRef={viewState.panel}
              onChapterSelect={(chapterRef) =>
                setViewState({ tab: "chapter", panel: "editor", chapterRef })
              }
              onVolumeChange={loadVolumes}
            />
          );
        }
        return (
          <OutlineOverview
                volumes={outline.volumes}
                chapterStatuses={outline.chapterStatuses}
                chaptersMap={outline.chaptersMap}
                totalChapters={outline.totalChapters}
                filledCount={outline.filledCount}
                confirmedCount={outline.confirmedCount}
                allConfirmed={outline.allConfirmed}
                allHavePerspectiveGuidance={outline.allHavePerspectiveGuidance}
                loading={outline.loading}
                error={outline.error}
                onEditChapter={(ref) => {
                  outline.loadChapterData(ref);
                  setViewState({ tab: "chapter", panel: "editor", chapterRef: ref });
                }}
                onConfirmChapter={outline.confirmChapter}
                onPerspectiveChapter={(ref) => {
                  const chData = outline.chaptersMap.get(ref);
                  setPerspectiveState({
                    open: true,
                    chapterRef: ref,
                    chapterSummary: chData?.outline?.summary || "",
                  });
                }}
                onGlobalConfirm={outline.transitionToPrompt}
                onRetry={outline.refetchTree}
              />
            );
      case "chapter":
        if (viewState.panel === "editor") {
          return (
            <OutlineEditor
              projectId={project.id}
              chapterRef={viewState.chapterRef}
              chapterData={outline.chaptersMap.get(viewState.chapterRef) as any}
              onSave={outline.saveChapter}
              onConfirm={outline.confirmChapter}
              onBack={() => setViewState({ tab: "volume", panel: "overview" })}
            />
          );
        }
        return (
          <OutlineOverview
            volumes={outline.volumes}
            chapterStatuses={outline.chapterStatuses}
            chaptersMap={outline.chaptersMap}
            totalChapters={outline.totalChapters}
            filledCount={outline.filledCount}
            confirmedCount={outline.confirmedCount}
            allConfirmed={outline.allConfirmed}
            allHavePerspectiveGuidance={outline.allHavePerspectiveGuidance}
            loading={outline.loading}
            error={outline.error}
            onEditChapter={(ref) => {
              outline.loadChapterData(ref);
              setViewState({ tab: "chapter", panel: "editor", chapterRef: ref });
            }}
            onConfirmChapter={outline.confirmChapter}
            onPerspectiveChapter={(ref) => {
              const chData = outline.chaptersMap.get(ref);
              setPerspectiveState({
                open: true,
                chapterRef: ref,
                chapterSummary: chData?.outline?.summary || "",
              });
            }}
            onGlobalConfirm={outline.transitionToPrompt}
            onRetry={outline.refetchTree}
          />
        );
case "prompts":
        return <PromptManagementPage projectId={project.id} />;
      case "archives":
        return (
          <ArchivePage
            projectId={project.id}
            projectName={project.name}
            onNavigateToEditor={(chapterRef) => {
              setTab("writing");
              setViewState({ tab: "writing", panel: "chapter", chapterRef });
            }}
            onBack={() => {
              setTab("writing");
              setViewState({ tab: "writing", panel: "empty" });
            }}
          />
        );
      default:
        return <EmptyState settingsComplete={allConfirmed} />;
    }
  }, [viewState, outline, project, settingsStatus, confirmSetting, allConfirmed, handleCreateVolume, handleCreateChapter, handleGoSettings, setViewState, loadVolumes, handleAIStateChange, aiState, handleContinue, handlePolish, handleExpand, captureNow, setTab]);

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Skeleton top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200/50">
          <div className="skeleton h-5 w-32" />
          <div className="flex gap-1">
            <div className="skeleton h-8 w-12" />
            <div className="skeleton h-8 w-12" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-8 w-8" />
            <div className="skeleton h-8 w-8" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-56 flex-shrink-0 border-r border-base-300 bg-base-200/30 p-2">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-7 w-full" />
              ))}
            </div>
          </aside>
          <main className="flex-1 flex items-center justify-center">
            <span className="loading loading-spinner loading-md text-primary" />
          </main>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-base-content/40">
        项目不存在或无权访问
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200/50">
        {/* Project name */}
        <h1 className="text-lg font-bold font-serif text-base-content">
          {project.name}
        </h1>

        {/* Tabs: 设定 / 正文 / 细纲 / 提示词 / 归档 */}
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabSwitch(t.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-content font-medium"
                  : "text-base-content/60 hover:text-base-content hover:bg-base-300/40"
              }`}
            >
              {t.label}
              {t.id === "archives" && (project?.total_archives ?? 0) > 0 && (
                <span className="badge badge-accent badge-xs ml-1">
                  {project.total_archives}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDelete(true)}
            className="text-base-content/30 hover:text-error transition-colors p-1.5 rounded-md hover:bg-error/10"
            title="删除小说"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Dual panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left tree panel — hidden on prompts & archives tabs */}
        {tab !== "prompts" && tab !== "archives" && (
          <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
            <StructureTree
              nodes={activeNodes}
              selectedId={selectedId}
              onSelect={handleSelect}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />
          </aside>
        )}

        {/* Right content panel */}
        <main className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </main>
      </div>
    </div>

      {showDelete && (
        <DeleteConfirmModal
          title="小说"
          confirmText={project.name}
          onConfirm={async () => {
            await api.delete(`/projects/${project.id}`);
            window.location.href = "/books";
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}

      {perspectiveState.open && (
        <PerspectiveModal
          open={perspectiveState.open}
          onClose={() => setPerspectiveState((prev) => ({ ...prev, open: false }))}
          projectId={project.id}
          chapterRef={perspectiveState.chapterRef}
          chapterSummary={perspectiveState.chapterSummary}
          existingGuidance={outline.chaptersMap.get(perspectiveState.chapterRef)?.outline?.perspective_guidance}
          onSaved={(guidance) => {
            outline.saveChapter(perspectiveState.chapterRef, {
              outline: {
                ...(outline.chaptersMap.get(perspectiveState.chapterRef)?.outline || {}),
                perspective_guidance: guidance,
              },
            });
          }}
        />
      )}
    </>
  );
}
