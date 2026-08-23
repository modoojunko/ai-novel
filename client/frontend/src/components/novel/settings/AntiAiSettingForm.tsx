import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import { Ico, P } from "@/components/icons";
import { Cfg, ListEditor, SettingSaveHandle } from "./FormField";

interface Props {
  projectId: string;
  settingKey: string;
  /** P2-1：脏状态回调（未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

interface TicPattern {
  pattern: string;
  name: string;
  threshold: number;
  severity: string;
  description: string;
}

// 与模板 anti-ai.yaml 的 fatigue_words_zh 7 分类一致（quality.py 按此分类展平检查）
const FATIGUE_CATEGORIES = [
  { key: "summary_narrative", label: "总结叙事", hint: "本章讲述了、接下来、与此同时" },
  { key: "abstract_emotion", label: "抽象情绪", hint: "他感到、他觉得、他意识到" },
  { key: "academic_tone", label: "学术腔调", hint: "综上所述、总而言之、显而易见" },
  { key: "cliche_action", label: "套路动作", hint: "深吸一口气、咬了咬牙、眼中闪过一丝" },
  { key: "cliche_environment", label: "套路环境", hint: "阳光透过树叶、微风拂过、夜幕降临" },
  { key: "logical_connectors", label: "逻辑连接", hint: "由此可见、正因如此、不仅如此" },
  { key: "narrative_filler", label: "叙述填充", hint: "似乎、仿佛、宛如" },
];

function toWordList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

function emptyTic(): TicPattern {
  return { pattern: "", name: "", threshold: 3, severity: "medium", description: "" };
}

// structural_tic_patterns 结构化编辑（原型 sub-block + sub-row.tics）：
// 首行 句式名/严重度/阈值/删除 + 正则 pattern（mono）+ 修复说明
function TicPatternEditor({ items, onChange }: { items: TicPattern[]; onChange: (v: TicPattern[]) => void }) {
  const update = (i: number, patch: Partial<TicPattern>) => {
    const n = [...items];
    n[i] = { ...(n[i] || emptyTic()), ...patch };
    onChange(n);
  };
  return (
    <div>
      {items.length === 0 && <p className="sub-empty">暂无句式规则 · 点下方添加</p>}
      {items.map((item, i) => (
        <div className="sub-block" key={i}>
          <div className="sub-row tics">
            <input
              className="input"
              value={item.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="句式名，如：不是而是句式"
            />
            <select
              className="input"
              value={item.severity}
              onChange={(e) => update(i, { severity: e.target.value })}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <input
              className="input num"
              type="number"
              min={1}
              value={item.threshold}
              onChange={(e) => update(i, { threshold: Number(e.target.value) || 1 })}
              title="单章出现次数阈值"
            />
            <button
              className="icon-btn"
              type="button"
              title="删除本条"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Ico d={P.trash} sw={1.7} />
            </button>
          </div>
          <input
            className="input mono"
            value={item.pattern}
            onChange={(e) => update(i, { pattern: e.target.value })}
            placeholder="正则 pattern，如：不是[^，。]{1,20}(而是|是)"
          />
          <input
            className="input"
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="修复说明（可选）：命中后如何改写"
          />
        </div>
      ))}
      <button className="text-btn" type="button" onClick={() => onChange([...items, emptyTic()])}>
        <Ico d={P.plus} sw={2} size={13} />
        添加句式规则
      </button>
    </div>
  );
}

const AntiAiSettingForm = forwardRef<SettingSaveHandle, Props>(function AntiAiSettingForm(
  { projectId, settingKey, onDirtyChange },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Record<string, any> | null>(null);
  const [fatigueWords, setFatigueWords] = useState<Record<string, string[]>>({});
  const [ticPatterns, setTicPatterns] = useState<TicPattern[]>([]);
  const currentShape = { fatigueWords, ticPatterns };
  const { snapshotLoaded, markSaved } = useDirtyState(currentShape, onDirtyChange);

  useEffect(() => {
    setLoading(true);
    api.get(`/novels/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) {
          // 空项目无 KV 行 → 以当前（初始）态为快照基线
          snapshotLoaded(currentShape);
          return;
        }
        setExisting(d);
        const fw: Record<string, string[]> = {};
        for (const cat of FATIGUE_CATEGORIES) {
          fw[cat.key] = toWordList(d.fatigue_words_zh?.[cat.key]);
        }
        const tics = (d.structural_tic_patterns || []).map((p: any) => ({
          pattern: p.pattern || "",
          name: p.name || "",
          threshold: typeof p.threshold === "number" ? p.threshold : 3,
          severity: p.severity || "medium",
          description: p.description || "",
        }));
        setFatigueWords(fw);
        setTicPatterns(tics);
        snapshotLoaded({ fatigueWords: fw, ticPatterns: tics });
      })
      .catch(() => {
        setError("加载失败");
        snapshotLoaded(currentShape);
      })
      .finally(() => setLoading(false));
  }, [projectId, settingKey, snapshotLoaded]);

  async function handleSave() {
    if (saving) return false;
    setSaving(true); setError("");
    try {
      // merge-on-save：只覆盖 fatigue_words_zh + structural_tic_patterns，
      // 保留模板其余键（sentence_rules flag dict / paragraph_rules / ...）
      const fw: Record<string, string[]> = {};
      for (const cat of FATIGUE_CATEGORIES) {
        fw[cat.key] = (fatigueWords[cat.key] || []).filter(Boolean);
      }
      const edited = {
        fatigue_words_zh: fw,
        structural_tic_patterns: ticPatterns.filter((p) => p.pattern.trim() !== ""),
      };
      await api.put(`/novels/${projectId}/settings/${settingKey}`, { ...existing, ...edited });
      markSaved();
      return true;
    } catch (e: any) { setError(e.message || "保存失败"); return false; }
    finally { setSaving(false); }
  }

  // gap3：完成设定前先把当前表单内容落库（恒保存，幂等）
  useImperativeHandle(ref, () => ({ save: handleSave }));

  if (loading) return <p className="opt">加载中…</p>;

  return (
    <div>
      <Cfg title="疲劳词" open>
        {FATIGUE_CATEGORIES.map((cat) => (
          <ListEditor
            key={cat.key}
            label={cat.label}
            hint={cat.hint}
            items={fatigueWords[cat.key]?.length ? fatigueWords[cat.key] : [""]}
            onChange={(v) => setFatigueWords((prev) => ({ ...prev, [cat.key]: v }))}
            placeholder={`添加该分类下的疲劳词，如：${cat.hint.split("、")[0]}`}
          />
        ))}
      </Cfg>
      <Cfg title="句式偏好" tag="可后补">
        <TicPatternEditor items={ticPatterns} onChange={setTicPatterns} />
      </Cfg>

      {error && <p className="opt" style={{ color: "var(--err)" }}>{error}</p>}
    </div>
  );
});
export default AntiAiSettingForm;
