import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Step1Result } from "@/lib/api";
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
import AiReviewStep1 from "@/components/novel/AiReviewStep1";
import AiReviewStep2 from "@/components/novel/AiReviewStep2";
import { Globe, Feather, Shield, Anchor, Users, Brain, Book, FileText, Trash2, ClipboardList, BookOpen, AlertTriangle, RefreshCw, Sparkles, Pencil, LifeBuoy } from "lucide-react";
import { useOutline } from "@/hooks/useOutline";
import OutlineOverview from "@/components/novel/outline/OutlineOverview";
import OutlineEditor from "@/components/novel/outline/OutlineEditor";
import PerspectiveModal from "@/components/novel/outline/PerspectiveModal";
import type { SelectionCapture } from "@/lib/selection";
import { useNovelState } from "@/hooks/useNovelState";
import TabProgressButton from "@/components/novel/TabProgressButton";
import GateBanner from "@/components/novel/GateBanner";
import OnboardingCard from "@/components/novel/OnboardingCard";

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
  | { tab: "chapter"; panel: "overview" }
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

// Map tab IDs to workflow phase keys for status lookup
const TAB_PHASE_MAP: Record<string, "settings" | "outline" | "prompt" | "write" | "archive"> = {
  settings: "settings",
  volume: "outline",
  chapter: "outline",   // 章纲属于大纲阶段
  prompts: "prompt",
  writing: "write",
  archives: "archive",
};

// 注意：作品列表（NovelListPage）已把后端 current_phase 映射为 Tab 值
// （如 outline → "volume"）并通过 location.state.initialTab 传入，
// 这里直接信任传入值，不要再做第二次阶段映射。

function initialViewState(tab: TabId): ViewState {
  switch (tab) {
    case "settings":
      return { tab: "settings", panel: "world" };
    case "volume":
      return { tab: "volume", panel: "overview" };
    case "chapter":
      return { tab: "chapter", panel: "overview" };
    case "prompts":
      return { tab: "prompts" };
    case "writing":
      return { tab: "writing", panel: "empty" };
    case "archives":
      return { tab: "archives", panel: "browser" };
  }
}

const SETTINGS_TREE_ITEMS: { id: string; icon: React.ReactNode; label: string }[] = [
  { id: "genre", icon: <BookOpen className="w-3.5 h-3.5" />, label: "题材设定" },
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
  const location = useLocation();
  const initialTab = useMemo<TabId>(() => {
    const candidate = (location.state as { initialTab?: TabId } | null)?.initialTab;
    return candidate || "settings";
  }, [location.state]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [volumesError, setVolumesError] = useState(false);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [showDelete, setShowDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameSavedRef = useRef(false); // 防 Enter 保存后 blur 再触发双保存
  const [viewState, setViewState] = useState<ViewState>(() => initialViewState(initialTab));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const {
    settingsStatus,
    allConfirmed,
    isNew,
    confirmSetting,
    loading: onboardingLoading,
    error: onboardingError,
    loadStatus: reloadOnboarding,
  } = useOnboarding(project?.id, volumes);

  // PRD 3.4 AC-4.3：「仍然继续」会话内旁路——点创建卷/章后不再提示设定未完成
  const [settingsBypass, setSettingsBypass] = useState(false);
  useEffect(() => {
    setSettingsBypass(false);
  }, [id]);

  // ── AI Review flow (for imported projects on paid tier) ────────────────
  const [userTier, setUserTier] = useState<string | null>(null);
  const [aiReviewStep, setAiReviewStep] = useState<1 | 2 | null>(null);
  const [step1Result, setStep1Result] = useState<Step1Result | null>(null);
  const [aiReviewDismissed, setAiReviewDismissed] = useState(false);

  // Fetch user tier on mount
  useEffect(() => {
    api.post("/auth/verify").then((r: any) => {
      if (r.tier) setUserTier(r.tier);
    }).catch(() => {});
  }, []);

  // Show AI review flow if: imported project + paid user + not dismissed
  useEffect(() => {
    if (!project || userTier === null || aiReviewDismissed) return;
    if (project.source === "import" && userTier !== "none") {
      // Check if already backfilled
      api.fetchBackfillStatus(project.id)
        .then((status: any) => {
          // Only show if not already completed
          if (!status?.completed) {
            setAiReviewStep(1);
          }
        })
        .catch(() => {
          // If status endpoint fails, still show the flow
          setAiReviewStep(1);
        });
    }
  }, [project, userTier, aiReviewDismissed]);

  const { phaseStatus, warnings, loading: phaseStatusLoading, error: phaseStatusError, refetch: refetchPhaseStatus } =
    useNovelState(id);

  // PRD 3.4：确认设定成功 → 刷新 phase-status（gate 重算 → banner/EmptyState 即时更新）
  const handleConfirmSetting = useCallback(
    async (type: string) => {
      const ok = await confirmSetting(type);
      if (ok) refetchPhaseStatus();
    },
    [confirmSetting, refetchPhaseStatus],
  );

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (!id) return false;
    return (
      sessionStorage.getItem(`gate-banner-dismissed-${id}`) === 'true' ||
      localStorage.getItem(`gate-banner-dismissed-${id}`) === 'true'
    );
  });

  const handleDismissBanner = useCallback(() => {
    if (!id) return;
    setBannerDismissed(true);
    // 轻关闭：仅本次会话隐藏，重启应用后恢复提醒
    sessionStorage.setItem(`gate-banner-dismissed-${id}`, 'true');
  }, [id]);

  // ── Onboarding card ──────────────────────────────────────────────────────

  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (!id) return true;
    return (
      sessionStorage.getItem(`onboarding-dismissed-${id}`) === 'true' ||
      localStorage.getItem(`onboarding-dismissed-${id}`) === 'true'
    );
  });

  /** 「知道了」轻关闭：仅本次会话隐藏 */
  const handleDismissOnboarding = useCallback(() => {
    if (!id) return;
    setOnboardingDismissed(true);
    sessionStorage.setItem(`onboarding-dismissed-${id}`, 'true');
  }, [id]);

  /** 「开始设定」主路径：用户已真正开始创作，之后不再打扰 */
  const handleStartOnboarding = useCallback(() => {
    if (!id) return;
    setOnboardingDismissed(true);
    localStorage.setItem(`onboarding-dismissed-${id}`, 'true');
  }, [id]);

  /** 重新打开已关闭的阶段引导（GateBanner / OnboardingCard） */
  const handleReopenGuides = useCallback(() => {
    if (!id) return;
    setBannerDismissed(false);
    setOnboardingDismissed(false);
    sessionStorage.removeItem(`gate-banner-dismissed-${id}`);
    sessionStorage.removeItem(`onboarding-dismissed-${id}`);
    localStorage.removeItem(`gate-banner-dismissed-${id}`);
    localStorage.removeItem(`onboarding-dismissed-${id}`);
  }, [id]);

  // 引导卡：新作品（尚无卷、设定未全部确认）时显示；
  // 不要用"所有阶段 pending"判断——新项目 current_phase 已是 settings，
  // phase-status 会返回 in_progress，导致引导卡永不出现。
  const showOnboarding = isNew && !onboardingDismissed;

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

  const loadProject = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const p = await api.get(`/novels/${id}`);
      setProject(p);
    } catch {
      setProject(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // -----------------------------------------------------------------------
  // Load volumes when project is available
  // -----------------------------------------------------------------------

  const loadVolumes = useCallback(async () => {
    if (!project?.id) return;
    setVolumesError(false);
    try {
      const vols = await api.get(`/novels/${project.id}/volumes`);
      const withChapters: any[] = [];
      for (const v of vols) {
        const data = await api.get(
          `/novels/${project.id}/volumes/${v.filename}`
        );
        withChapters.push({ ...v, chapters: data?.chapters || [] });
      }
      setVolumes(withChapters);
    } catch {
      // 加载失败：标记错误态，避免把"有内容的书"伪装成空作品
      setVolumesError(true);
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
          group: "正文",
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
        group: "卷纲",
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
          group: "章纲",
          badge: isDone ? "done" : status === "in_progress" ? "进行中" : undefined,
          badgeColor: isDone ? "var(--su)" : status === "in_progress" ? "var(--wa)" : undefined,
          data: { type: "outline-chapter", ref: ch.ref },
        };
      });

      return {
        id: v.ref,
        icon: <Book className="w-3.5 h-3.5" />,
        label: v.title,
        group: "卷纲",
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
      : (tab === "volume" || tab === "chapter")
        ? viewState.tab === "chapter" && viewState.panel === "editor"
          ? viewState.chapterRef
          : undefined
        : viewState.tab === "writing" &&
            (viewState.panel === "chapter" || viewState.panel === "versions")
          ? viewState.chapterRef
          : undefined;

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

  const handleSelect = useCallback(
    (node: TreeNode) => {
      const data = node.data as Record<string, any> | undefined;
      if (!data) return;

      if (tab === "settings") {
        setViewState({ tab: "settings", panel: data.key as string });
      } else if (tab === "volume" || tab === "chapter") {
        if (data.type === "outline-volume") {
          // 卷纲节点：点击展开/收起该卷下的章纲
          handleToggle(node.id);
        } else if (data.type === "outline-chapter") {
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
    [tab, outline, handleToggle]
  );

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
    setSettingsBypass(true); // AC-4.3「仍然继续」：作者选择创建卷即旁路设定提示
    try {
      const volNum = volumes.length + 1;
      const result = await api.post(`/novels/${project.id}/volumes`, {
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
    setSettingsBypass(true); // AC-4.3「仍然继续」：作者选择写第一章即旁路设定提示
    try {
      // If no volumes exist, create one first
      let targetVol = volumes[0];
      if (!targetVol) {
        const volResult = await api.post(`/novels/${project.id}/volumes`, {
          title: `第一卷`,
          vol_num: 1,
        });
        await loadVolumes();
        targetVol = { name: volResult.filename?.replace(".yaml", "") || "vol-1" };
      }

      const volRef = targetVol.name || "vol-1";
      const volNum = parseInt(volRef.replace("vol-", ""), 10) || 1;

      // Get current chapter count from this volume
      const volData = await api.get(`/novels/${project.id}/volumes/${volRef}.yaml`);
      const nextCh = (volData?.chapters?.length || 0) + 1;

      const result = await api.post(`/novels/${project.id}/chapters`, {
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
      setViewState({ tab: "chapter", panel: "overview" });
    } else if (newTab === "prompts") {
      setViewState({ tab: "prompts" });
    } else if (newTab === "archives") {
      setViewState({ tab: "archives", panel: "browser" });
    } else {
      setViewState({ tab: "writing", panel: "empty" });
    }
  }, []);

  // 顶栏书名就地编辑：blur/Enter 保存，Esc 取消（savedRef 防双保存竞态）
  const saveName = useCallback(async () => {
    const next = nameDraft.trim();
    if (nameSavedRef.current) {
      nameSavedRef.current = false;
      return;
    }
    nameSavedRef.current = true;
    setEditingName(false);
    if (!next || next === project.name) return;
    try {
      const updated = await api.renameNovel(project.id, next);
      setProject((p: any) => ({ ...p, name: updated.name }));
      toast.success(`已更名为《${updated.name}》`);
    } catch {
      toast.error("改名失败");
    }
  }, [nameDraft, project, toast]);

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
            onConfirm={() => handleConfirmSetting(viewState.panel)}
            synopsisConfirmed={settingsStatus?.synopsis ?? false}
            onSynopsisConfirm={() => handleConfirmSetting("synopsis")}
          />
        );
      case "writing":
        switch (viewState.panel) {
          case "empty":
            if (volumesError) {
              return (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                  <AlertTriangle className="w-8 h-8 text-warning" />
                  <p className="text-sm text-base-content/70">
                    正文卷加载失败，网络好像开了个小差。
                  </p>
                  <button
                    className="btn btn-primary btn-sm gap-1.5"
                    onClick={loadVolumes}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新加载
                  </button>
                </div>
              );
            }
            return (
              <EmptyState
                onCreateVolume={handleCreateVolume}
                onCreateChapter={handleCreateChapter}
                onGoSettings={handleGoSettings}
                settingsComplete={allConfirmed}
                bypass={settingsBypass}
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
            if (volumesError) {
              return (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                  <AlertTriangle className="w-8 h-8 text-warning" />
                  <p className="text-sm text-base-content/70">
                    正文卷加载失败，网络好像开了个小差。
                  </p>
                  <button
                    className="btn btn-primary btn-sm gap-1.5"
                    onClick={loadVolumes}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新加载
                  </button>
                </div>
              );
            }
            return (
              <EmptyState
                onCreateVolume={handleCreateVolume}
                onCreateChapter={handleCreateChapter}
                onGoSettings={handleGoSettings}
                settingsComplete={allConfirmed}
                bypass={settingsBypass}
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
        if (viewState.panel === "overview") {
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
        }
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
        return <EmptyState settingsComplete={allConfirmed} bypass={settingsBypass} />;
    }
  }, [viewState, outline, project, settingsStatus, allConfirmed, handleConfirmSetting, settingsBypass, handleCreateVolume, handleCreateChapter, handleGoSettings, setViewState, loadVolumes, handleAIStateChange, aiState, handleContinue, handlePolish, handleExpand, captureNow, setTab]);

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-base-content/60">
        <p className="text-base">
          {loadError ? "作品加载失败，网络好像开了个小差" : "项目不存在或无权访问"}
        </p>
        {loadError && (
          <button className="btn btn-primary btn-sm" onClick={loadProject}>
            <RefreshCw className="w-4 h-4" />
            重新加载
          </button>
        )}
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
        {/* Project name (inline rename) */}
        <div className="min-w-0 flex items-center">
          {editingName ? (
            <input
              className="input input-sm input-bordered w-36 font-serif text-base-content"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  nameSavedRef.current = true;
                  setNameDraft(project.name);
                  setEditingName(false);
                }
              }}
              maxLength={60}
              autoFocus
              aria-label="小说书名"
            />
          ) : (
            <button
              className="group/name flex items-center gap-1.5 max-w-full"
              onClick={() => {
                setNameDraft(project.name);
                setEditingName(true);
              }}
              title="点击修改书名"
              aria-label="点击修改书名"
            >
              <h1 className="text-lg font-bold font-serif text-base-content truncate max-w-[30vw] group-hover/name:text-primary transition-colors">
                {project.name}
              </h1>
              <Pencil className="w-3.5 h-3.5 text-base-content/30 group-hover/name:text-base-content/70 transition-colors shrink-0" />
            </button>
          )}
        </div>

        {/* Tabs: 设定 / 卷纲 / 章纲 / 提示词 / 正文 / 归档 */}
        <div className="flex items-center gap-1 flex-wrap">
          {phaseStatusLoading && (
            <div className="skeleton h-5 w-24 rounded shrink-0" />
          )}
          {phaseStatusError && (
            <button
              onClick={refetchPhaseStatus}
              className="btn btn-ghost btn-xs px-1 text-warning"
              title="阶段状态加载失败，点击重试"
            >
              <AlertTriangle className="w-3 h-3" />
            </button>
          )}
          {onboardingError && (
            <button
              onClick={reloadOnboarding}
              className="btn btn-ghost btn-xs px-1 text-warning"
              title="设定状态加载失败，点击重试"
              aria-label="设定状态加载失败，点击重试"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
          {TABS.map((t) => (
            <TabProgressButton
              key={t.id}
              label={t.label}
              status={phaseStatus ? phaseStatus[TAB_PHASE_MAP[t.id]] : undefined}
              active={tab === t.id}
              onClick={() => handleTabSwitch(t.id)}
            >
              {t.id === "archives" && (project?.total_archives ?? 0) > 0 && (
                <span className="badge badge-accent badge-xs ml-1">
                  {project.total_archives}
                </span>
              )}
            </TabProgressButton>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReopenGuides}
            className="text-base-content/30 hover:text-primary transition-colors p-1.5 rounded-md hover:bg-primary/10"
            title="重新打开阶段引导"
            aria-label="重新打开阶段引导"
          >
            <LifeBuoy className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="text-base-content/30 hover:text-error transition-colors p-1.5 rounded-md hover:bg-error/10"
            title="删除小说"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Phase status loading skeleton ──────────────────────── */}
      {phaseStatusLoading && (
        <div className="skeleton h-1 w-full rounded-none shrink-0" />
      )}

      {/* ── Gate banner ────────────────────────────────────────── */}
      {!bannerDismissed && (
        <GateBanner
          warnings={warnings}
          onDismiss={handleDismissBanner}
          onJump={(key) => {
            if (key === "synopsis") {
              handleTabSwitch("settings");
              // 简介卡在 settings 各面板顶部全局常驻，滚动到它并高亮
              setTimeout(() => {
                const el = document.getElementById("synopsis-card");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 120);
            } else {
              handleTabSwitch("settings");
              setViewState({ tab: "settings", panel: key });
            }
          }}
        />
      )}

      {/* ── Onboarding card ────────────────────────────────────── */}
      {showOnboarding && (
        <OnboardingCard
          novelId={id!}
          source={project.source}
          variant={project.source === "import" ? "imported-novel" : "empty-novel"}
          onDismiss={handleDismissOnboarding}
          onStart={() => {
            handleStartOnboarding();
            handleTabSwitch("settings");
          }}
        />
      )}

      {/* ── Dual panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left tree panel — hidden on prompts, archives tabs, or AI review flow */}
        {tab !== "prompts" && tab !== "archives" && !aiReviewStep && (
          <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
            <div className="px-2 pt-1.5 pb-1.5 text-[10px] font-medium tracking-wider text-base-content/40 flex items-center gap-2">
              {tab === "settings" ? "设定" : tab === "volume" || tab === "chapter" ? "卷纲 · 章纲" : "正文"}
              <span className="flex-1 h-px bg-base-300/40" />
            </div>
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
          {aiReviewStep ? (
            <div className="max-w-2xl mx-auto pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="font-serif font-semibold text-lg">AI 反推审阅</h2>
                <span className="text-xs text-base-content/30">步骤 {aiReviewStep}/2</span>
              </div>

              {aiReviewStep === 1 && (
                <AiReviewStep1
                  novelId={project.id}
                  onComplete={(result) => {
                    setStep1Result(result);
                    setAiReviewStep(2);
                  }}
                  onBack={() => {
                    setAiReviewStep(null);
                    setAiReviewDismissed(true);
                  }}
                />
              )}

              {aiReviewStep === 2 && step1Result && (
                <AiReviewStep2
                  novelId={project.id}
                  step1Result={step1Result}
                  onComplete={() => {
                    setAiReviewStep(null);
                    setAiReviewDismissed(true);
                    setTab("writing");
                    setViewState({ tab: "writing", panel: "empty" });
                  }}
                  onBack={() => {
                    setAiReviewStep(1);
                  }}
                />
              )}
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </div>

      {showDelete && (
        <DeleteConfirmModal
          title="小说"
          confirmText={project.name}
          onConfirm={async () => {
            await api.delete(`/novels/${project.id}`);
            window.location.href = "/novels";
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
