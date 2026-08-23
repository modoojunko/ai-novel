// 卷纲面板（book.html renderOutlinePanel 复刻，PR 4）：常编辑态（无查看/编辑切换）。
// 9 标量 + 四子表行内卡（行编辑实时写回；新行工厂——冲突层级号自增、章规划章号取
// 现有 max+1；数字字段按产品口径钳制）+ panel-foot「保存卷纲 / 去配章纲」。
// 卷名不在此编辑（树上铅笔改名 #164 口径）；产品 VolumeDetail 无 status → 徽标恒「草稿」。
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { nodeLabel } from "@/lib/nodeTitle";
import {
  toVolumeFormData,
  volumeFormToPayload,
  type VolumeFormData,
} from "../volume/form";
import type { VolumeDetail } from "../volume/types";

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

// 数字钳制（产品口径）：阶段章数 0-999；冲突层号 1-9；章号 ≥1（空/非数回落到边界值）
const clampCount = (v: string) => Math.max(0, Math.min(999, Math.floor(Number(v)) || 0));
const clampLayer = (v: string) => Math.max(1, Math.min(9, Math.floor(Number(v)) || 1));
const clampChNo = (v: string) => Math.max(1, Math.floor(Number(v)) || 1);

interface VolumePanelProps {
  projectId: string;
  volumeRef: string;
  /** 去配章纲：跳本卷第一个未确认章纲的章（无章则提示去树行加章） */
  onGoChapter: (ref: string) => void;
  onVolumeMutated: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

export default function VolumePanel({
  projectId,
  volumeRef,
  onGoChapter,
  onVolumeMutated,
  onDirtyChange,
}: VolumePanelProps) {
  const [detail, setDetail] = useState<VolumeDetail | null>(null);
  const [form, setForm] = useState<VolumeFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await api.get(
        `/novels/${projectId}/volumes/${volumeRef}`,
      )) as VolumeDetail;
      setDetail(data);
      setForm(toVolumeFormData(data));
    } catch (e: any) {
      setError(e?.message || "加载卷详情失败");
    } finally {
      setLoading(false);
    }
  }, [projectId, volumeRef]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    form !== null &&
    detail !== null &&
    JSON.stringify(form) !== JSON.stringify(toVolumeFormData(detail));
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const patch = useCallback((p: Partial<VolumeFormData>) => {
    setForm((f) => (f ? { ...f, ...p } : f));
  }, []);

  const save = async () => {
    if (!form || saving) return;
    setSaving(true);
    try {
      await api.put(
        `/novels/${projectId}/volumes/${volumeRef}`,
        volumeFormToPayload(form),
      );
      await load();
      onVolumeMutated();
      toast.success(`《${detail?.title ?? ""}》卷纲已保存`);
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

  // 去配章纲：本卷第一个未确认章纲的章，否则第一章
  const goChapterOutline = () => {
    const chs = detail?.chapters ?? [];
    if (!chs.length) {
      toast.info("本卷还没有章节，点卷行右侧「＋」添加");
      return;
    }
    const target = chs.find((c) => c.outline_status !== "confirmed") ?? chs[0];
    onGoChapter(target.ref);
  };

  const label = nodeLabel("卷", detail?.volume ?? 0, detail?.title ?? "");

  return (
    <div className="col-panel">
      <div className="panel">
        {loading ? (
          <p className="desc">卷纲加载中…</p>
        ) : error || !detail || !form ? (
          <div className="field">
            <p className="desc">{error || "卷不存在"}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => void load()}>
              重试
            </button>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <h2>{label}</h2>
              <span className="badge warn">草稿</span>
            </div>
            <p className="desc">
              卷纲：卷摘要与结构决定整卷走向；保存后可作为 AI 生成的卷级上下文。
            </p>

            <div className="field">
              <label>
                卷摘要 <span className="req">*</span>
              </label>
              <textarea
                className="textarea"
                placeholder="一段话讲清本卷讲什么"
                maxLength={300}
                value={form.summary}
                onChange={(e) => patch({ summary: e.target.value })}
              />
            </div>
            <div className="tpl-row">
              <div className="field tpl-select">
                <label>结构模板</label>
                <select
                  className="input"
                  value={form.template_name}
                  onChange={(e) => patch({ template_name: e.target.value })}
                >
                  <option value="">（未选择）</option>
                  {(form.template_name && !TEMPLATE_OPTIONS.includes(form.template_name)
                    ? [form.template_name]
                    : []
                  )
                    .concat(TEMPLATE_OPTIONS)
                    .map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field chtarget">
                <label>
                  章数目标 <span className="opt">1-9999，留空为不设</span>
                </label>
                <input
                  className="input num"
                  type="number"
                  min={1}
                  max={9999}
                  placeholder="如 20"
                  value={form.chapter_target}
                  onChange={(e) => patch({ chapter_target: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>
                核心冲突 <span className="req">*</span>{" "}
                <span className="opt">≤150 字</span>
              </label>
              <input
                className="input"
                maxLength={150}
                placeholder="本卷贯穿的核心矛盾"
                value={form.core_conflict}
                onChange={(e) => patch({ core_conflict: e.target.value })}
              />
            </div>
            <div className="row-3">
              <div className="field">
                <label>弧线模式</label>
                <select
                  className="input"
                  value={form.arc_mode}
                  onChange={(e) => patch({ arc_mode: e.target.value })}
                >
                  <option value="">（未选择）</option>
                  {(form.arc_mode && !ARC_MODE_OPTIONS.includes(form.arc_mode)
                    ? [form.arc_mode]
                    : []
                  )
                    .concat(ARC_MODE_OPTIONS)
                    .map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>主导驱动力</label>
                <select
                  className="input"
                  value={form.primary_drive}
                  onChange={(e) => patch({ primary_drive: e.target.value })}
                >
                  <option value="">（未选择）</option>
                  {(form.primary_drive && !DRIVE_OPTIONS.includes(form.primary_drive)
                    ? [form.primary_drive]
                    : []
                  )
                    .concat(DRIVE_OPTIONS)
                    .map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>方向来源</label>
                <select
                  className="input"
                  value={form.direction_method}
                  onChange={(e) => patch({ direction_method: e.target.value })}
                >
                  <option value="">（未选择）</option>
                  {form.direction_method &&
                    !DIRECTION_OPTIONS.some((o) => o.value === form.direction_method) && (
                      <option value={form.direction_method}>
                        {form.direction_method}
                      </option>
                    )}
                  {DIRECTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>
                情绪弧线 <span className="opt">≤150 字</span>
              </label>
              <input
                className="input"
                maxLength={150}
                placeholder="读者情绪的起伏走向"
                value={form.emotional_arc}
                onChange={(e) => patch({ emotional_arc: e.target.value })}
              />
            </div>

            <details className="cfg" open>
              <summary>
                信息差 <Chev />
              </summary>
              <div className="inner">
                <div className="field">
                  <label>
                    开卷信息差 <span className="opt">≤300 字</span>
                  </label>
                  <input
                    className="input"
                    maxLength={300}
                    placeholder="读者开卷时知道什么"
                    value={form.info_gap_start}
                    onChange={(e) => patch({ info_gap_start: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>
                    收卷信息差 <span className="opt">≤300 字</span>
                  </label>
                  <input
                    className="input"
                    maxLength={300}
                    placeholder="收卷时应揭示什么"
                    value={form.info_gap_end}
                    onChange={(e) => patch({ info_gap_end: e.target.value })}
                  />
                </div>
              </div>
            </details>

            {/* 阶段分配 */}
            <details className="cfg" open>
              <summary>
                阶段分配 <Chev />
              </summary>
              <div className="inner">
                <div className="sub-list">
                  {form.stages.length === 0 && <p className="sub-empty">暂无内容，点下方添加</p>}
                  {form.stages.map((s, i) => (
                    <div className="sub-row stages" key={i}>
                      <input
                        className="input"
                        maxLength={50}
                        placeholder="阶段名"
                        value={s.stage_name}
                        onChange={(e) => setStage(i, { stage_name: e.target.value })}
                      />
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="该阶段的一句话功能"
                        value={s.stage_function}
                        onChange={(e) => setStage(i, { stage_function: e.target.value })}
                      />
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={999}
                        title="章数"
                        value={s.chapter_count}
                        onChange={(e) => setStage(i, { chapter_count: clampCount(e.target.value) })}
                      />
                      <button
                        className="icon-btn"
                        title="删除本行"
                        onClick={() =>
                          patch({ stages: form.stages.filter((_, j) => j !== i) })
                        }
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="sub-add">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      patch({
                        stages: [
                          ...form.stages,
                          { stage_name: "", stage_function: "", chapter_count: 0 },
                        ],
                      })
                    }
                  >
                    <PlusIcon /> 添加阶段
                  </button>
                </div>
              </div>
            </details>

            {/* 冲突阶梯 */}
            <details className="cfg" open>
              <summary>
                冲突阶梯 <Chev />
              </summary>
              <div className="inner">
                <div className="sub-list">
                  {form.conflict_ladders.length === 0 && (
                    <p className="sub-empty">暂无内容，点下方添加</p>
                  )}
                  {form.conflict_ladders.map((l, i) => (
                    <div className="sub-block" key={i}>
                      <div className="sub-row ladder">
                        <input
                          className="input num"
                          type="number"
                          min={1}
                          max={9}
                          title="层号"
                          value={l.layer_no}
                          onChange={(e) => setLadder(i, { layer_no: clampLayer(e.target.value) })}
                        />
                        <input
                          className="input"
                          maxLength={20}
                          placeholder="章节区间"
                          value={l.chapters_range}
                          onChange={(e) => setLadder(i, { chapters_range: e.target.value })}
                        />
                        <select
                          className="input"
                          value={l.turning_type}
                          onChange={(e) => setLadder(i, { turning_type: e.target.value })}
                        >
                          <option value="">转折类型</option>
                          {(l.turning_type && !TURNING_OPTIONS.includes(l.turning_type)
                            ? [l.turning_type]
                            : []
                          )
                            .concat(TURNING_OPTIONS)
                            .map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                        </select>
                        <button
                          className="icon-btn"
                          title="删除本层"
                          onClick={() =>
                            patch({
                              conflict_ladders: form.conflict_ladders.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="本层障碍"
                        value={l.obstacle}
                        onChange={(e) => setLadder(i, { obstacle: e.target.value })}
                      />
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="转折点（可选）"
                        value={l.turning_point}
                        onChange={(e) => setLadder(i, { turning_point: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="sub-add">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      patch({
                        conflict_ladders: [
                          ...form.conflict_ladders,
                          {
                            layer_no: form.conflict_ladders.length + 1,
                            chapters_range: "",
                            obstacle: "",
                            turning_type: "",
                            turning_point: "",
                          },
                        ],
                      })
                    }
                  >
                    <PlusIcon /> 添加层级
                  </button>
                </div>
              </div>
            </details>

            {/* 章节规划 */}
            <details className="cfg" open>
              <summary>
                章节规划 <Chev />
              </summary>
              <div className="inner">
                <div className="sub-list">
                  {form.chapter_plans.length === 0 && (
                    <p className="sub-empty">暂无内容，点下方添加</p>
                  )}
                  {form.chapter_plans.map((p, i) => (
                    <div className="sub-block" key={i}>
                      <div className="sub-row plans">
                        <input
                          className="input num"
                          type="number"
                          min={1}
                          max={9999}
                          title="章号"
                          value={p.chapter_no}
                          onChange={(e) => setPlan(i, { chapter_no: clampChNo(e.target.value) })}
                        />
                        <input
                          className="input"
                          maxLength={200}
                          placeholder="章标题"
                          value={p.title}
                          onChange={(e) => setPlan(i, { title: e.target.value })}
                        />
                        <button
                          className="icon-btn"
                          title="删除本行"
                          onClick={() =>
                            patch({
                              chapter_plans: form.chapter_plans.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="一句话概要"
                        value={p.summary}
                        onChange={(e) => setPlan(i, { summary: e.target.value })}
                      />
                      <div className="row-3">
                        <input
                          className="input"
                          maxLength={150}
                          placeholder="情绪锚点（本章预期情绪）"
                          value={p.emotional_anchor}
                          onChange={(e) => setPlan(i, { emotional_anchor: e.target.value })}
                        />
                        <input
                          className="input"
                          maxLength={300}
                          placeholder="信息差"
                          value={p.info_gap}
                          onChange={(e) => setPlan(i, { info_gap: e.target.value })}
                        />
                        <input
                          className="input"
                          maxLength={150}
                          placeholder="弧线位置"
                          value={p.arc_position}
                          onChange={(e) => setPlan(i, { arc_position: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sub-add">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      patch({
                        chapter_plans: [
                          ...form.chapter_plans,
                          {
                            chapter_no:
                              form.chapter_plans.reduce(
                                (m, x) => Math.max(m, x.chapter_no || 0),
                                0,
                              ) + 1,
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
                    <PlusIcon /> 添加章规划
                  </button>
                </div>
              </div>
            </details>

            {/* 角色发声 */}
            <details className="cfg" open>
              <summary>
                角色发声 <Chev />
              </summary>
              <div className="inner">
                <div className="sub-list">
                  {form.character_voices.length === 0 && (
                    <p className="sub-empty">暂无内容，点下方添加</p>
                  )}
                  {form.character_voices.map((c, i) => (
                    <div className="sub-block" key={i}>
                      <div className="sub-row voices">
                        <input
                          className="input"
                          maxLength={50}
                          placeholder="角色名"
                          value={c.character_name}
                          onChange={(e) => setVoice(i, { character_name: e.target.value })}
                        />
                        <button
                          className="icon-btn"
                          title="删除本角色"
                          onClick={() =>
                            patch({
                              character_voices: form.character_voices.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="卷末落位：卷结束时该角色的处境"
                        value={c.situation}
                        onChange={(e) => setVoice(i, { situation: e.target.value })}
                      />
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="未完成的事"
                        value={c.unfinished}
                        onChange={(e) => setVoice(i, { unfinished: e.target.value })}
                      />
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="卷间思考"
                        value={c.interlude_thought}
                        onChange={(e) => setVoice(i, { interlude_thought: e.target.value })}
                      />
                      <input
                        className="input"
                        maxLength={300}
                        placeholder="下一卷想做的事"
                        value={c.next_action}
                        onChange={(e) => setVoice(i, { next_action: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="sub-add">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      patch({
                        character_voices: [
                          ...form.character_voices,
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
                    <PlusIcon /> 添加角色
                  </button>
                </div>
              </div>
            </details>

            <div className="panel-foot">
              <span style={{ marginRight: "auto" }} />
              <button className="btn btn-secondary" disabled={saving} onClick={() => void save()}>
                保存卷纲
              </button>
              <button className="btn btn-primary" onClick={goChapterOutline}>
                去配章纲
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── 子表行 setter（浅拷贝行，保持 form 不可变更新） ────────────────────
  function setStage(i: number, p: Partial<VolumeFormData["stages"][number]>) {
    setForm((f) =>
      f
        ? { ...f, stages: f.stages.map((r, j) => (j === i ? { ...r, ...p } : r)) }
        : f,
    );
  }
  function setLadder(
    i: number,
    p: Partial<VolumeFormData["conflict_ladders"][number]>,
  ) {
    setForm((f) =>
      f
        ? {
            ...f,
            conflict_ladders: f.conflict_ladders.map((r, j) =>
              j === i ? { ...r, ...p } : r,
            ),
          }
        : f,
    );
  }
  function setPlan(i: number, p: Partial<VolumeFormData["chapter_plans"][number]>) {
    setForm((f) =>
      f
        ? {
            ...f,
            chapter_plans: f.chapter_plans.map((r, j) => (j === i ? { ...r, ...p } : r)),
          }
        : f,
    );
  }
  function setVoice(
    i: number,
    p: Partial<VolumeFormData["character_voices"][number]>,
  ) {
    setForm((f) =>
      f
        ? {
            ...f,
            character_voices: f.character_voices.map((r, j) =>
              j === i ? { ...r, ...p } : r,
            ),
          }
        : f,
    );
  }
}

function Chev() {
  return (
    <svg
      className="chev"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      width="13"
      height="13"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}
