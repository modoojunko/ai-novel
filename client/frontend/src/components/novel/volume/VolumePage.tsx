import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PencilLine } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { WorkbenchVolume } from "@/hooks/useWorkbench";
import VolumeOutlineView from "./VolumeOutlineView";
import VolumeOutlineEditor from "./VolumeOutlineEditor";
import VolumeChapterList from "./VolumeChapterList";
import VolumeToolbar from "./VolumeToolbar";
import { toVolumeFormData, volumeFormToPayload, type VolumeFormData } from "./form";
import type { VolumeDetail } from "./types";

/**
 * 卷工作台页：点左树卷名 → 中栏卷查看/编辑 + 右栏信息/导航/操作（无弹层）。
 * 默认查看态，点「编辑」进入编辑（标题/简述/卷纲全字段）；显式保存（子表整族替换）；
 * 脏标记上抛 onDirtyChange，Workbench 在切节点前拦截确认。
 */
export default function VolumePage({
  projectId,
  volumeRef,
  volumes,
  onChapterSelect,
  onVolumeMutated,
  onDeleteVolume,
  onDirtyChange,
}: {
  projectId: string;
  volumeRef: string;
  volumes: WorkbenchVolume[];
  onChapterSelect: (ref: string) => void;
  onVolumeMutated: () => void;
  onDeleteVolume: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [detail, setDetail] = useState<VolumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [formData, setFormData] = useState<VolumeFormData | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/novels/${projectId}/volumes/${volumeRef}`);
      setDetail(data as VolumeDetail);
    } catch (e: any) {
      setError(e?.message || "加载卷详情失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, volumeRef]);

  useEffect(() => {
    void load();
  }, [load]);

  // 切卷回到查看态
  useEffect(() => {
    setMode("view");
    setFormData(null);
  }, [volumeRef]);

  const dirty = useMemo(
    () =>
      formData !== null &&
      detail !== null &&
      JSON.stringify(formData) !== JSON.stringify(toVolumeFormData(detail)),
    [formData, detail],
  );

  useEffect(() => {
    onDirtyChange(dirty && mode === "edit");
  }, [dirty, mode, onDirtyChange]);

  const startEdit = () => {
    if (!detail) return;
    setFormData(toVolumeFormData(detail));
    setMode("edit");
  };

  const cancelEdit = () => {
    if (dirty && !window.confirm("有未保存的修改，确定放弃吗？")) return;
    setMode("view");
    setFormData(null);
  };

  const save = async () => {
    if (!formData || saving) return;
    if (!formData.title.trim()) {
      toast.error("卷名不能为空");
      return;
    }
    setSaving(true);
    try {
      await api.put(
        `/novels/${projectId}/volumes/${volumeRef}`,
        volumeFormToPayload(formData),
      );
      await load();
      setMode("view");
      setFormData(null);
      onVolumeMutated();
      toast.success("卷已保存");
    } catch (e: any) {
      toast.error(
        e?.status === 422
          ? "部分字段超长或格式有误，请检查后重试"
          : e?.message || "保存失败",
      );
    } finally {
      setSaving(false);
    }
  };

  const volIndexRaw = volumes.findIndex((v) => v.name === volumeRef);
  const volIndex = volIndexRaw >= 0 ? volIndexRaw : Math.max(0, (detail?.volume ?? 1) - 1);
  const volTotal = volumes.length || 1;

  return (
    <div className="flex h-full min-w-0 flex-1 gap-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : error || !detail ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm text-error">{error || "卷不存在"}</p>
            <button className="btn btn-primary btn-sm" onClick={() => void load()}>
              重试
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
            {mode === "view" ? (
              <>
                <header className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="truncate font-serif text-2xl font-semibold text-base-content">
                      {detail.title || `第${detail.volume}卷`}
                    </h1>
                    <VolumeMeta detail={detail} volIndex={volIndex} volTotal={volTotal} />
                  </div>
                  <button
                    onClick={startEdit}
                    className="btn btn-sm shrink-0 gap-1.5 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <PencilLine className="h-3.5 w-3.5" /> 编辑
                  </button>
                </header>

                <section className="space-y-3">
                  <SectionTitle>卷故事简述</SectionTitle>
                  {detail.summary ? (
                    <p className="whitespace-pre-wrap rounded-xl border border-base-300/60 bg-base-200/40 p-4 text-sm leading-relaxed text-base-content/85">
                      {detail.summary}
                    </p>
                  ) : (
                    <p className="rounded-xl border border-dashed border-base-300/70 p-4 text-sm text-base-content/30">
                      尚未填写卷简述，点右上「编辑」补全
                    </p>
                  )}
                </section>

                <section className="space-y-4">
                  <SectionTitle>卷纲</SectionTitle>
                  <VolumeOutlineView data={detail} />
                </section>
              </>
            ) : (
              formData && (
                <>
                  <header className="space-y-3">
                    <input
                      value={formData.title}
                      maxLength={200}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="卷名"
                      className="w-full border-b border-base-300/60 bg-transparent px-0 pb-1.5 font-serif text-2xl font-semibold text-base-content outline-none transition-colors placeholder:text-base-content/25 focus:border-primary/40"
                    />
                    <div className="flex items-center justify-between gap-4">
                      <VolumeMeta detail={detail} volIndex={volIndex} volTotal={volTotal} />
                      <div className="flex shrink-0 gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                          取消
                        </button>
                        <button
                          className="btn btn-primary btn-sm min-w-20"
                          onClick={() => void save()}
                          disabled={saving}
                        >
                          {saving ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : dirty ? (
                            "保存 ●"
                          ) : (
                            "保存"
                          )}
                        </button>
                      </div>
                    </div>
                  </header>

                  <section className="space-y-3">
                    <SectionTitle>卷故事简述</SectionTitle>
                    <div>
                      <textarea
                        value={formData.summary}
                        maxLength={300}
                        rows={4}
                        onChange={(e) =>
                          setFormData({ ...formData, summary: e.target.value })
                        }
                        placeholder="一段话讲清本卷讲什么"
                        className="w-full resize-y rounded-xl border border-base-300/60 bg-base-200/40 p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-base-content/25 focus:border-primary/40"
                      />
                      <div className="mt-1 text-right text-[11px] tabular-nums text-base-content/30">
                        {formData.summary.length}/300
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <SectionTitle>卷纲</SectionTitle>
                    <VolumeOutlineEditor formData={formData} onChange={setFormData} />
                  </section>
                </>
              )
            )}

            <section className="space-y-3 pb-6">
              <SectionTitle>本卷章节</SectionTitle>
              <VolumeChapterList
                chapters={detail.chapters}
                onChapterSelect={onChapterSelect}
              />
            </section>
          </div>
        )}
      </div>

      {detail && !loading && (
        <VolumeToolbar
          detail={detail}
          volIndex={volIndex}
          volTotal={volTotal}
          onChapterSelect={onChapterSelect}
          onDeleteVolume={onDeleteVolume}
        />
      )}
    </div>
  );
}

// ── 局部件 ────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-base-content/80">
      <span className="h-4 w-0.5 rounded-full bg-primary/60" />
      {children}
    </h2>
  );
}

function VolumeMeta({
  detail,
  volIndex,
  volTotal,
}: {
  detail: VolumeDetail;
  volIndex: number;
  volTotal: number;
}) {
  const chapters = detail.chapters || [];
  const totalWords = chapters.reduce((s, c) => s + (c.word_count || 0), 0);
  const confirmed = chapters.filter((c) => c.status === "confirmed").length;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/50">
      <span>
        第 {volIndex + 1} 卷 / 共 {volTotal} 卷
      </span>
      <span>
        {chapters.length} 章
        {detail.chapter_target != null ? ` · 目标 ${detail.chapter_target} 章` : ""}
      </span>
      <span className="tabular-nums">{totalWords.toLocaleString()} 字</span>
      <span className="tabular-nums">
        {confirmed}/{chapters.length} 已确认
      </span>
    </p>
  );
}
