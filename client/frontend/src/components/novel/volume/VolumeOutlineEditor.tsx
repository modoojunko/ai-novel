import { Plus, X } from "lucide-react";
import type {
  VolumeChapterPlan,
  VolumeCharacterVoice,
  VolumeConflictLadder,
  VolumeStage,
} from "./types";
import type { VolumeFormData } from "./form";

// 枚举选项值 = PRD/seed 既定集合；select 里额外保留未知现值防展示错位
const TEMPLATE_OPTIONS = ["三幕式", "起承転結", "悬疑递进", "人物弧线"];
const ARC_MODE_OPTIONS = ["先压后爽", "层层逼近", "张力开合", "蓄势爆发", "螺旋递进"];
const DRIVE_OPTIONS = ["悬疑", "威胁", "目标", "关系", "信息差"];
const TURNING_OPTIONS = ["信息转折", "关系转折", "状态转折", "事件转折"];
const DIRECTION_OPTIONS = [
  { value: "template", label: "结构模板" },
  { value: "character_voice", label: "角色发声" },
  { value: "manual", label: "手动" },
];

const inputCls =
  "w-full bg-base-200/40 border border-base-300/60 rounded-lg px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/25";

/** 卷纲编辑态：9 标量表单 + 四组行内列表编辑器（保存时整族替换） */
export default function VolumeOutlineEditor({
  formData,
  onChange,
}: {
  formData: VolumeFormData;
  onChange: (next: VolumeFormData) => void;
}) {
  const setStage = (i: number, patch: Partial<VolumeStage>) =>
    onChange({
      ...formData,
      stages: formData.stages.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    });
  const setLadder = (i: number, patch: Partial<VolumeConflictLadder>) =>
    onChange({
      ...formData,
      conflict_ladders: formData.conflict_ladders.map((r, j) =>
        j === i ? { ...r, ...patch } : r,
      ),
    });
  const setPlan = (i: number, patch: Partial<VolumeChapterPlan>) =>
    onChange({
      ...formData,
      chapter_plans: formData.chapter_plans.map((r, j) =>
        j === i ? { ...r, ...patch } : r,
      ),
    });
  const setVoice = (i: number, patch: Partial<VolumeCharacterVoice>) =>
    onChange({
      ...formData,
      character_voices: formData.character_voices.map((r, j) =>
        j === i ? { ...r, ...patch } : r,
      ),
    });

  const nextLadderNo = formData.conflict_ladders.length + 1;
  const nextPlanNo =
    formData.chapter_plans.reduce((m, p) => Math.max(m, p.chapter_no), 0) + 1;

  return (
    <div className="space-y-6">
      {/* 9 标量 */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="结构模板">
          <EnumSelect
            value={formData.template_name}
            options={TEMPLATE_OPTIONS}
            onChange={(v) => onChange({ ...formData, template_name: v })}
          />
        </Field>
        <Field label="弧线模式">
          <EnumSelect
            value={formData.arc_mode}
            options={ARC_MODE_OPTIONS}
            onChange={(v) => onChange({ ...formData, arc_mode: v })}
          />
        </Field>
        <Field label="主导驱动力">
          <EnumSelect
            value={formData.primary_drive}
            options={DRIVE_OPTIONS}
            onChange={(v) => onChange({ ...formData, primary_drive: v })}
          />
        </Field>
        <Field label="方向来源">
          <DirectionSelect
            value={formData.direction_method}
            onChange={(v) => onChange({ ...formData, direction_method: v })}
          />
        </Field>
        <Field label="核心冲突" hint="≤150 字">
          <input
            className={inputCls}
            maxLength={150}
            value={formData.core_conflict}
            onChange={(e) => onChange({ ...formData, core_conflict: e.target.value })}
            placeholder="本卷贯穿的核心矛盾"
          />
        </Field>
        <Field label="情绪弧线" hint="≤150 字">
          <input
            className={inputCls}
            maxLength={150}
            value={formData.emotional_arc}
            onChange={(e) => onChange({ ...formData, emotional_arc: e.target.value })}
            placeholder="读者情绪的起伏走向"
          />
        </Field>
        <Field label="开卷信息差" hint="≤300 字">
          <input
            className={inputCls}
            maxLength={300}
            value={formData.info_gap_start}
            onChange={(e) => onChange({ ...formData, info_gap_start: e.target.value })}
            placeholder="读者开卷时知道什么"
          />
        </Field>
        <Field label="收卷信息差" hint="≤300 字">
          <input
            className={inputCls}
            maxLength={300}
            value={formData.info_gap_end}
            onChange={(e) => onChange({ ...formData, info_gap_end: e.target.value })}
            placeholder="收卷时应揭示什么"
          />
        </Field>
        <Field label="章数目标" hint="1-9999，留空为不设">
          <input
            type="number"
            min={1}
            max={9999}
            className={inputCls}
            value={formData.chapter_target}
            onChange={(e) => onChange({ ...formData, chapter_target: e.target.value })}
            placeholder="如 20"
          />
        </Field>
      </div>

      {/* 阶段分配 */}
      <ListBlock
        title="阶段分配"
        count={formData.stages.length}
        addLabel="添加阶段"
        onAdd={() =>
          onChange({
            ...formData,
            stages: [
              ...formData.stages,
              { stage_name: "", stage_function: "", chapter_count: 0 },
            ],
          })
        }
      >
        {formData.stages.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_4.75rem_1.9rem] items-center gap-2"
          >
            <input
              className={inputCls}
              maxLength={50}
              value={s.stage_name}
              onChange={(e) => setStage(i, { stage_name: e.target.value })}
              placeholder="阶段名"
            />
            <input
              className={inputCls}
              maxLength={300}
              value={s.stage_function}
              onChange={(e) => setStage(i, { stage_function: e.target.value })}
              placeholder="该阶段的一句话功能"
            />
            <input
              type="number"
              min={0}
              max={999}
              className={inputCls + " tabular-nums"}
              value={s.chapter_count}
              onChange={(e) =>
                setStage(i, {
                  chapter_count: Math.max(0, Math.floor(e.target.valueAsNumber) || 0),
                })
              }
              title="章数"
            />
            <RowRemove
              onClick={() =>
                onChange({
                  ...formData,
                  stages: formData.stages.filter((_, j) => j !== i),
                })
              }
            />
          </div>
        ))}
      </ListBlock>

      {/* 冲突阶梯 */}
      <ListBlock
        title="冲突阶梯"
        count={formData.conflict_ladders.length}
        addLabel="添加层级"
        onAdd={() =>
          onChange({
            ...formData,
            conflict_ladders: [
              ...formData.conflict_ladders,
              {
                layer_no: nextLadderNo,
                chapters_range: "",
                obstacle: "",
                turning_type: "",
                turning_point: "",
              },
            ],
          })
        }
      >
        {formData.conflict_ladders.map((l, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-base-300/50 p-2.5">
            <div className="grid grid-cols-[4.25rem_minmax(0,6rem)_minmax(0,8.5rem)_1.9rem] items-center gap-2">
              <input
                type="number"
                min={1}
                max={9}
                className={inputCls + " tabular-nums"}
                value={l.layer_no}
                onChange={(e) =>
                  setLadder(i, {
                    layer_no: Math.min(9, Math.max(1, Math.floor(e.target.valueAsNumber) || 1)),
                  })
                }
                title="层号"
              />
              <input
                className={inputCls}
                maxLength={20}
                value={l.chapters_range}
                onChange={(e) => setLadder(i, { chapters_range: e.target.value })}
                placeholder="章节区间"
              />
              <EnumSelect
                value={l.turning_type}
                options={TURNING_OPTIONS}
                onChange={(v) => setLadder(i, { turning_type: v })}
              />
              <RowRemove
                onClick={() =>
                  onChange({
                    ...formData,
                    conflict_ladders: formData.conflict_ladders.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
            <input
              className={inputCls}
              maxLength={300}
              value={l.obstacle}
              onChange={(e) => setLadder(i, { obstacle: e.target.value })}
              placeholder="本层障碍"
            />
            <input
              className={inputCls}
              maxLength={300}
              value={l.turning_point}
              onChange={(e) => setLadder(i, { turning_point: e.target.value })}
              placeholder="转折点（可选）"
            />
          </div>
        ))}
      </ListBlock>

      {/* 章节规划 */}
      <ListBlock
        title="章节规划"
        count={formData.chapter_plans.length}
        addLabel="添加章规划"
        onAdd={() =>
          onChange({
            ...formData,
            chapter_plans: [
              ...formData.chapter_plans,
              {
                chapter_no: nextPlanNo,
                title: "",
                summary: "",
                emotional_anchor: "",
                info_gap: "",
                arc_position: "",
              },
            ],
          })
        }
      >
        {formData.chapter_plans.map((p, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-base-300/50 p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={9999}
                className={inputCls + " w-16 shrink-0 tabular-nums"}
                value={p.chapter_no}
                onChange={(e) =>
                  setPlan(i, {
                    chapter_no: Math.max(1, Math.floor(e.target.valueAsNumber) || 1),
                  })
                }
                title="章号"
              />
              <input
                className={inputCls + " flex-1"}
                maxLength={200}
                value={p.title}
                onChange={(e) => setPlan(i, { title: e.target.value })}
                placeholder="章标题"
              />
              <RowRemove
                onClick={() =>
                  onChange({
                    ...formData,
                    chapter_plans: formData.chapter_plans.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
            <input
              className={inputCls}
              maxLength={300}
              value={p.summary}
              onChange={(e) => setPlan(i, { summary: e.target.value })}
              placeholder="一句话概要"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                className={inputCls}
                maxLength={150}
                value={p.emotional_anchor}
                onChange={(e) => setPlan(i, { emotional_anchor: e.target.value })}
                placeholder="情绪锚点（本章预期情绪）"
              />
              <input
                className={inputCls}
                maxLength={300}
                value={p.info_gap}
                onChange={(e) => setPlan(i, { info_gap: e.target.value })}
                placeholder="信息差"
              />
              <input
                className={inputCls}
                maxLength={150}
                value={p.arc_position}
                onChange={(e) => setPlan(i, { arc_position: e.target.value })}
                placeholder="弧线位置"
              />
            </div>
          </div>
        ))}
      </ListBlock>

      {/* 角色发声 */}
      <ListBlock
        title="角色发声"
        count={formData.character_voices.length}
        addLabel="添加角色"
        onAdd={() =>
          onChange({
            ...formData,
            character_voices: [
              ...formData.character_voices,
              {
                character_name: "",
                situation: "",
                unfinished: "",
                interlude_thought: "",
                next_action: "",
              },
            ],
          })
        }
      >
        {formData.character_voices.map((v, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-base-300/50 p-2.5">
            <div className="flex items-center gap-2">
              <input
                className={inputCls + " max-w-44 flex-1"}
                maxLength={50}
                value={v.character_name}
                onChange={(e) => setVoice(i, { character_name: e.target.value })}
                placeholder="角色名"
              />
              <div className="flex-1" />
              <RowRemove
                onClick={() =>
                  onChange({
                    ...formData,
                    character_voices: formData.character_voices.filter(
                      (_, j) => j !== i,
                    ),
                  })
                }
              />
            </div>
            <input
              className={inputCls}
              maxLength={300}
              value={v.situation}
              onChange={(e) => setVoice(i, { situation: e.target.value })}
              placeholder="卷末落位：卷结束时该角色的处境"
            />
            <input
              className={inputCls}
              maxLength={300}
              value={v.unfinished}
              onChange={(e) => setVoice(i, { unfinished: e.target.value })}
              placeholder="未完成的事"
            />
            <input
              className={inputCls}
              maxLength={300}
              value={v.interlude_thought}
              onChange={(e) => setVoice(i, { interlude_thought: e.target.value })}
              placeholder="卷间思考"
            />
            <input
              className={inputCls}
              maxLength={300}
              value={v.next_action}
              onChange={(e) => setVoice(i, { next_action: e.target.value })}
              placeholder="下一卷想做的事"
            />
          </div>
        ))}
      </ListBlock>
    </div>
  );
}

// ── 局部件 ────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium tracking-wide text-base-content/60">
        {label}
        {hint && <span className="ml-1.5 font-normal text-base-content/30">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function EnumSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls + " cursor-pointer appearance-none"}
    >
      <option value="">未选择</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function DirectionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const known = value === "" || DIRECTION_OPTIONS.some((o) => o.value === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls + " cursor-pointer appearance-none"}
    >
      <option value="">未选择</option>
      {!known && value && <option value={value}>{value}</option>}
      {DIRECTION_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RowRemove({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="删除本行"
      className="btn btn-ghost btn-xs h-7 min-h-0 w-7 shrink-0 p-0 text-base-content/30 hover:text-error"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function ListBlock({
  title,
  count,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  count: number;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-base-content/80">
          {title}
          <span className="ml-1.5 text-xs font-normal tabular-nums text-base-content/40">
            {count} 项
          </span>
        </h4>
        <button
          onClick={onAdd}
          className="btn btn-ghost btn-xs gap-1 text-primary/70 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      </div>
      {count > 0 ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="rounded-lg border border-dashed border-base-300/70 px-3 py-3 text-center text-xs text-base-content/30">
          暂无内容，点右上添加
        </p>
      )}
    </div>
  );
}
