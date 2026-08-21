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

  // gap2：高级设定视图是否有未保存修改（AdvancedSettingsView 经 onDirtyChange 上提）。
  // useRef 而非 state：go() 是 useCallback，读写 ref 无需引入依赖、不触发重渲。
  const settingsDirtyRef = useRef(false);
  const handleSettingsDirty = useCallback((v: boolean) => {
    settingsDirtyRef.current = v;
  }, []);

  const go = useCallback(
    (next: "workbench" | "advanced-settings" | "archives", payload?: Record<string, any>) => {
      // gap2：离开设定视图时若有未保存修改，先确认，避免输入被静默丢弃。
      if (view === "advanced-settings" && next !== "advanced-settings" && settingsDirtyRef.current) {
        const ok = window.confirm("当前设定有未保存的修改，离开将丢失这些修改。确定继续吗？");
        if (!ok) return;
      }
      // 进入设定视图前复位残留脏标记（防上次未保存的旧标记污染本次导航）。
      // 仅真正进入时复位：重复点击已激活的「编辑设定」不卸载/不重挂载，
      // 若无条件复位会清掉 go() 读到的脏标记，导致离开守卫漏拦截。
      if (next === "advanced-settings" && view !== "advanced-settings") settingsDirtyRef.current = false;
      setView(next, payload);
    },
    [view, setView],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 3 label 导航已并入 NovelBar 顶栏（012） */}
      <NovelBar view={view} onNavigate={go} onDelete={() => setShowDelete(true)} />

      {/* PRO 阶段催促子树：免费态整棵不渲染、零 phase-status 请求（N14 / 4.1-8） */}
      <ProContainer>
        <ProPhaseSurface
          projectId={project?.id ?? ""}
          source={project?.source}
          onGoSettings={() => go("advanced-settings")}
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
            onSettingConfirmed={() => phaseRefetchRef.current()}
            onDirtyChange={handleSettingsDirty}
          />
        </div>
      )}
      {view === "archives" && (
        <div className="flex-1 min-h-0">
          <ArchivePage
            projectId={project?.id ?? ""}
            volumes={wb.volumes}
            onRefresh={wb.refresh}
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
// ProPhaseSurface — PRO 阶段催促子树（OnboardingCard；GateBanner 已移除 013）
//   位于 ProContainer 内部：免费态不挂载 → useNovelState 零请求
//   3 label 导航已上移至 ProContainer 外（011），此处不再渲染 TABS
// ---------------------------------------------------------------------------

function ProPhaseSurface({
  projectId,
  source,
  onGoSettings,
  registerRefetch,
}: {
  projectId: string;
  source: string | undefined;
  onGoSettings: () => void;
  registerRefetch: (fn: () => void) => void;
}) {
  const { phaseStatus, refetch } = useNovelState(projectId || undefined);

  useEffect(() => {
    registerRefetch(refetch);
    return () => registerRefetch(() => {});
  }, [refetch, registerRefetch]);

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
  onSettingConfirmed,
  onDirtyChange,
}: {
  projectId: string;
  initialPanel?: string;
  onSettingConfirmed: () => void;
  /** gap2：脏状态上提到 NovelWorkspace（useRef），供 go() 离开拦截 */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [panel, setPanel] = useState<string>(initialPanel ?? "world");
  // P2-1：当前面板是否有未保存修改（由活动表单经 onDirtyChange 上报）
  const [dirty, setDirty] = useState(false);

  // gap2：同时维护面板切换守卫的本地 dirty 与离开守卫的 ref
  const handleDirtyChange = useCallback(
    (v: boolean) => {
      setDirty(v);
      onDirtyChange?.(v);
    },
    [onDirtyChange],
  );
  const { settingsStatus, confirmSetting } = useOnboarding(projectId, []);

  // 初始面板来自导航 payload；已挂载时响应 payload 变化（013：synopsis 跳转已随 GateBanner 移除）
  useEffect(() => {
    if (initialPanel) setPanel(initialPanel);
  }, [initialPanel]);

  // P2-1：切换面板前若有未保存修改，先确认，避免静默丢输入
  const handleSelect = useCallback(
    (key: string) => {
      if (key === panel) return;
      if (dirty) {
        const ok = window.confirm("当前设定面板有未保存的修改，切换面板将丢失这些修改。确定继续吗？");
        if (!ok) return;
      }
      handleDirtyChange(false);
      setPanel(key);
    },
    [panel, dirty, handleDirtyChange],
  );

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
    <div className="flex h-full overflow-hidden">
      {/* 设定头部行已删（012）：返回靠顶栏「编辑正文」label */}
      <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
        <StructureTree
          nodes={nodes}
          selectedId={panel}
          onSelect={(node) => {
            const d = node.data as Record<string, any> | undefined;
            if (d?.key) handleSelect(d.key as string);
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
          onDirtyChange={handleDirtyChange}
        />
      </main>
    </div>
  );
}
