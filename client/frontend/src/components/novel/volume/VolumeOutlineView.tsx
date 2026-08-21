import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { VolumeDetail } from "./types";

const DIRECTION_LABELS: Record<string, string> = {
  template: "结构模板",
  character_voice: "角色发声",
  manual: "手动",
};

/** 卷纲查看态：标量 kv 网格 + 四组折叠列表块（默认收起） */
export default function VolumeOutlineView({ data }: { data: VolumeDetail }) {
  const stages = data.stages || [];
  const ladders = data.conflict_ladders || [];
  const plans = data.chapter_plans || [];
  const voices = data.character_voices || [];
  const chapterCount = (data.chapters || []).length;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
        <KV label="核心冲突" value={data.core_conflict} />
        <KV label="情绪弧线" value={data.emotional_arc} />
        <KV label="结构模板" value={data.template_name} />
        <KV label="弧线模式" value={data.arc_mode} />
        <KV label="主导驱动力" value={data.primary_drive} />
        <KV
          label="方向来源"
          value={
            data.direction_method
              ? DIRECTION_LABELS[data.direction_method] || data.direction_method
              : ""
          }
        />
        <KV
          label="章数目标"
          value={
            data.chapter_target != null
              ? `${data.chapter_target} 章（实际 ${chapterCount} 章）`
              : ""
          }
        />
        <KV
          label="信息差弧"
          wide
          value={
            data.info_gap_start || data.info_gap_end
              ? `${data.info_gap_start || "？"} → ${data.info_gap_end || "？"}`
              : ""
          }
        />
      </dl>

      <Fold title="阶段分配" count={stages.length}>
        {stages.map((s, i) => (
          <div key={i} className="flex items-start gap-3 text-sm">
            <span className="w-16 shrink-0 truncate text-base-content/60">
              {s.stage_name}
            </span>
            <span className="min-w-0 flex-1 leading-relaxed text-base-content/85">
              {s.stage_function}
            </span>
            <span className="shrink-0 pt-0.5 text-xs tabular-nums text-base-content/40">
              {s.chapter_count} 章
            </span>
          </div>
        ))}
      </Fold>

      <Fold title="冲突阶梯" count={ladders.length}>
        {ladders.map((l, i) => (
          <div key={i} className="space-y-1.5 rounded-lg bg-base-200/30 p-3">
            <div className="flex items-center gap-2 text-xs text-base-content/50">
              <span className="tabular-nums">第 {l.layer_no} 层</span>
              {l.chapters_range && (
                <span className="tabular-nums">{l.chapters_range}</span>
              )}
              {l.turning_type && (
                <span className="badge badge-ghost badge-xs">{l.turning_type}</span>
              )}
            </div>
            {l.obstacle && (
              <p className="text-sm leading-relaxed text-base-content/85">
                {l.obstacle}
              </p>
            )}
            {l.turning_point && (
              <p className="text-sm leading-relaxed text-base-content/60">
                转折点 → {l.turning_point}
              </p>
            )}
          </div>
        ))}
      </Fold>

      <Fold title="章节规划" count={plans.length}>
        {plans.map((p, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-base-300/50 p-3">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-xs tabular-nums text-base-content/40">
                第 {p.chapter_no} 章
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-base-content">
                {p.title}
              </span>
              {p.arc_position && (
                <span className="shrink-0 text-[11px] text-base-content/40">
                  {p.arc_position}
                </span>
              )}
            </div>
            {p.summary && (
              <p className="text-sm leading-relaxed text-base-content/75">{p.summary}</p>
            )}
            {(p.emotional_anchor || p.info_gap) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {p.emotional_anchor && (
                  <span className="text-primary/70">{p.emotional_anchor}</span>
                )}
                {p.info_gap && <span className="text-base-content/50">{p.info_gap}</span>}
              </div>
            )}
          </div>
        ))}
      </Fold>

      <Fold title="角色发声" count={voices.length}>
        {voices.map((v, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-base-300/50 p-3">
            <div className="text-sm font-medium text-base-content">
              {v.character_name}
            </div>
            <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              <Row label="卷末落位" value={v.situation} />
              <Row label="未完成的事" value={v.unfinished} />
              <Row label="卷间思考" value={v.interlude_thought} />
              <Row label="现在想做的" value={v.next_action} />
            </dl>
          </div>
        ))}
      </Fold>
    </div>
  );
}

function KV({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="mb-1 text-xs font-medium tracking-wide text-base-content/50">
        {label}
      </dt>
      <dd className="break-words text-sm leading-relaxed text-base-content/85">
        {value ? value : <span className="text-base-content/30">未填写</span>}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-base-content/40">{label}</dt>
      <dd className="leading-relaxed text-base-content/75">{value}</dd>
    </>
  );
}

function Fold({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-base-300/50">
      <button
        onClick={() => count > 0 && setOpen(!open)}
        className="flex w-full items-center justify-between bg-base-200/30 px-4 py-2.5 transition-colors hover:bg-base-200/60"
      >
        <span className="text-sm font-medium text-base-content/80">{title}</span>
        <span className="flex items-center gap-2 text-xs text-base-content/40">
          {count > 0 ? `${count} 项` : "未填写"}
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${open && count > 0 ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      {open && count > 0 && <div className="space-y-3 p-4">{children}</div>}
    </div>
  );
}
