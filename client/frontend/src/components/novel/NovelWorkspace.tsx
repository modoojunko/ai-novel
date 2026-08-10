import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import NovelBar from "@/components/novel/NovelBar";
import Workbench from "@/components/novel/Workbench";
import ProContainer from "@/components/novel/ProContainer";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import StructureTree from "@/components/novel/StructureTree";
import SettingsFormField from "@/components/novel/SettingsFormField";
import ArchivePage from "@/components/novel/ArchivePage";
import TabProgressButton from "@/components/novel/TabProgressButton";
import GateBanner from "@/components/novel/GateBanner";
import OnboardingCard from "@/components/novel/OnboardingCard";
import { useWorkbench } from "@/hooks/useWorkbench";
import { useNovelState } from "@/hooks/useNovelState";
import { useOnboarding } from "@/hooks/useOnboarding";
import type { TreeNode } from "@/components/novel/StructureTree";
import {
  Globe,
  Feather,
  Shield,
  Anchor,
  Users,
  Brain,
  BookOpen,
  ArrowLeft,
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
// NovelWorkspace — 三态视图机（C5/P0-5；011 收敛：删除 advanced-outline）
//   workbench 常驻挂载（hidden 切换保 prose 脏状态/光标）
//   advanced-settings / archives 懒挂载、离开卸载
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
    (next: "workbench" | "advanced-settings" | "archives", payload?: Record<string, any>) => {
      setView(next, payload);
    },
    [setView],
  );

  return (
    <div className="flex flex-col h-full">
      <NovelBar onDelete={() => setShowDelete(true)} />

      {/* 3 label 导航（011）：编辑设定 / 编辑正文 / 预览小说，两态共用纯导航无徽标 */}
      <div className="flex items-center gap-1 px-4 py-1 border-b border-base-300 bg-base-200/30 shrink-0">
        <TabProgressButton
          label="编辑设定"
          active={view === "advanced-settings"}
          onClick={() => go("advanced-settings")}
        />
        <TabProgressButton
          label="编辑正文"
          active={view === "workbench"}
          onClick={() => go("workbench")}
        />
        <TabProgressButton
          label="预览小说"
          active={view === "archives"}
          onClick={() => go("archives")}
        />
      </div>

      {/* PRO 阶段催促子树：免费态整棵不渲染、零 phase-status 请求（N14 / 4.1-8） */}
      <ProContainer>
        <ProPhaseSurface
          projectId={project?.id ?? ""}
          source={project?.source}
          onGoSettings={() => go("advanced-settings")}
          onGoAdvanced={(key) => go("advanced-settings", { panel: key })}
          registerRefetch={registerPhaseRefetch}
        />
      </ProContainer>

      {/* Workbench 常驻挂载：hidden 切换（保 1.5s 防抖窗内的 prose 脏状态与光标） */}
      <div className="flex-1 min-h-0" hidden={view !== "workbench"}>
        <Workbench wb={wb} />
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
// ProPhaseSurface — PRO 阶段催促子树（GateBanner + OnboardingCard）
//   位于 ProContainer 内部：免费态不挂载 → useNovelState 零请求
//   3 label 导航已上移至 ProContainer 外（011），此处不再渲染 TABS
// ---------------------------------------------------------------------------

function ProPhaseSurface({
  projectId,
  source,
  onGoSettings,
  onGoAdvanced,
  registerRefetch,
}: {
  projectId: string;
  source: string | undefined;
  onGoSettings: () => void;
  onGoAdvanced: (key: string) => void;
  registerRefetch: (fn: () => void) => void;
}) {
  const { phaseStatus, warnings, refetch } = useNovelState(projectId || undefined);

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
