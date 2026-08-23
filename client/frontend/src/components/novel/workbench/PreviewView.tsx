// 预览视图（book.html #viewPreview 复刻，PR4）：
//   two-col = 左只读树（tree-head 卷/章计数 + 三态 dot + 已归档 tag + 卷折叠）
//   + 右只读排版（preview-head 章名 + .editor.fs-m.lh-comfy 只读段落）。
// 语义对齐设计稿：预览 = 全书只读通读（草稿与归档章皆可读）；旧「仅归档章
// 可读」归档阅读页退役（ADJUSTMENTS #12）。树选择为本地态、不回写写作视图
// 选中——写作视图常驻挂载，隐藏态切章有正文脏丢风险（ADJUSTMENTS #13）。
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Ico, P } from "@/components/icons";
import { nodeLabel } from "@/lib/nodeTitle";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";
import type { UseOutlineReturn } from "@/hooks/useOutline";

interface PreviewViewProps {
  projectId: string;
  /** 全量卷章结构（wb.volumes 常驻内存可能滞后 → 挂载时对齐一次） */
  volumes: WorkbenchVolume[];
  onRefresh: () => void;
  /** 章纲状态（三态 dot 与写作树同源） */
  outline: UseOutlineReturn;
  /** 初始定档章（写作视图当前选中章；缺省/失效回退首章） */
  initialRef?: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m] ?? m,
  );
}

/** prose（\n 分段）→ 段落 HTML（ProsePane 同口径，只读渲染用） */
function proseToHtml(prose: string): string {
  return prose
    .split("\n")
    .map((p) => `<p>${escapeHtml(p) || "<br>"}</p>`)
    .join("");
}

const mutedP = (text: string) =>
  `<p style="text-indent:0; color:var(--muted);">${text}</p>`;

function volNo(name: string): number {
  const m = name.match(/^vol-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export default function PreviewView({
  projectId,
  volumes,
  onRefresh,
  outline,
  initialRef,
}: PreviewViewProps) {
  const [selRef, setSelRef] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [prose, setProse] = useState("");
  const [loading, setLoading] = useState(false);

  // 挂载时对齐一次卷章结构（wb.volumes 仅靠事件增量刷新，可能滞后于本页外变更）
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const chTotal = volumes.reduce((a, v) => a + v.chapters.length, 0);

  /** 全部章 ref → { v, c }（全书顺序 = 卷升序 + 章升序） */
  const chapterIndex = useMemo(() => {
    const map = new Map<string, { v: WorkbenchVolume; c: WorkbenchVolume["chapters"][number] }>();
    for (const v of volumes)
      for (const c of v.chapters) map.set(`${v.name}-ch-${c.chapter}`, { v, c });
    return map;
  }, [volumes]);

  // 有效选中：本地选择失效（章已删）→ 回退初始章 → 回退首章
  const activeRef =
    selRef && chapterIndex.has(selRef)
      ? selRef
      : initialRef && chapterIndex.has(initialRef)
        ? initialRef
        : (chapterIndex.keys().next().value ?? null);
  const active = activeRef ? chapterIndex.get(activeRef) : undefined;

  useEffect(() => {
    if (!projectId || !activeRef) return;
    let cancelled = false;
    setLoading(true);
    api
      .get(`/novels/${projectId}/chapters/${activeRef}`)
      .then((d: { prose?: string }) => {
        if (!cancelled) setProse(d.prose ?? "");
      })
      .catch(() => {
        if (!cancelled) setProse("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, activeRef]);

  const toggleVolume = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const proseHtml = !active
    ? mutedP("还没有卷与章节。回到「写作」添加第一卷。")
    : loading
      ? ""
      : prose
        ? proseToHtml(prose)
        : mutedP("本章还没有正文，回到「写作」开始写。");

  return (
    <div className="view two-col on">
      <aside className="col-tree">
        <div className="tree-head">
          <span className="t">
            预览 · 卷 <b>{volumes.length}</b> · 章 <b>{chTotal}</b>
          </span>
        </div>
        <div className="tree">
          {volumes.map((v) => {
            const open = !collapsed.has(v.name);
            return (
              <div className="vol" key={v.name}>
                <div className="vol-head" onClick={() => toggleVolume(v.name)}>
                  <Ico d={P.chevronRight} className={"chev" + (open ? " open" : "")} />
                  <span className="vt">{nodeLabel("卷", volNo(v.name), v.title)}</span>
                </div>
                <div className="ch-list" style={{ display: open ? "" : "none" }}>
                  {v.chapters.map((c) => {
                    const ref = `${v.name}-ch-${c.chapter}`;
                    const st = outline.chapterStatuses.get(ref) ?? "unfilled";
                    return (
                      <div
                        key={ref}
                        className={"ch" + (ref === activeRef ? " sel" : "")}
                        onClick={() => setSelRef(ref)}
                      >
                        <span
                          className={
                            st === "confirmed"
                              ? "dot-ok"
                              : st === "in_progress"
                                ? "dot-warn"
                                : "dot-empty"
                          }
                        />
                        <span className="ct">{nodeLabel("章", c.chapter, c.title)}</span>
                        {c.archived && <span className="arch-tag">已归档</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {volumes.length === 0 && (
            <div className="empty-tree">还没有卷与章节。回到「写作」添加第一卷。</div>
          )}
        </div>
        <div className="tree-foot">
          <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
            只读预览 · 正文在此不可编辑
          </span>
        </div>
      </aside>

      <main className="col-middle">
        <div className="preview-head">
          <span className="pv-title">
            {active
              ? nodeLabel("章", active.c.chapter, active.c.title)
              : "暂无正文"}
          </span>
        </div>
        <div className="editor-wrap">
          <div
            className="editor fs-m lh-comfy"
            contentEditable={false}
            data-testid="preview-prose"
            dangerouslySetInnerHTML={{ __html: proseHtml }}
          />
        </div>
      </main>
    </div>
  );
}
