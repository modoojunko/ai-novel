import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TabBar, SaveButton } from "./FormField";

interface Props { projectId: string; settingKey: string }

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

export default function HooksSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<any[]>([]);
  const [resolved, setResolved] = useState<any[]>([]);
  const [abandoned, setAbandoned] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) return;
        setActive(d.active || []);
        setResolved(d.resolved || []);
        setAbandoned(d.abandoned || []);
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
    setSaving(true); setError("");
    try { await api.put(`/projects/${projectId}/settings/${settingKey}`, { active, resolved, abandoned }); }
    catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "active" && <HookTable hooks={active} onChange={setActive} simple={false} />}
      {tab === "resolved" && <HookTable hooks={resolved} onChange={setResolved} simple={false} />}
      {tab === "abandoned" && <HookTable hooks={abandoned} onChange={setAbandoned} simple={true} />}

      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}
    </div>
  );
}

function HookTable({ hooks, onChange, simple }: { hooks: any[]; onChange: (v: any[]) => void; simple: boolean }) {
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
