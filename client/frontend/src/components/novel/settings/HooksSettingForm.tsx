import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import { Cfg, SettingSaveHandle } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";
import { Ico, P } from "@/components/icons";

interface Props {
  projectId: string;
  settingKey: string;
  /** P2-1：脏状态回调（未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

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
    if (saving) return false;
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

  if (loading) return <p className="opt">加载中…</p>;

  return (
    <div>
      <Cfg title="活跃伏笔" open>
        <HookTable hooks={active} onChange={setActive} simple={false}
          onAIGenerate={(i) => handleAIGenerate("active", i)}
          isAiLoading={(i) => aiPendingField === `active-${i}`} />
      </Cfg>
      <Cfg title="已收束">
        <HookTable hooks={resolved} onChange={setResolved} simple={false}
          onAIGenerate={(i) => handleAIGenerate("resolved", i)}
          isAiLoading={(i) => aiPendingField === `resolved-${i}`} />
      </Cfg>
      <Cfg title="废弃" tag="可后补">
        <HookTable hooks={abandoned} onChange={setAbandoned} simple={true}
          onAIGenerate={(i) => handleAIGenerate("abandoned", i)}
          isAiLoading={(i) => aiPendingField === `abandoned-${i}`} />
      </Cfg>

      {error && <p className="opt" style={{ color: "var(--err)" }}>{error}</p>}

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
  return (
    <div>
      {hooks.length === 0 && <p className="sub-empty">暂无</p>}
      {hooks.map((h, i) => (
        <div className="hook-row" key={i}>
          <button
            className="icon-btn"
            type="button"
            title="AI 帮我填"
            onClick={() => onAIGenerate!(i)}
            disabled={isAiLoading?.(i) ?? false}
          >
            <Ico d={P.spark} sw={1.8} />
          </button>
          <input
            className="input desc"
            placeholder="伏笔描述"
            value={h.description || ""}
            onChange={(e) => update(hooks, onChange, i, "description", e.target.value)}
          />
          {!simple && (
            <>
              <input
                className="input in-ch"
                placeholder="引入"
                value={h.introduced_in || ""}
                onChange={(e) => update(hooks, onChange, i, "introduced_in", e.target.value)}
              />
              <select
                className="input sel-type"
                value={h.type || "mystery"}
                onChange={(e) => update(hooks, onChange, i, "type", e.target.value)}
              >
                {HOOK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select
                className="input sel-pri"
                value={h.priority || "2"}
                onChange={(e) => update(hooks, onChange, i, "priority", e.target.value)}
              >
                <option value="1">高</option><option value="2">中</option><option value="3">低</option>
              </select>
            </>
          )}
          <button
            className="icon-btn"
            type="button"
            title="删除"
            onClick={() => onChange(hooks.filter((_, j) => j !== i))}
          >
            <Ico d={P.trash} sw={1.7} />
          </button>
        </div>
      ))}
      <button
        className="text-btn"
        type="button"
        onClick={() => onChange([...hooks, { description: "", introduced_in: "", type: "mystery", priority: "2" }])}
      >
        <Ico d={P.plus} sw={2} size={13} />
        添加伏笔
      </button>
    </div>
  );
}

function update(arr: any[], set: (v: any[]) => void, i: number, field: string, value: string) {
  const n = [...arr];
  n[i] = { ...n[i], [field]: value };
  set(n);
}
