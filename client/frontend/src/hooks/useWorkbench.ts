import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useProject } from "@/hooks/useProject";
import type { TreeNode } from "@/components/novel/StructureTree";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkspaceView =
  | "workbench"
  | "advanced-settings"
  | "advanced-outline"
  | "archives";

export interface WorkbenchChapter {
  chapter: number;
  title: string;
  word_count: number;
  status: string;
  /** 缺省时降级：word_count>0 或本地已载入 prose */
  has_prose?: boolean;
  archived?: boolean;
}

export interface WorkbenchVolume {
  /** vol-1 */
  name: string;
  title?: string;
  chapters: WorkbenchChapter[];
}

export interface WorkbenchNode {
  type: "volume" | "chapter";
  volume: string;
  chapter?: number;
  ref?: string;
}

export interface UseWorkbenchReturn {
  project: Record<string, any> | null;
  volumes: WorkbenchVolume[];
  selectedId: string | null;
  selectedRef: string | null;
  view: WorkspaceView;
  setView: (view: WorkspaceView, payload?: Record<string, any>) => void;
  viewPayload: Record<string, any> | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectNode: (node: TreeNode) => void;
  createVolume: () => Promise<void>;
  createChapter: () => Promise<void>;
  renameNode: (nodeId: string, newTitle: string) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  refresh: () => Promise<void>;
  focusNode: (ref: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRef(ref: string): { vol: number; ch: number } | null {
  const m = ref.match(/^vol-(\d+)-ch-(\d+)$/);
  if (!m) return null;
  return { vol: parseInt(m[1], 10), ch: parseInt(m[2], 10) };
}

/** 数字 → 中文数字（1 → 一，12 → 十二，21 → 二十一，102 → 一百零二）。 */
const CN_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
function cnNum(n: number): string {
  if (n <= 0 || !Number.isInteger(n)) return String(n);
  if (n < 10) return CN_DIGITS[n];
  if (n < 20) return `十${n % 10 ? CN_DIGITS[n % 10] : ""}`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ""}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return `${CN_DIGITS[hundreds]}百${rest ? cnNum(rest) : ""}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkbench(): UseWorkbenchReturn {
  const { project } = useProject();
  const projectId = project?.id ?? "";

  const [volumes, setVolumes] = useState<WorkbenchVolume[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [view, setViewState] = useState<WorkspaceView>("workbench");
  const [viewPayload, setViewPayload] = useState<Record<string, any> | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const selectedRefRef = useRef<string | null>(null);
  selectedRefRef.current = selectedRef;

  // -----------------------------------------------------------------------
  // Load volumes（DB 全量树：GET /volumes 一次返回卷+章元数据，change 006）
  // -----------------------------------------------------------------------

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const vols: Array<{
        ref: string;
        title?: string;
        chapters?: Array<{
          chapter: number;
          title: string;
          word_count: number;
          status: string;
          has_prose?: boolean;
          archived?: boolean;
        }>;
      }> = await api.get(`/novels/${projectId}/volumes`);
      setVolumes(
        vols.map((v) => ({
          name: v.ref,
          title: v.title,
          chapters: (v.chapters || []).map((c) => {
            const hasProse = c.has_prose ?? c.word_count > 0;
            return {
              chapter: c.chapter,
              title: c.title,
              word_count: c.word_count || 0,
              status: c.status || "outline",
              has_prose: hasProse,
              archived: c.archived ?? c.status === "archived",
            };
          }),
        })),
      );
    } catch {
      // volumes might not be available yet
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 归档后树 📦 即时同步（useChapterData 归档成功 dispatch "chapter:archived"）
  useEffect(() => {
    const onArchived = () => void refresh();
    window.addEventListener("chapter:archived", onArchived);
    return () => window.removeEventListener("chapter:archived", onArchived);
  }, [refresh]);

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  const onSelectNode = useCallback((node: TreeNode) => {
    const data = node.data as WorkbenchNode | undefined;
    if (!data) return;
    if (data.type === "volume") {
      setSelectedId(data.volume);
      setSelectedRef(null);
      setViewState("workbench");
    } else if (data.type === "chapter") {
      const ref = data.ref ?? node.id;
      setSelectedId(ref);
      setSelectedRef(ref);
      setViewState("workbench");
    }
  }, []);

  const focusNode = useCallback((ref: string) => {
    const parsed = parseRef(ref);
    if (!parsed) return;
    const volName = `vol-${parsed.vol}`;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(volName);
      return next;
    });
    setSelectedId(ref);
    setSelectedRef(ref);
    setViewState("workbench");
    setViewPayload(null);
  }, []);

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setView = useCallback(
    (next: WorkspaceView, payload?: Record<string, any>) => {
      setViewState(next);
      setViewPayload(payload ?? null);
      // 切到 workbench 时若无选中，保留现状；focusNode 由调用方显式触发
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Create volume
  // -----------------------------------------------------------------------

  const createVolume = useCallback(async () => {
    if (!projectId) return;
    const volNum = volumes.length + 1;
    try {
      const result = await api.post(`/novels/${projectId}/volumes`, {
        title: `第${cnNum(volNum)}卷`,
      });
      await refresh();
      const name = result.ref || `vol-${volNum}`;
      setSelectedId(name);
      setSelectedRef(null);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(name);
        return next;
      });
      return;
    } catch {
      // 创建失败
    }
  }, [projectId, volumes.length, refresh]);

  // -----------------------------------------------------------------------
  // Create chapter（无卷先建卷；新章即达编辑器 N1）
  // -----------------------------------------------------------------------

  const createChapter = useCallback(async () => {
    if (!projectId) return;
    try {
      // 优先在选中卷下建章（N1）；无选中卷则第一个卷；无卷先建卷
      const selVolName = volumes.find((v) => v.name === selectedId) ? selectedId : null;
      let targetVol = volumes.find((v) => v.name === selVolName) || volumes[0];
      if (!targetVol) {
        const volResult = await api.post(`/novels/${projectId}/volumes`, {
          title: `第${cnNum(1)}卷`,
        });
        await refresh();
        targetVol = {
          name: volResult.ref || "vol-1",
          chapters: [],
        };
      }

      const volRef = targetVol.name || "vol-1";
      const nextCh = targetVol.chapters.length + 1;

      const result = await api.post(
        `/novels/${projectId}/volumes/${volRef}/chapters`,
        { title: `第${cnNum(nextCh)}章` },
      );
      await refresh();
      const ref = (result.chapter_ref as string) || `${volRef}-ch-${nextCh}`;
      focusNode(ref);
    } catch {
      // 创建失败
    }
  }, [projectId, volumes, refresh, focusNode]);

  // -----------------------------------------------------------------------
  // Rename node
  // -----------------------------------------------------------------------

  const renameNode = useCallback(
    async (nodeId: string, newTitle: string) => {
      if (!projectId) return;
      const parsed = parseRef(nodeId);
      try {
        if (parsed) {
          const data = await api.get(`/novels/${projectId}/chapters/${nodeId}`);
          await api.put(`/novels/${projectId}/chapters/${nodeId}`, {
            ...data,
            title: newTitle,
          });
        } else {
          const volData = await api.get(
            `/novels/${projectId}/volumes/${nodeId}`,
          );
          await api.put(`/novels/${projectId}/volumes/${nodeId}`, {
            ...volData,
            title: newTitle,
          });
        }
        await refresh();
      } catch {
        // 重命名失败
      }
    },
    [projectId, refresh],
  );

  // -----------------------------------------------------------------------
  // Delete node
  // -----------------------------------------------------------------------

  const deleteNode = useCallback(
    async (nodeId: string) => {
      if (!projectId) return;
      const parsed = parseRef(nodeId);
      try {
        if (parsed) {
          await api.delete(`/novels/${projectId}/chapters/${nodeId}`);
          if (selectedRefRef.current === nodeId) {
            setSelectedId(null);
            setSelectedRef(null);
          }
        } else {
          await api.delete(`/novels/${projectId}/volumes/${nodeId}`);
          if (selectedRefRef.current?.startsWith(nodeId)) {
            setSelectedId(null);
            setSelectedRef(null);
          }
        }
        await refresh();
      } catch {
        // 删除失败
      }
    },
    [projectId, refresh],
  );

  return {
    project,
    volumes,
    selectedId,
    selectedRef,
    view,
    setView,
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
  };
}

export default useWorkbench;
