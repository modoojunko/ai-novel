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

export default function StyleSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("role");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
        setRole(d.role || "");
        setPrinciples(d.core_principles?.length ? d.core_principles : [""]);
        setMistakes(d.possible_mistakes?.length ? d.possible_mistakes : [""]);
        setTechniques(d.depiction_techniques?.length ? d.depiction_techniques : [""]);
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.put(`/novels/${projectId}/settings/${settingKey}`, {
        role,
        core_principles: principles.filter(Boolean),
        possible_mistakes: mistakes.filter(Boolean),
        depiction_techniques: techniques.filter(Boolean),
      });
    } catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  async function handleAIGenerate(field: string, forceApi: boolean = false) {
    // If field has content already, show it directly (skip API call)
    const existing = !forceApi ? getCurrentFieldValue(field) : null;
    if (existing) {
      setAiField(field);
      setAiContent(typeof existing === "string" ? existing : JSON.stringify(existing, null, 2));
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
    if (field === "common_mistakes") return mistakes.length > 0 && mistakes[0] !== "" ? mistakes : null;
    if (field === "depiction_techniques") return techniques.length > 0 && techniques[0] !== "" ? techniques : null;
    return null;
  }

  function handleAIAccept() {
    if (!aiField) return;
    // Try JSON.parse first (AI may return a JSON array)
    let parsed: string | string[] = aiContent;
    try {
      const v = JSON.parse(aiContent);
      if (Array.isArray(v)) parsed = v;
    } catch {}

    if (aiField === "role") {
      setRole(aiContent);
    } else if (aiField === "core_principles") {
      setPrinciples(Array.isArray(parsed) ? parsed : aiContent.split("\n").filter(Boolean));
    } else if (aiField === "common_mistakes") {
      setMistakes(Array.isArray(parsed) ? parsed : aiContent.split("\n").filter(Boolean));
    } else if (aiField === "depiction_techniques") {
      setTechniques(Array.isArray(parsed) ? parsed : aiContent.split("\n").filter(Boolean));
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
          aiGeneratable aiLoading={aiPendingField === "common_mistakes"} onAIGenerate={() => handleAIGenerate("common_mistakes")} />
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
