import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { TreeNode } from "@/components/novel/StructureTree";
import StructureTree from "@/components/novel/StructureTree";
import ThemeToggle from "@/components/novel/ThemeToggle";
import EmptyState from "@/components/novel/EmptyState";
import VolumeEditor from "@/components/novel/VolumeEditor";
import ChapterEditor from "@/components/novel/ChapterEditor";
import VersionHistory from "@/components/novel/VersionHistory";
import SettingsFormField from "@/components/novel/SettingsFormField";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "settings" | "writing";

type ViewState =
  | { tab: "settings"; panel: string }
  | { tab: "writing"; panel: "empty" }
  | { tab: "writing"; panel: "volume"; volumeId: string }
  | { tab: "writing"; panel: "chapter"; chapterRef: string }
  | { tab: "writing"; panel: "versions"; chapterRef: string };

// ---------------------------------------------------------------------------
// Tab labels
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: "settings", label: "设定" },
  { id: "writing", label: "正文" },
];

const SETTINGS_TREE_ITEMS: { id: string; icon: string; label: string }[] = [
  { id: "world", icon: "🌍", label: "世界设定" },
  { id: "style", icon: "✍️", label: "写作风格" },
  { id: "anti-ai", icon: "🛡️", label: "反AI规则" },
  { id: "hooks", icon: "⚓", label: "伏笔面板" },
  { id: "characters", icon: "👥", label: "角色管理" },
];

// ---------------------------------------------------------------------------
// NovelPage component
// ---------------------------------------------------------------------------

export default function NovelPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [volumes, setVolumes] = useState<any[]>([]);
  const [tab, setTab] = useState<TabId>("writing");
  const [viewState, setViewState] = useState<ViewState>({
    tab: "writing",
    panel: "empty",
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // -----------------------------------------------------------------------
  // Fetch project by slug
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api
      .get(`/projects/by-slug/${slug}`)
      .then((p: any) => {
        setProject(p);
      })
      .catch(() => {
        setProject(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

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

  // -----------------------------------------------------------------------
  // Derive writing tree nodes from volumes
  // -----------------------------------------------------------------------

  const writingTreeNodes: TreeNode[] = useMemo(() => {
    return volumes.map((v) => {
      const volNum = parseInt((v.name || "").replace("vol-", ""), 10) || 0;
      const chapterNodes: TreeNode[] = (v.chapters || []).map((ch: any) => {
        const ref = `vol-${ch.volume}-ch-${ch.chapter}`;
        const isDone =
          ch.status === "confirmed" || ch.status === "archived";
        return {
          id: ref,
          icon: "📄",
          label: ch.title || `ch-${ch.chapter}`,
          badge: isDone ? "done" : undefined,
          badgeColor: isDone ? "var(--su)" : undefined,
          data: { type: "chapter", ref, volume: ch.volume, chapter: ch.chapter },
          actions: [
            {
              icon: "📋",
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
        icon: "📚",
        label: `第${volNum}卷`,
        badge: `${chapterNodes.length}章`,
        children: chapterNodes,
        data: { type: "volume", name: v.name, volNum },
      };
    });
  }, [volumes]);

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

  const activeNodes = tab === "settings" ? settingsTreeNodes : writingTreeNodes;

  const selectedId =
    tab === "settings"
      ? viewState.tab === "settings"
        ? viewState.panel
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
    [tab]
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

  // -----------------------------------------------------------------------
  // Empty state callbacks (no-op until real API wiring)
  // -----------------------------------------------------------------------

  const handleCreateVolume = useCallback(() => {
    console.log("TODO: create volume");
  }, []);

  const handleCreateChapter = useCallback(() => {
    console.log("TODO: create chapter");
  }, []);

  const handleGoSettings = useCallback(() => {
    setTab("settings");
    setViewState({ tab: "settings", panel: "world" });
  }, []);

  const handleTabSwitch = useCallback((newTab: TabId) => {
    setTab(newTab);
    if (newTab === "settings") {
      setViewState({ tab: "settings", panel: "world" });
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
              />
            );
          case "chapter":
            return (
              <ChapterEditor
                projectId={project.id}
                chapterRef={viewState.chapterRef}
                onShowVersion={() =>
                  setViewState({
                    tab: "writing",
                    panel: "versions",
                    chapterRef: viewState.chapterRef,
                  })
                }
              />
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
              />
            );
        }
      default:
        return <EmptyState />;
    }
  }, [viewState]);

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="loading loading-spinner loading-md text-primary" />
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
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-200/50">
        {/* Project name */}
        <h1 className="text-lg font-bold font-serif text-base-content">
          {project.name}
        </h1>

        {/* Tabs: 设定 / 正文 */}
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
            </button>
          ))}
        </div>

        {/* Theme toggle placeholder */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* ── Dual panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left tree panel */}
        <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
          <StructureTree
            nodes={activeNodes}
            selectedId={selectedId}
            onSelect={handleSelect}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
        </aside>

        {/* Right content panel */}
        <main className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
