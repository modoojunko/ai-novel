import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, ListEditor, TabBar, SaveButton } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";

interface Props { projectId: string; settingKey: string }

const TABS = [
  { id: "role", label: "叙事身份" },
  { id: "principles", label: "核心原则" },
  { id: "mistakes", label: "常见错误" },
  { id: "techniques", label: "描写技法" },
];

// 模板盘文件与前端保存存在 dict/list 双态（ADR-006）：core_principles 为分类
// dict 或 list；depiction_techniques 为 {name/description/example} 对象列表或
// 纯字符串列表。表单统一归一为可编辑的扁平字符串列表；保存走 merge-on-save，
// 只覆盖编辑过的字段，保留模板其余键（personality/workflow/...）。
function toFlatList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (v && typeof v === "object") {
    const out: string[] = [];
    for (const val of Object.values(v as Record<string, unknown>)) {
      if (Array.isArray(val)) out.push(...val.map(String));
    }
    return out.filter(Boolean);
  }
  return [];
}

function toTechniqueStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object") {
        const obj = t as { name?: string; description?: string };
        const name = obj.name || "";
        const desc = obj.description || "";
        if (name && desc) return `${name}：${desc}`;
        return name || desc;
      }
      return String(t);
    })
    .filter(Boolean);
}

export default function StyleSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("role");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Record<string, unknown> | null>(null);
  const [role, setRole] = useState("");
  const [principles, setPrinciples] = useState<string[]>([""]);
  const [mistakes, setMistakes] = useState<string[]>([""]);
  const [techniques, setTechniques] = useState<string[]>([""]);

  // AI modal state
  const [aiField, setAiField] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPendingField, setAiPendingField] = useState<string | null>(null);

  const currentValues = { role, core_principles: principles, possible_mistakes: mistakes, depiction_techniques: techniques };

  useEffect(() => {
    setLoading(true);
    api.get(`/novels/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) return;
        setExisting(d);
        const p = toFlatList(d.core_principles);
        const m = toFlatList(d.possible_mistakes);
        const t = toTechniqueStrings(d.depiction_techniques);
        setRole(d.role || "");
        setPrinciples(p.length ? p : [""]);
        setMistakes(m.length ? m : [""]);
        setTechniques(t.length ? t : [""]);
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      // merge-on-save：只覆盖表单编辑的字段，保留模板其余键不被整表替换冲掉
      const edited = {
        role,
        core_principles: principles.filter(Boolean),
        possible_mistakes: mistakes.filter(Boolean),
        depiction_techniques: techniques.filter(Boolean),
      };
      await api.put(`/novels/${projectId}/settings/${settingKey}`, { ...existing, ...edited });
    } catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  async function handleAIGenerate(field: string, forceApi: boolean = false) {
    // If field has content already, show it directly (skip API call)
    const existingField = !forceApi ? getCurrentFieldValue(field) : null;
    if (existingField) {
      setAiField(field);
      setAiContent(typeof existingField === "string" ? existingField : JSON.stringify(existingField, null, 2));
      return;
    }
    setAiPendingField(field);
    setAiLoading(true);
    setAiField(field);
    setAiContent("");
    try {
      const res = await api.post(`/novels/${projectId}/settings/ai/style/${field}`, {
        context: currentValues,
      });
      setAiContent(typeof res.value === "string" ? res.value : JSON.stringify(res.value, null, 2));
    } catch (e: any) {
      setAiContent(`生成失败：${e.message}`);
    } finally {
      setAiLoading(false);
      setAiPendingField(null);
    }
  }

  function getCurrentFieldValue(field: string): string | string[] | null {
    if (field === "role") return role || null;
    if (field === "core_principles") return principles.length > 0 && principles[0] !== "" ? principles : null;
    if (field === "possible_mistakes") return mistakes.length > 0 && mistakes[0] !== "" ? mistakes : null;
    if (field === "depiction_techniques") return techniques.length > 0 && techniques[0] !== "" ? techniques : null;
    return null;
  }

  function handleAIAccept() {
    if (!aiField) return;
    // Try JSON.parse first (AI may return a JSON array)
    let parsed: any = aiContent;
    try {
      const v = JSON.parse(aiContent);
      if (Array.isArray(v)) parsed = v;
    } catch {}

    if (aiField === "role") {
      setRole(aiContent);
    } else if (aiField === "core_principles") {
      setPrinciples(Array.isArray(parsed) ? parsed.map(String) : aiContent.split("\n").filter(Boolean));
    } else if (aiField === "possible_mistakes") {
      setMistakes(Array.isArray(parsed) ? parsed.map(String) : aiContent.split("\n").filter(Boolean));
    } else if (aiField === "depiction_techniques") {
      setTechniques(Array.isArray(parsed) ? toTechniqueStrings(parsed) : aiContent.split("\n").filter(Boolean));
    }
    setAiField(null);
    setAiContent("");
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "role" && (
        <Field label="叙事身份" hint="一句话描述叙事距离（近/全知）+ 叙事态度（中立/讽刺/共情）" value={role} onChange={setRole}
          aiGeneratable aiLoading={aiPendingField === "role"} onAIGenerate={() => handleAIGenerate("role")} />
      )}
      {tab === "principles" && (
        <ListEditor items={principles} onChange={setPrinciples} placeholder='例如：每章"突然"不超过 3 次'
          aiGeneratable aiLoading={aiPendingField === "core_principles"} onAIGenerate={() => handleAIGenerate("core_principles")} />
      )}
      {tab === "mistakes" && (
        <ListEditor items={mistakes} onChange={setMistakes} placeholder='例如：过度使用"他皱了皱眉"类表情描写'
          aiGeneratable aiLoading={aiPendingField === "possible_mistakes"} onAIGenerate={() => handleAIGenerate("possible_mistakes")} />
      )}
      {tab === "techniques" && (
        <ListEditor items={techniques} onChange={setTechniques} placeholder="例如：情绪通过动作表现 — 紧张=抠指甲"
          aiGeneratable aiLoading={aiPendingField === "depiction_techniques"} onAIGenerate={() => handleAIGenerate("depiction_techniques")} />
      )}

      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}

      <AISuggestionModal
        open={aiField !== null}
        fieldLabel={aiField || ""}
        content={aiContent}
        loading={aiLoading}
        onAccept={handleAIAccept}
        onRetry={() => aiField && handleAIGenerate(aiField, true)}
        onClose={() => { setAiField(null); setAiContent(""); }}
      />
    </div>
  );
}
