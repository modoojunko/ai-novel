import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import { SaveButton, SettingSaveHandle, TabBar } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  projectId: string;
  settingKey: string;
  /** P2-1：脏状态回调（未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

const TABS = [
  { id: "active", label: "活跃伏笔" },
  { id: "resolved", label: "已收束" },
  { id: "abandoned", label: "废弃" },
];

const HOOK_TYPES = [
  { value: "mystery", label: "谜团" }, { value: "threat", label: "威胁" },
  { value: "promise", label: "承诺" }, { value: "clue", label: "线索" },
  { value: "relationship", label: "关系" }, { value: "power", label: "力量" },
  { value: "emotion", label: "情感" }, { value: "choice", label: "选择" }, { value: "desire", label: "欲望" },
];

const HooksSettingForm = forwardRef<SettingSaveHandle, Props>(function HooksSettingForm(
  { projectId, settingKey, onDirtyChange },
  ref,
) {
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<any[]>([]);
  const [resolved, setResolved] = useState<any[]>([]);
  const [abandoned, setAbandoned] = useState<any[]>([]);

  // AI modal state
  const [aiField, setAiField] = useState<string | null>(null);
  const [aiFieldLabel, setAiFieldLabel] = useState("");
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPendingField, setAiPendingField] = useState<string | null>(null);

  const currentShape = { active, resolved, abandoned };
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
        const activeN = d.active || [];
        const resolvedN = d.resolved || [];
        const abandonedN = d.abandoned || [];
        setActive(activeN);
        setResolved(resolvedN);
        setAbandoned(abandonedN);
        snapshotLoaded({ active: activeN, resolved: resolvedN, abandoned: abandonedN });
      })
      .catch(() => {
        setError("加载失败");
        snapshotLoaded(currentShape);
      })
      .finally(() => setLoading(false));
  }, [projectId, settingKey, snapshotLoaded]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.put(`/novels/${projectId}/settings/${settingKey}`, { active, resolved, abandoned });
      markSaved();
      return true;
    }
    catch (e: any) { setError(e.message || "保存失败"); return false; }
    finally { setSaving(false); }
  }

  // gap3：完成设定前先把当前表单内容落库（恒保存，幂等）
  useImperativeHandle(ref, () => ({ save: handleSave }));

  async function handleAIGenerate(tabName: string, hookIndex: number) {
    const fieldKey = `${tabName}-${hookIndex}`;
    setAiPendingField(fieldKey);
    setAiLoading(true);
    setAiField(fieldKey);
    setAiFieldLabel("伏笔描述");
    setAiContent("");
    try {
      const hooks = tabName === "active" ? active : tabName === "resolved" ? resolved : abandoned;
      const res = await api.post(`/novels/${projectId}/settings/ai/hooks/description`, {
        context: { hooks, index: hookIndex, current: hooks[hookIndex] },
      });
      setAiContent(typeof res.value === "string" ? res.value : JSON.stringify(res.value, null, 2));
    } catch (e: any) {
      setAiContent(`生成失败：${e.message}`);
    } finally {
      setAiLoading(false);
      setAiPendingField(null);
    }
  }

  function handleAIAccept() {
    if (!aiField) return;
    const parts = aiField.split("-");
    const tabName = parts[0];
    const index = parseInt(parts[1], 10);
    const updater = (hooks: any[]) => {
      const n = [...hooks];
      n[index] = { ...n[index], description: aiContent };
      return n;
    };
    if (tabName === "active") setActive(updater(active));
    else if (tabName === "resolved") setResolved(updater(resolved));
    else setAbandoned(updater(abandoned));
    setAiField(null);
    setAiContent("");
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "active" && (
        <HookTable hooks={active} onChange={setActive} simple={false}
          onAIGenerate={(i) => handleAIGenerate("active", i)}
          isAiLoading={(i) => aiPendingField === `active-${i}`} />
      )}
      {tab === "resolved" && (
        <HookTable hooks={resolved} onChange={setResolved} simple={false}
          onAIGenerate={(i) => handleAIGenerate("resolved", i)}
          isAiLoading={(i) => aiPendingField === `resolved-${i}`} />
      )}
      {tab === "abandoned" && (
        <HookTable hooks={abandoned} onChange={setAbandoned} simple={true}
          onAIGenerate={(i) => handleAIGenerate("abandoned", i)}
          isAiLoading={(i) => aiPendingField === `abandoned-${i}`} />
      )}

      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}

      <AISuggestionModal
        open={aiField !== null}
        fieldLabel={aiFieldLabel}
        content={aiContent}
        loading={aiLoading}
        onAccept={handleAIAccept}
        onRetry={() => {
          if (aiField) {
            const parts = aiField.split("-");
            handleAIGenerate(parts[0], parseInt(parts[1], 10));
          }
        }}
        onClose={() => { setAiField(null); setAiContent(""); }}
      />
    </div>
  );
});

export default HooksSettingForm;

function HookTable({ hooks, onChange, simple, onAIGenerate, isAiLoading }: {
  hooks: any[]; onChange: (v: any[]) => void; simple: boolean;
  onAIGenerate?: (i: number) => void;
  isAiLoading?: (i: number) => boolean;
}) {
  const showAI = !!onAIGenerate;

  return (
    <div>
      <button onClick={() => onChange([...hooks, { description: "", introduced_in: "", type: "mystery", priority: "2" }])}
        className="mb-3 text-xs text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-1">
        <span className="text-base leading-none">+</span> 添加伏笔
      </button>
      {hooks.length === 0 ? (
        <p className="text-xs text-base-content/20 text-center py-10">暂无</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h, i) => (
            <div key={i} className="flex items-center gap-2 group bg-base-200/20 rounded-lg px-3 py-2">
              {showAI && (
                <button
                  onClick={() => onAIGenerate!(i)}
                  disabled={isAiLoading?.(i) ?? false}
                  className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
                  title="AI 帮我填"
                >
                  {isAiLoading?.(i) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                </button>
              )}
              <input className="flex-1 bg-transparent border border-base-300/50 rounded-lg px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary/40 placeholder:text-base-content/20"
                placeholder="伏笔描述" value={h.description || ""}
                onChange={(e) => update(hooks, onChange, i, "description", e.target.value)} />
              {!simple && (
                <>
                  <input className="w-20 bg-transparent border border-base-300/50 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors focus:border-primary/40 placeholder:text-base-content/20"
                    placeholder="引入" value={h.introduced_in || ""}
                    onChange={(e) => update(hooks, onChange, i, "introduced_in", e.target.value)} />
                  <select className="bg-base-200/60 border border-base-300/50 rounded-lg px-2 py-1.5 text-sm outline-none"
                    value={h.type || "mystery"} onChange={(e) => update(hooks, onChange, i, "type", e.target.value)}>
                    {HOOK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <select className="bg-base-200/60 border border-base-300/50 rounded-lg px-2 py-1.5 text-sm outline-none"
                    value={h.priority || "2"} onChange={(e) => update(hooks, onChange, i, "priority", e.target.value)}>
                    <option value="1">高</option><option value="2">中</option><option value="3">低</option>
                  </select>
                </>
              )}
              <button onClick={() => onChange(hooks.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function update(arr: any[], set: (v: any[]) => void, i: number, field: string, value: string) {
  const n = [...arr];
  n[i] = { ...n[i], [field]: value };
  set(n);
}
