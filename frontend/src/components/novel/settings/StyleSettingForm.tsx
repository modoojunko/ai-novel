import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, ListEditor, TabBar, SaveButton } from "./FormField";

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

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/settings/${settingKey}`)
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
      await api.put(`/projects/${projectId}/settings/${settingKey}`, {
        role,
        core_principles: principles.filter(Boolean),
        possible_mistakes: mistakes.filter(Boolean),
        depiction_techniques: techniques.filter(Boolean),
      });
    } catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "role" && (
        <Field label="叙事身份" hint="一句话描述叙事距离（近/全知）+ 叙事态度（中立/讽刺/共情）" value={role} onChange={setRole} />
      )}
      {tab === "principles" && <ListEditor items={principles} onChange={setPrinciples} placeholder='例如：每章"突然"不超过 3 次' />}
      {tab === "mistakes" && <ListEditor items={mistakes} onChange={setMistakes} placeholder='例如：过度使用"他皱了皱眉"类表情描写' />}
      {tab === "techniques" && <ListEditor items={techniques} onChange={setTechniques} placeholder="例如：情绪通过动作表现 — 紧张=抠指甲" />}

      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}
    </div>
  );
}
