import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 保存四态：自动保存中 / 已保存 / 未保存 / 失败（含重试） */
export type SaveState = "autosaving" | "saved" | "unsaved" | "failed";

export interface ChapterPayload {
  volume: number;
  chapter: number;
  title: string;
  status: string;
  outline?: {
    summary?: string;
    [key: string]: any;
  };
  prose?: string;
  [key: string]: any;
}

export interface UseChapterDataReturn {
  chapter: ChapterPayload | null;
  prose: string;
  status: string;
  setProse: (v: string) => void;
  setStatus: (v: string) => void;
  isDirty: boolean;
  saveState: SaveState;
  wordCount: number;
  targetWords: number;
  setTargetWords: (n: number) => void;
  save: () => void;
  retry: () => void;
  archive: (options?: { aiSummary?: boolean }) => Promise<void>;
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
  setError: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 去空白中文字符数（与后端 /tree 同口径 B5）。 */
export function countChars(text: string): number {
  if (!text) return 0;
  return text.replace(/\s/g, "").length;
}

/** targetWords 持久化 key（localStorage）。 */
function targetKey(projectId: string, ref: string): string {
  return `target-words-${projectId}-${ref}`;
}

const DEFAULT_TARGET = 2000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChapterData(
  projectId: string,
  ref: string,
): UseChapterDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapter, setChapter] = useState<ChapterPayload | null>(null);

  const [prose, setProse] = useState("");
  const [status, setStatus] = useState("outline");

  // 初始快照 → isDirty 两源比较（章纲归 useOutline 单一属主，011 后续）
  const [initial, setInitial] = useState({ prose: "", status: "outline" });
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const [targetWords, setTargetWordsState] = useState<number>(() => {
    const raw = localStorage.getItem(targetKey(projectId, ref));
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TARGET;
  });

  const isDirty =
    prose !== initial.prose ||
    status !== initial.status;

  const wordCount = useMemo(() => countChars(prose), [prose]);

  // Refs to avoid stale closures in timers / flush callbacks
  const stateRef = useRef({ prose, status, chapter });
  stateRef.current = { prose, status, chapter };
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  const savingRef = useRef(false);

  // -----------------------------------------------------------------------
  // Load chapter
  // -----------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: ChapterPayload = await api.get(
        `/novels/${projectId}/chapters/${ref}`,
      );
      setChapter(data);
      const p = data.prose || "";
      const st = data.status || "outline";
      setProse(p);
      setStatus(st);
      setInitial({ prose: p, status: st });
      setSaveState("saved");
    } catch (e: any) {
      setError(e.message || "加载章节失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, ref]);

  useEffect(() => {
    void load();
  }, [load]);

  // -----------------------------------------------------------------------
  // Core save
  // -----------------------------------------------------------------------

  const doSave = useCallback(async (): Promise<void> => {
    if (savingRef.current) return;
    const { prose: p, status: st, chapter: ch } = stateRef.current;
    if (!ch) return;
    savingRef.current = true;
    setSaveState("autosaving");
    try {
      // 优先 PUT .../prose（后端 #12）；未就位降级 PUT /chapters/{ref} 全量（outline 原样保留，属主 useOutline）
      try {
        await api.put(`/novels/${projectId}/chapters/${ref}/prose`, { prose: p });
      } catch {
        const updated: ChapterPayload = {
          ...ch,
          prose: p,
          status: st,
        };
        await api.put(`/novels/${projectId}/chapters/${ref}`, updated);
        setChapter(updated);
      }
      initialRef.current = { prose: p, status: st };
      setInitial({ prose: p, status: st });
      setSaveState("saved");
    } catch (e: any) {
      setSaveState("failed");
      setError(e.message || "保存失败");
    } finally {
      savingRef.current = false;
    }
  }, [projectId, ref]);

  // saveFnRef 供防抖 timer 与卸载 flush 调用
  const saveFnRef = useRef<() => Promise<void>>(doSave);
  saveFnRef.current = doSave;

  // -----------------------------------------------------------------------
  // 内容变脏 → 未保存态（防抖窗内显示「未保存」；autosaving/saved 时不覆盖）
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (isDirty && saveState === "saved") {
      setSaveState("unsaved");
    }
  }, [isDirty, saveState]);

  // -----------------------------------------------------------------------
  // Auto-save: debounce 1500ms（N8）
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      void saveFnRef.current();
    }, 1500);
    return () => clearTimeout(timer);
  }, [prose, status, isDirty]);

  // -----------------------------------------------------------------------
  // Flush on unmount / chapter switch（防丢窗口）
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (dirtyRef.current && !savingRef.current) {
        void saveFnRef.current();
      }
    };
  }, [ref]);

  // -----------------------------------------------------------------------
  // Save / retry
  // -----------------------------------------------------------------------

  const save = useCallback(() => {
    void saveFnRef.current();
  }, []);

  const retry = useCallback(() => {
    void saveFnRef.current();
  }, []);

  // -----------------------------------------------------------------------
  // Target words（localStorage 持久化）
  // -----------------------------------------------------------------------

  const setTargetWords = useCallback(
    (n: number) => {
      const safe = Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_TARGET;
      setTargetWordsState(safe);
      localStorage.setItem(targetKey(projectId, ref), String(safe));
    },
    [projectId, ref],
  );

  // -----------------------------------------------------------------------
  // Archive
  // -----------------------------------------------------------------------

  const archive = useCallback(async (options?: { aiSummary?: boolean }) => {
    const { prose: p } = stateRef.current;
    if (!p.trim()) return;
    setError(null);
    try {
      await api.post(`/novels/${projectId}/chapters/${ref}/archive`, {
        full_text: p,
        // ai_summary=false：设置里关掉归档 AI 摘要（后端降级为正文摘要）
        ai_summary: options?.aiSummary ?? true,
      });
      setStatus("archived");
      setInitial({ prose: p, status: "archived" });
      setSaveState("saved");
      // 通知工作台树刷新 → 卷章列表 status 已置 archived → 📦 即时同步
      window.dispatchEvent(
        new CustomEvent("chapter:archived", { detail: { projectId, ref } }),
      );
    } catch (e: any) {
      setError(e.message || "归档失败");
      setSaveState("failed");
    }
  }, [projectId, ref]);

  return {
    chapter,
    prose,
    status,
    setProse,
    setStatus,
    isDirty,
    saveState,
    wordCount,
    targetWords,
    setTargetWords,
    save,
    retry,
    archive,
    reload: load,
    loading,
    error,
    setError,
  };
}

export default useChapterData;
