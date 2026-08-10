import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import NovelBar from "@/components/novel/NovelBar";
import Workbench from "@/components/novel/Workbench";
import ProContainer from "@/components/novel/ProContainer";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import StructureTree from "@/components/novel/StructureTree";
import SettingsFormField from "@/components/novel/SettingsFormField";
import OutlineOverview from "@/components/novel/outline/OutlineOverview";
import OutlineEditor from "@/components/novel/outline/OutlineEditor";
import PerspectiveModal from "@/components/novel/outline/PerspectiveModal";
import ArchivePage from "@/components/novel/ArchivePage";
import TabProgressButton from "@/components/novel/TabProgressButton";
import GateBanner from "@/components/novel/GateBanner";
import OnboardingCard from "@/components/novel/OnboardingCard";
import { useWorkbench } from "@/hooks/useWorkbench";
import { useNovelState } from "@/hooks/useNovelState";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useOutline } from "@/hooks/useOutline";
import type { TreeNode } from "@/components/novel/StructureTree";
import {
  Globe,
  Feather,
  Shield,
  Anchor,
  Users,
  Brain,
  BookOpen,
  FileText,
  Book,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// 设定左侧树（沿用 NovelPage SETTINGS_TREE_ITEMS，P0 壳）
// ---------------------------------------------------------------------------

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
// NovelWorkspace — 四态视图机（C5/P0-5）
//   workbench 常驻挂载（hidden 切换保 prose 脏状态/光标）
//   advanced-settings / advanced-outline / archives 懒挂载、离开卸载
// ---------------------------------------------------------------------------

export default function NovelWorkspace() {
  const { id } = useParams<{ id: string }>();
  const wb = useWorkbench();
  const { view, setView, project } = wb;
  const [showDelete, setShowDelete] = useState(false);

  // 设定确认后刷新 PRO phase-status（ProPhaseSurface 常驻于 ProContainer；免费态注册空 fn）
  const phaseRefetchRef = useRef<() => void>(() => {});
  const registerPhaseRefetch = useCallback((fn: () => void) => {
    phaseRefetchRef.current = fn;
  }, []);

  const go = useCallback(
    (next: "workbench" | "advanced-settings" | "advanced-outline" | "archives", payload?: Record<string, any>) => {
      setView(next, payload);
    },
    [setView],
  );

  return (
    <div className="flex flex-col h-full">
      <NovelBar
        onGoAdvancedSettings={() => go("advanced-settings")}
        onGoAdvancedOutline={() => go("advanced-outline")}
        onGoArchives={() => go("archives")}
        onDelete={() => setShowDelete(true)}
      />

      {/* PRO 阶段催促子树：免费态整棵不渲染、零 phase-status 请求（N14 / 4.1-8） */}
      <ProContainer>
        <ProPhaseSurface
          projectId={project?.id ?? ""}
          source={project?.source}
          view={view}
          onGoSettings={() => go("advanced-settings")}
          onGoOutline={() => go("advanced-outline")}
          onGoWorkbench={() => go("workbench")}
          onGoArchives={() => go("archives")}
          onGoAdvanced={(key) => go("advanced-settings", { panel: key })}
          registerRefetch={registerPhaseRefetch}
        />
      </ProContainer>

      {/* Workbench 常驻挂载：hidden 切换（保 1.5s 防抖窗内的 prose 脏状态与光标） */}
      <div className="flex-1 min-h-0" hidden={view !== "workbench"}>
        <Workbench
          wb={wb}
          onGoAdvancedSettings={() => go("advanced-settings")}
          onGoAdvancedOutline={() => go("advanced-outline")}
        />
      </div>

      {/* advanced / archives：懒挂载 + 离开卸载 */}
      {view === "advanced-settings" && (
        <div className="flex-1 min-h-0">
          <AdvancedSettingsView
            projectId={project?.id ?? ""}
            initialPanel={wb.viewPayload?.panel as string | undefined}
            onBack={() => go("workbench")}
            onSettingConfirmed={() => phaseRefetchRef.current()}
          />
        </div>
      )}
      {view === "advanced-outline" && (
        <div className="flex-1 min-h-0">
          <AdvancedOutlineView projectId={project?.id ?? ""} onBack={() => go("workbench")} />
        </div>
      )}
      {view === "archives" && (
        <div className="flex-1 min-h-0">
          <ArchivePage
            projectId={project?.id ?? ""}
            projectName={project?.name ?? ""}
            onNavigateToEditor={(ref) => go("workbench", { focusRef: ref })}
            onBack={() => go("workbench")}
          />
        </div>
      )}

      {showDelete && (
        <DeleteConfirmModal
          title="小说"
          confirmText={project?.name ?? ""}
          onConfirm={async () => {
            if (!project?.id) return;
            await api.delete(`/novels/${project.id}`);
            window.location.href = "/novels";
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProPhaseSurface — PRO 阶段催促子树（TABS + GateBanner + OnboardingCard）
//   位于 ProContainer 内部：免费态不挂载 → useNovelState 零请求
// ---------------------------------------------------------------------------

function ProPhaseSurface({
  projectId,
  source,
  view,
  onGoSettings,
  onGoOutline,
  onGoWorkbench,
  onGoArchives,
  onGoAdvanced,
  registerRefetch,
}: {
  projectId: string;
  source: string | undefined;
  view: string;
  onGoSettings: () => void;
  onGoOutline: () => void;
  onGoWorkbench: () => void;
  onGoArchives: () => void;
  onGoAdvanced: (key: string) => void;
  registerRefetch: (fn: () => void) => void;
}) {
  const { phaseStatus, warnings, loading, error, refetch } = useNovelState(projectId || undefined);

  useEffect(() => {
    registerRefetch(refetch);
    return () => registerRefetch(() => {});
  }, [refetch, registerRefetch]);

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (!projectId) return false;
    return localStorage.getItem(`gate-banner-dismissed-${projectId}`) === "true";
  });
  const handleDismissBanner = useCallback(() => {
    if (!projectId) return;
    setBannerDismissed(true);
    localStorage.setItem(`gate-banner-dismissed-${projectId}`, "true");
  }, [projectId]);

  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (!projectId) return true;
    return localStorage.getItem(`onboarding-dismissed-${projectId}`) === "true";
  });
  const handleDismissOnboarding = useCallback(() => {
    if (!projectId) return;
    setOnboardingDismissed(true);
    localStorage.setItem(`onboarding-dismissed-${projectId}`, "true");
  }, [projectId]);

  const allPhasesPending =
    phaseStatus !== null && Object.values(phaseStatus).every((s) => s === "pending");
  const showOnboarding = allPhasesPending && !onboardingDismissed;

  return (
    <>
      {/* 阶段 tabs（PRO）：设定 / 大纲 / 正文 / 归档 → 四态视图 */}
      <div className="flex items-center gap-1 px-4 py-1 border-b border-base-300 bg-base-200/30 shrink-0">
        {loading && <div className="skeleton h-5 w-24 rounded shrink-0" />}
        {error && (
          <button
            onClick={refetch}
            className="btn btn-ghost btn-xs px-1 text-warning"
            title="阶段状态加载失败，点击重试"
          >
            <AlertTriangle className="w-3 h-3" />
          </button>
        )}
        <TabProgressButton
          label="设定"
          status={phaseStatus?.settings}
          active={view === "advanced-settings"}
          onClick={onGoSettings}
        />
        <TabProgressButton
          label="大纲"
          status={phaseStatus?.outline}
          active={view === "advanced-outline"}
          onClick={onGoOutline}
        />
        <TabProgressButton
          label="正文"
          status={phaseStatus?.write}
          active={view === "workbench"}
          onClick={onGoWorkbench}
        />
        <TabProgressButton
          label="归档"
          status={phaseStatus?.archive}
          active={view === "archives"}
          onClick={onGoArchives}
        />
      </div>

      {!bannerDismissed && (
        <GateBanner warnings={warnings} onDismiss={handleDismissBanner} onJump={onGoAdvanced} />
      )}

      {showOnboarding && (
        <OnboardingCard
          novelId={projectId}
          source={(source as "ai" | "manual" | "import") ?? "manual"}
          variant={source === "import" ? "imported-novel" : "empty-novel"}
          onDismiss={handleDismissOnboarding}
          onStart={() => {
            handleDismissOnboarding();
            onGoSettings();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// AdvancedSettingsView — 设定面板（P0 壳：设定树 + SettingsFormField）
// ---------------------------------------------------------------------------

function AdvancedSettingsView({
  projectId,
  initialPanel,
  onBack,
  onSettingConfirmed,
}: {
  projectId: string;
  initialPanel?: string;
  onBack: () => void;
  onSettingConfirmed: () => void;
}) {
  const [panel, setPanel] = useState<string>(
    initialPanel && initialPanel !== "synopsis" ? initialPanel : "world",
  );
  const { settingsStatus, confirmSetting } = useOnboarding(projectId, []);

  // GateBanner 跳转（synopsis → 简介卡 / 设定 key → 对应面板）；已挂载时响应 payload 变化
  useEffect(() => {
    if (initialPanel && initialPanel !== "synopsis") setPanel(initialPanel);
  }, [initialPanel]);
  useEffect(() => {
    if (initialPanel === "synopsis") {
      setTimeout(() => {
        const el = document.getElementById("synopsis-card");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = useCallback(
    async (type: string) => {
      const ok = await confirmSetting(type);
      if (ok) onSettingConfirmed();
    },
    [confirmSetting, onSettingConfirmed],
  );

  const nodes: TreeNode[] = useMemo(
    () =>
      SETTINGS_TREE_ITEMS.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: item.label,
        data: { type: "settings", key: item.id },
      })),
    [],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-base-300 bg-base-200/30 shrink-0">
        <span className="text-sm font-medium text-base-content/60">设定</span>
        <button onClick={onBack} className="btn btn-ghost btn-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回正文
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
          <StructureTree
            nodes={nodes}
            selectedId={panel}
            onSelect={(node) => {
              const d = node.data as Record<string, any> | undefined;
              if (d?.key) setPanel(d.key as string);
            }}
            expandedIds={new Set()}
            onToggle={() => {}}
          />
        </aside>
        <main className="flex-1 overflow-y-auto p-4">
          <SettingsFormField
            projectId={projectId}
            settingKey={panel}
            confirmed={settingsStatus?.[panel] ?? false}
            onConfirm={() => void handleConfirm(panel)}
            synopsisConfirmed={settingsStatus?.synopsis ?? false}
            onSynopsisConfirm={() => void handleConfirm("synopsis")}
          />
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdvancedOutlineView — 大纲（P0 壳：大纲树 + OutlineOverview/OutlineEditor）
// ---------------------------------------------------------------------------

function AdvancedOutlineView({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const outline = useOutline(projectId);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [perspectiveState, setPerspectiveState] = useState<{
    open: boolean;
    chapterRef: string;
    chapterSummary: string;
  }>({ open: false, chapterRef: "", chapterSummary: "" });

  useEffect(() => {
    if (outline.volumes.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set([outline.volumes[0].ref]));
    }
  }, [outline.volumes, expandedIds.size]);

  const nodes: TreeNode[] = useMemo(() => {
    return outline.volumes.map((v) => {
      const chapterNodes: TreeNode[] = v.chapters.map((ch) => {
        const status = outline.chapterStatuses.get(ch.ref);
        const isDone = status === "confirmed";
        return {
          id: ch.ref,
          label: ch.title || ch.ref,
          badge: isDone ? "done" : status === "in_progress" ? "进行中" : undefined,
          badgeColor: isDone ? "var(--su)" : status === "in_progress" ? "var(--wa)" : undefined,
          data: { type: "outline-chapter", ref: ch.ref },
        };
      });
      return {
        id: v.ref,
        label: v.title,
        badge: `${chapterNodes.length}章`,
        children: chapterNodes,
        data: { type: "outline-volume", ref: v.ref },
      };
    });
  }, [outline.volumes, outline.chapterStatuses]);

  const handleSelect = useCallback(
    (node: TreeNode) => {
      const data = node.data as Record<string, any> | undefined;
      if (!data) return;
      if (data.type === "outline-chapter") {
        const ref = data.ref as string;
        setSelectedRef(ref);
        void outline.loadChapterData(ref);
      }
    },
    [outline],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-base-300 bg-base-200/30 shrink-0">
        <span className="text-sm font-medium text-base-content/60">大纲</span>
        <button onClick={onBack} className="btn btn-ghost btn-xs gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回正文
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
          <StructureTree
            nodes={nodes}
            selectedId={selectedRef ?? undefined}
            onSelect={handleSelect}
            expandedIds={expandedIds}
            onToggle={(id) =>
              setExpandedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />
        </aside>
        <main className="flex-1 overflow-y-auto p-4">
          {selectedRef ? (
            <OutlineEditor
              projectId={projectId}
              chapterRef={selectedRef}
              chapterData={outline.chaptersMap.get(selectedRef) as any}
              onSave={outline.saveChapter}
              onConfirm={outline.confirmChapter}
              onBack={() => setSelectedRef(null)}
            />
          ) : (
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
                setSelectedRef(ref);
                void outline.loadChapterData(ref);
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
          )}
        </main>
      </div>
      {perspectiveState.open && (
        <PerspectiveModal
          open={perspectiveState.open}
          onClose={() => setPerspectiveState((prev) => ({ ...prev, open: false }))}
          projectId={projectId}
          chapterRef={perspectiveState.chapterRef}
          chapterSummary={perspectiveState.chapterSummary}
          existingGuidance={
            outline.chaptersMap.get(perspectiveState.chapterRef)?.outline?.perspective_guidance
          }
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
    </div>
  );
}
