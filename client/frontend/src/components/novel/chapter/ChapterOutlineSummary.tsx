// 章纲查看卡：已确认章的只读摘要（编辑入口在章页壳，[✎ 编辑] 切回编辑态）

import type { ChapterData } from "@/hooks/useOutline";
import { chapterStatusLabel } from "../statusBadge";

function KV({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-xs text-base-content/40 mb-1">{label}</dt>
      <dd className="text-sm text-base-content/85 leading-relaxed whitespace-pre-wrap">
        {value}
      </dd>
    </div>
  );
}

function Chips({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <dt className="text-xs text-base-content/40 mb-1.5">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={i}
            className="badge badge-ghost badge-sm max-w-full truncate font-normal"
          >
            {it}
          </span>
        ))}
      </dd>
    </div>
  );
}

export default function ChapterOutlineSummary({ data }: { data: ChapterData }) {
  const o = data.outline || {};
  const m = data.memo || {};
  const re = m.reader_expectation || {};
  const pp = m.payoff_plan || {};
  const segTotal = (data.segments || []).reduce(
    (acc, s) => acc + (s.target_words || 0),
    0,
  );

  const spacetime = [o.location, o.time].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium text-base-content">
            章纲摘要
          </h4>
          <p className="text-xs text-base-content/40 mt-0.5">
            已确认 · 状态由系统维护，如需修改点右上「编辑章纲」
          </p>
        </div>
        <span className="badge badge-success badge-sm shrink-0">
          {chapterStatusLabel(data.status)}
        </span>
      </div>

      <div className="rounded-xl border border-base-200/80 bg-base-200/30 divide-y divide-base-200/80">
        {/* 概要 */}
        <div className="px-4 py-3.5">
          <div className="text-xs text-base-content/40 mb-1">章纲概要</div>
          <p className="text-sm text-base-content/90 leading-relaxed whitespace-pre-wrap">
            {o.summary?.trim() || "未填写概要"}
          </p>
        </div>

        {/* 关键事件 / 角色 */}
        <div className="px-4 py-3.5 grid gap-4 sm:grid-cols-2">
          <Chips label={`关键事件（${o.key_points?.length || 0}）`} items={o.key_points} />
          <Chips label={`出场角色（${o.characters?.length || 0}）`} items={o.characters} />
        </div>

        {/* 时空 / 视角 */}
        <dl className="px-4 py-3.5 grid gap-4 sm:grid-cols-2">
          <KV label="时空" value={spacetime} />
          <KV label="叙事视角" value={o.narrative_pov} />
          <KV label="视角指导" value={o.perspective_guidance} />
          <KV label="主情绪" value={data.emotional_design?.primary_mood} />
        </dl>

        {/* memo 四要点 */}
        <dl className="px-4 py-3.5 grid gap-4 sm:grid-cols-2">
          <KV label="核心任务" value={m.current_task} />
          <KV
            label="读者预期"
            value={
              [re.state, re.strategy, re.detail].filter(Boolean).join(" · ") ||
              undefined
            }
          />
          <Chips label="必须回收" items={pp.must_resolve} />
          <Chips label="维持悬念" items={pp.must_hold} />
          <Chips label="可部分推进" items={pp.partial_advance} />
          <Chips label="必须完成的变化" items={m.required_changes} />
          <Chips label="禁止事项" items={m.prohibitions} />
        </dl>

        {/* 段落规划 */}
        <div className="px-4 py-3.5 flex items-center justify-between text-sm">
          <span className="text-base-content/60">段落规划</span>
          <span className="text-base-content/85 tabular-nums">
            {data.segments?.length || 0} 段
            {segTotal > 0 && ` · 目标约 ${segTotal.toLocaleString()} 字`}
          </span>
        </div>
      </div>
    </div>
  );
}
