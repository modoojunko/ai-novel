// 主线卡表单（story-arc-planning / settings-three-col）：
// 一句话主线 / 结局想法（基调=问句+带解释的选择题，含「自己写」填空）/ 分卷规划。
// 「AI 帮我拆」四步向导已拆至右栏 ArcWizard（共享 useStoryArc 状态）。
import { forwardRef, useImperativeHandle, useRef } from "react";
import { type SettingSaveHandle } from "@/components/novel/settings/FormField";
import { Ico, P } from "@/components/icons";
import {
  useStoryArc,
  type ArcCtl,
  type ArcData,
  type ArcVolumeRow,
} from "./useStoryArc";

export type { ArcVolumeRow, ArcData } from "./useStoryArc";

// 基调选择题：问句 + 每项一句人话解释 + 作家自定义填空
const TONE_CHOICES = [
  { v: "悲", desc: "主角没得到想要的，或付出惨痛代价" },
  { v: "喜", desc: "目标达成，苦尽甘来" },
  { v: "开放", desc: "结局留白，答案交给读者" },
];

const PRESETS = TONE_CHOICES.map((c) => c.v);

interface Props {
  projectId: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** 外部共享状态（SettingsView 持有，与右栏向导同源）；缺省时自持（单测/独立使用） */
  ctl?: ArcCtl;
}

const StoryArcForm = forwardRef<SettingSaveHandle, Props>(function StoryArcForm(
  { projectId, onDirtyChange, ctl: external },
  ref,
) {
  const own = useStoryArc(projectId, !external, onDirtyChange);
  const c = external ?? own;
  const { arc, saving } = c;

  useImperativeHandle(ref, () => ({ save: () => c.save() }), [c]);

  const patch = (p: Partial<ArcData>) => c.patch(p);

  const patchVolume = (i: number, p: Partial<ArcVolumeRow>) =>
    c.patch({ volumes: arc.volumes.map((v, idx) => (idx === i ? { ...v, ...p } : v)) });

  const addVolume = () =>
    c.patch({ volumes: [...arc.volumes, { title: "", conflict: "", chapters: "" }] });
  const removeVolume = (i: number) =>
    c.patch({ volumes: arc.volumes.filter((_, idx) => idx !== i) });
  const markTbd = (i: number) =>
    patchVolume(i, { title: "待定", conflict: "待定", chapters: "?" });

  const tone = arc.ending.tone;
  const isCustom = tone !== "" && !PRESETS.includes(tone);
  const customRef = useRef<HTMLInputElement>(null);

  if (c.loading) {
    return <p className="opt">加载主线卡…</p>;
  }

  return (
    <div className="story-arc-form">
      {/* 一句话主线 */}
      <div className="field">
        <label>
          这本书讲什么 <span className="opt">一句话：谁 + 想要什么 + 什么拦着</span>
        </label>
        <textarea
          className="textarea"
          rows={2}
          maxLength={200}
          placeholder="例：陆征追查失踪案，发现三年前旧案被压，越查越深触及警队内部势力"
          value={arc.premise}
          disabled={saving}
          onChange={(e) => patch({ premise: e.target.value })}
        />
      </div>

      {/* 结局想法 */}
      <div className="field">
        <label>结局想法 <span className="opt">三项都可只填部分、可全空</span></label>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            className="input"
            placeholder="最后一幕画面（例：侦探所里看着旧卷宗）"
            value={arc.ending.scene}
            disabled={saving}
            onChange={(e) => patch({ ending: { ...arc.ending, scene: e.target.value } })}
          />
          <input
            className="input"
            placeholder="主角最终怎样（例：破案但心里装了更多）"
            value={arc.ending.hero}
            disabled={saving}
            onChange={(e) => patch({ ending: { ...arc.ending, hero: e.target.value } })}
          />
        </div>
        {/* 基调：先出题再给选项，再点已选项 = 取消；末项「自己写」= 自定义填空 */}
        <div role="radiogroup" aria-label="结局基调" style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <span className="opt" style={{ fontSize: 12 }}>故事读到最后，你想要哪种感觉？（可不选）</span>
          {TONE_CHOICES.map((ch) => (
            <button
              key={ch.v}
              type="button"
              role="radio"
              aria-checked={tone === ch.v}
              className={`tone-opt${tone === ch.v ? " on" : ""}`}
              disabled={saving}
              onClick={() => patch({ ending: { ...arc.ending, tone: tone === ch.v ? "" : ch.v } })}
            >
              <b>{ch.v}</b>
              <span className="opt" style={{ fontSize: 12 }}>{ch.desc}</span>
            </button>
          ))}
          <div className={`tone-opt tone-custom${isCustom ? " on" : ""}`}>
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              className="tone-custom-btn"
              disabled={saving}
              onClick={() => {
                if (isCustom) {
                  patch({ ending: { ...arc.ending, tone: "" } });
                } else {
                  patch({ ending: { ...arc.ending, tone: "" } });
                  customRef.current?.focus();
                }
              }}
            >
              <b>自己写</b>
            </button>
            <input
              ref={customRef}
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="例：先悲后喜 / 团圆但留遗憾"
              value={isCustom ? tone : ""}
              disabled={saving}
              onChange={(e) => patch({ ending: { ...arc.ending, tone: e.target.value } })}
            />
          </div>
        </div>
      </div>

      {/* 分卷规划 */}
      <div className="field">
        <label>
          分卷规划 <span className="opt">每卷一行：卷名（2-4 字）/ 这卷干什么 / 大概几章；后面的卷可整行「待定」</span>
        </label>
        <div style={{ display: "grid", gap: 8 }}>
          {arc.volumes.length === 0 && (
            <p className="opt" style={{ fontSize: 12 }}>还没有分卷行。可手加，也可用右侧 AI 向导倒推。</p>
          )}
          {arc.volumes.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="opt" style={{ fontSize: 12 }}>卷{i + 1}</span>
              <input
                className="input"
                style={{ width: 90 }}
                placeholder="卷名"
                value={v.title}
                disabled={saving}
                onChange={(e) => patchVolume(i, { title: e.target.value })}
              />
              <input
                className="input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="这卷干什么（核心冲突一句话）"
                value={v.conflict}
                disabled={saving}
                onChange={(e) => patchVolume(i, { conflict: e.target.value })}
              />
              <input
                className="input"
                style={{ width: 70 }}
                placeholder="章数"
                value={v.chapters}
                disabled={saving}
                onChange={(e) => patchVolume(i, { chapters: e.target.value })}
              />
              <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => markTbd(i)}>
                待定
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`删除卷${i + 1}`}
                disabled={saving}
                onClick={() => removeVolume(i)}
              >
                <Ico d={P.trash} />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={addVolume}>
              <Ico d={P.plus} />
              加一卷
            </button>
          </div>
        </div>
      </div>

      <p className="opt" style={{ fontSize: 12, margin: "-4px 0 16px" }}>
        分卷是规划草稿，不会自动变成实际的卷；主线没填也不影响直接去建卷写章。
      </p>
    </div>
  );
});

export default StoryArcForm;
