import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import ProContainer from "@/components/novel/ProContainer";
import StructureTree from "@/components/novel/StructureTree";
import SettingsFormField from "@/components/novel/SettingsFormField";
import ArchivePage from "@/components/novel/ArchivePage";
import OnboardingCard from "@/components/novel/OnboardingCard";
import VolumePage from "@/components/novel/volume/VolumePage";
import OutlineTree from "@/components/novel/workbench/OutlineTree";
import ChapterWorkspace from "@/components/novel/workbench/ChapterWorkspace";
import Rail, { type RailChapterData } from "@/components/novel/workbench/Rail";
import {
  INITIAL_PROSE_AI_STATE,
  type ProseAIState,
  type ProseHandle,
} from "@/components/novel/workbench/ProsePane";
import { useWorkbench } from "@/hooks/useWorkbench";
import { useOutline } from "@/hooks/useOutline";
import { useProject } from "@/hooks/useProject";
import { useNovelState } from "@/hooks/useNovelState";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useTier } from "@/hooks/useTier";
import type { TreeNode } from "@/components/novel/StructureTree";
import { toast } from "@/lib/toast";
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
// NovelWorkspace — book.html 复刻（PR 3：壳 + 大纲树 + 章对象工作台）
//   novelbar（书名双击改名 / 类型胶囊 / 免费提示或 PRO 徽 / 升级）
//   modnav（设定 N/7 · 写作 N/N 章纲 · 预览，默认写作视图）
//   写作 = three-col（树 / 中栏 / 右栏）常驻挂载（.view.on 切换保正文脏状态）
//   设定 / 预览 = 旧视图过渡（轻重皮，PR 4 按设计稿重绘）
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

export default function NovelWorkspace() {
  const { id } = useParams<{ id: string }>();
  const wb = useWorkbench();
  const {
    view,
    setView,
    project,
    volumes,
    selectedId,
    selectedRef,
    viewPayload,
    focusNode,
    refresh,
    deleteNode,
  } = wb;
  const { updateProject } = useProject();
  const { isPro } = useTier();
  const projectId = project?.id ?? "";

  const outline = useOutline(projectId);
  const { settingsDone } = useOnboarding(projectId, []);

  // ── 视图映射：modnav 三态 ↔ 内部视图名（默认 workbench = 写作） ──────
  const go = useCallback(
    (
      next: "workbench" | "advanced-settings" | "archives",
      payload?: Record<string, any>,
    ) => {
      if (
        view === "advanced-settings" &&
        next !== "advanced-settings" &&
        settingsDirtyRef.current
      ) {
        const ok = window.confirm(
          "当前设定有未保存的修改，离开将丢失这些修改。确定继续吗？",
        );
        if (!ok) return;
      }
      if (next === "advanced-settings" && view !== "advanced-settings")
        settingsDirtyRef.current = false;
      setView(next, payload);
    },
    [view, setView],
  );
  const settingsDirtyRef = useRef(false);
  const handleSettingsDirty = useCallback((v: boolean) => {
    settingsDirtyRef.current = v;
  }, []);

  // 设定确认后刷新 PRO phase-status（ProPhaseSurface 常驻于 ProContainer）
  const phaseRefetchRef = useRef<() => void>(() => {});
  const registerPhaseRefetch = useCallback((fn: () => void) => {
    phaseRefetchRef.current = fn;
  }, []);

  // archives「编辑」→ 回工作台并聚焦该章
  useEffect(() => {
    if (viewPayload?.focusRef) focusNode(viewPayload.focusRef);
  }, [viewPayload, focusNode]);

  // ── 卷编辑态脏守卫（VolumePage 上抛 ref；切节点/跳章前拦截） ─────────
  const volumeDirtyRef = useRef(false);
  const guardedLeave = useCallback(() => {
    if (!volumeDirtyRef.current) return true;
    if (!window.confirm("卷信息有未保存的修改，确定离开吗？")) return false;
    volumeDirtyRef.current = false;
    return true;
  }, []);
  const handleVolumeDirty = useCallback((dirty: boolean) => {
    volumeDirtyRef.current = dirty;
  }, []);
  const handleChapterJump = useCallback(
    (ref: string) => {
      if (!guardedLeave()) return;
      focusNode(ref);
    },
    [focusNode, guardedLeave],
  );

  // ── 选中节点解析：章 → 章对象工作台；卷 → 卷工作台（PR 4 换卷纲面板） ─
  const chapterRef =
    selectedRef && /^vol-\d+-ch-\d+$/.test(selectedRef) ? selectedRef : null;
  const volumeSelId =
    !chapterRef && selectedId && /^vol-\d+$/.test(selectedId) ? selectedId : null;

  // ── novelbar：书名双击改名（#164 口径：名称即标题且必填） ─────────────
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const commitRename = useCallback(async () => {
    const next = (nameDraft ?? "").trim();
    setNameDraft(null);
    if (!project?.id || !next || next === project.name) return;
    try {
      const updated = await api.renameNovel(project.id, next);
      updateProject({ name: updated.name });
    } catch {
      toast.error("重命名失败，请重试");
    }
  }, [nameDraft, project, updateProject]);
  const genreLabel = (project?.type || project?.genre || "") as string;

  // ── AI ref 链：正文编辑器实例 + 状态（右栏 AI 工具与中栏共用） ─────────
  const proseRef = useRef<ProseHandle | null>(null);
  const [aiState, setAIState] = useState<ProseAIState>(INITIAL_PROSE_AI_STATE);

  // ── 右栏本章进度数据（ChapterWorkspace 实时上抛；含 target 编辑器） ────
  const [railData, setRailData] = useState<RailChapterData | null>(null);
  const bookWords = useMemo(
    () =>
      volumes.reduce(
        (sum, v) =>
          sum + v.chapters.reduce((s, c) => s + (c.word_count ?? 0), 0),
        0,
      ),
    [volumes],
  );

  const sideText =
    view === "advanced-settings"
      ? "设定 · 若干项，确认即作为 AI 上下文（可选）"
      : view === "archives"
        ? "预览 · 只读正文，通读全篇"
        : "写作 · 卷有卷纲；点章即可配章纲、提示词并写正文";

  const onUpgrade = useCallback(() => {
    // 过渡：PR 5 落升级 PRO 弹窗
    toast.info("PRO 升级入口即将开放");
  }, []);

  // ArchivePage 挂载即调 onRefresh 且以它为 effect 依赖——内联箭头每次渲染都是
  // 新引用，会与 refresh→setVolumes→重渲染结成死循环（预览态每 ~9ms 打一次
  // GET /volumes）。必须 memo 住引用，只在 refresh 本身变化时才换新。
  const handleArchivesRefresh = useCallback(() => void refresh(), [refresh]);

  return (
    <div className="wb">
      {/* 小说栏：书名（双击改名）· 类型 · 免费提示 / PRO 徽 · 升级 */}
      <div className="novelbar">
        {nameDraft === null ? (
          <span
            className="novel-title serif"
            title="双击重命名"
            onDoubleClick={() => setNameDraft(project?.name ?? "")}
          >
            {project?.name ?? "…"}
          </span>
        ) : (
          <input
            className="input"
            style={{ width: 200, fontWeight: 600 }}
            value={nameDraft}
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename();
              else if (e.key === "Escape") setNameDraft(null);
            }}
            onBlur={() => void commitRename()}
          />
        )}
        {genreLabel && <span className="genre-tag">{genreLabel}</span>}
        {!isPro ? (
          <span className="free-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            免费模式 · 写作功能完整，升级解锁 AI
          </span>
        ) : (
          <span className="pill-pro">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 6.2L21 9l-5 4.4 1.6 6.6L12 16.6 6.4 20 8 13.4 3 9l6.6-.8z" />
            </svg>
            PRO
          </span>
        )}
        <span className="spacer" />
        {!isPro && (
          <button className="btn btn-secondary btn-sm" onClick={onUpgrade}>
            升级 PRO
          </button>
        )}
      </div>

      {/* PRO 阶段催促子树：免费态整棵不渲染、零 phase-status 请求 */}
      <ProContainer>
        <ProPhaseSurface
          projectId={projectId}
          source={project?.source}
          onGoSettings={() => go("advanced-settings")}
          registerRefetch={registerPhaseRefetch}
        />
      </ProContainer>

      {/* 书内模块导航：设定 / 写作 / 预览（默认写作） */}
      <nav className="modnav">
        <button
          className={`mtab${view === "advanced-settings" ? " on" : ""}`}
          onClick={() => go("advanced-settings")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          设定 <span className="cnt">{settingsDone}/7</span>
        </button>
        <button
          className={`mtab${view === "workbench" ? " on" : ""}`}
          onClick={() => go("workbench")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          写作{" "}
          <span className="cnt">
            {outline.confirmedCount}/{outline.totalChapters} 章纲
          </span>
        </button>
        <button
          className={`mtab${view === "archives" ? " on" : ""}`}
          onClick={() => go("archives")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          预览
        </button>
        <span className="spacer" />
        <span className="side">{sideText}</span>
      </nav>

      {/* 写作：three-col 常驻挂载（.view.on 切换，正文脏状态/流式现场不丢） */}
      <div className={`view three-col${view === "workbench" ? " on" : ""}`}>
        <aside className="col-tree">
          <OutlineTree
            wb={wb}
            outline={outline}
            projectId={projectId}
            guardedLeave={guardedLeave}
          />
        </aside>

        <main className="col-middle">
          {chapterRef ? (
            <ChapterWorkspace
              projectId={projectId}
              chapterRef={chapterRef}
              outline={outline}
              wb={wb}
              isPro={isPro}
              proseRef={proseRef}
              aiState={aiState}
              onAIStateChange={setAIState}
              bookWords={bookWords}
              onRailData={setRailData}
            />
          ) : volumeSelId ? (
            <VolumePage
              projectId={projectId}
              volumeRef={volumeSelId}
              volumes={volumes}
              onChapterSelect={handleChapterJump}
              onVolumeMutated={() => void refresh()}
              onDeleteVolume={() => deleteNode(volumeSelId)}
              onDirtyChange={handleVolumeDirty}
            />
          ) : (
            <div className="col-panel">
              <div className="panel">
                <div className="panel-head">
                  <h2>开始创作</h2>
                </div>
                <p className="desc">
                  在左侧树头点「＋」添加第一卷，再为每卷添加章节，点章即可配章纲并写正文。
                </p>
              </div>
            </div>
          )}
        </main>

        <aside className="col-ai">
          <Rail
            mode={chapterRef ? "chapter" : "volume"}
            isPro={isPro}
            onUpgrade={onUpgrade}
            proseRef={proseRef}
            aiState={aiState}
            data={chapterRef ? (railData ?? undefined) : undefined}
          />
        </aside>
      </div>

      {/* 设定 / 预览：过渡期轻重皮（自有布局，PR 4 按设计稿重绘） */}
      {view === "advanced-settings" && (
        <div className="flex-1 min-h-0">
          <AdvancedSettingsView
            projectId={projectId}
            initialPanel={wb.viewPayload?.panel as string | undefined}
            onSettingConfirmed={() => phaseRefetchRef.current()}
            onDirtyChange={handleSettingsDirty}
          />
        </div>
      )}
      {view === "archives" && (
        <div className="flex-1 min-h-0">
          <ArchivePage
            projectId={projectId}
            volumes={volumes}
            onRefresh={handleArchivesRefresh}
            onBack={() => go("workbench")}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProPhaseSurface — PRO 阶段催促子树（免费态不挂载 → useNovelState 零请求）
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
// AdvancedSettingsView — 设定面板（过渡轻重皮：设定树 + SettingsFormField）
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
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [panel, setPanel] = useState<string>(initialPanel ?? "world");
  const [dirty, setDirty] = useState(false);

  const handleDirtyChange = useCallback(
    (v: boolean) => {
      setDirty(v);
      onDirtyChange?.(v);
    },
    [onDirtyChange],
  );
  const { settingsStatus, confirmSetting } = useOnboarding(projectId, []);

  useEffect(() => {
    if (initialPanel) setPanel(initialPanel);
  }, [initialPanel]);

  const handleSelect = useCallback(
    (key: string) => {
      if (key === panel) return;
      if (dirty) {
        const ok = window.confirm(
          "当前设定面板有未保存的修改，切换面板将丢失这些修改。确定继续吗？",
        );
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
