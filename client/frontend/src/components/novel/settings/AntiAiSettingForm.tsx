import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListEditor, TabBar, SaveButton } from "./FormField";

interface Props { projectId: string; settingKey: string }

interface TicPattern {
  pattern: string;
  name: string;
  threshold: number;
  severity: string;
  description: string;
}

const TABS = [
  { id: "fatigue", label: "疲劳词" },
  { id: "patterns", label: "句式偏好" },
  { id: "rewrite", label: "改写算法" },
];

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

function formatRewriteRules(rules: unknown): string {
  if (!rules || typeof rules !== "object") return "";
  const lines: string[] = [];
  for (const [key, val] of Object.entries(rules as Record<string, any>)) {
    if (val && typeof val === "object") {
      lines.push(`【${key}】`);
      if (val.description) lines.push(val.description);
      if (val.example_before) lines.push(`前：${val.example_before}`);
      if (val.example_after) lines.push(`后：${val.example_after}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

// structural_tic_patterns 结构化编辑：pattern（正则）/ name / threshold / severity / description
function TicPatternEditor({ items, onChange }: { items: TicPattern[]; onChange: (v: TicPattern[]) => void }) {
  const update = (i: number, patch: Partial<TicPattern>) => {
    const n = [...items];
    n[i] = { ...(n[i] || emptyTic()), ...patch };
    onChange(n);
  };
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-xs text-base-content/40">暂无句式规则。点击下方添加。</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="group border border-base-300/60 rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
              value={item.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="句式名，如：不是而是句式"
            />
            <select
              className="bg-base-200/40 border border-base-300/60 rounded-lg px-2 py-2 text-sm outline-none focus:border-primary/40 text-base-content/70"
              value={item.severity}
              onChange={(e) => update(i, { severity: e.target.value })}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <input
              type="number" min={1}
              className="w-16 bg-base-200/40 border border-base-300/60 rounded-lg px-2 py-2 text-sm outline-none focus:border-primary/40 text-center text-base-content/70"
              value={item.threshold}
              onChange={(e) => update(i, { threshold: Number(e.target.value) || 1 })}
              title="单章出现次数阈值"
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1"
            >✕</button>
          </div>
          <input
            className="w-full font-mono text-xs bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
            value={item.pattern}
            onChange={(e) => update(i, { pattern: e.target.value })}
            placeholder="正则 pattern，如：不是[^，。]{1,20}(而是|是)"
          />
          <input
            className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
            value={item.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="修复说明（可选）：命中后如何改写"
          />
        </div>
      ))}
      <button
        onClick={() => onChange([...items, emptyTic()])}
        className="text-xs text-primary/60 hover:text-primary transition-colors mt-1 inline-flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span> 添加句式规则
      </button>
    </div>
  );
}

export default function AntiAiSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("fatigue");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Record<string, any> | null>(null);
  const [fatigueWords, setFatigueWords] = useState<Record<string, string[]>>({});
  const [ticPatterns, setTicPatterns] = useState<TicPattern[]>([]);
  const [rewriteDisplay, setRewriteDisplay] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get(`/novels/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) return;
        setExisting(d);
        const fw: Record<string, string[]> = {};
        for (const cat of FATIGUE_CATEGORIES) {
          fw[cat.key] = toWordList(d.fatigue_words_zh?.[cat.key]);
        }
        setFatigueWords(fw);
        setTicPatterns((d.structural_tic_patterns || []).map((p: any) => ({
          pattern: p.pattern || "",
          name: p.name || "",
          threshold: typeof p.threshold === "number" ? p.threshold : 3,
          severity: p.severity || "medium",
          description: p.description || "",
        })));
        setRewriteDisplay(formatRewriteRules(d.rewrite_rules));
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
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
    } catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "fatigue" && (
        <div className="space-y-5">
          {FATIGUE_CATEGORIES.map((cat) => (
            <div key={cat.key}>
              <p className="text-xs text-base-content/60 font-medium mb-1.5">
                {cat.label} <span className="text-base-content/30">（{cat.hint}）</span>
              </p>
              <ListEditor
                items={fatigueWords[cat.key]?.length ? fatigueWords[cat.key] : [""]}
                onChange={(v) => setFatigueWords((prev) => ({ ...prev, [cat.key]: v }))}
                placeholder={`添加该分类下的疲劳词，如：${cat.hint.split("、")[0]}`}
              />
            </div>
          ))}
        </div>
      )}
      {tab === "patterns" && (
        <TicPatternEditor items={ticPatterns} onChange={setTicPatterns} />
      )}
      {tab === "rewrite" && (
        <pre className="whitespace-pre-wrap text-sm text-base-content/70 bg-base-200/40 border border-base-300/60 rounded-lg p-3.5 leading-relaxed">
          {rewriteDisplay || "暂无改写算法（只读，AI 味修正由模型在生成阶段处理）"}
        </pre>
      )}

      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}
    </div>
  );
}
