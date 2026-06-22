import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Field, TabBar, SaveButton } from "./FormField";

interface Props { projectId: string; settingKey: string }

const TABS = [
  { id: "geo", label: "地理" },
  { id: "politics", label: "政治" },
  { id: "rules", label: "规则" },
];

export default function WorldSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("geo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState({ scenes: "", climate: "", limits: "" });
  const [politics, setPolitics] = useState({ rule: "", factions: "", social: "", cost: "" });
  const [rules, setRules] = useState({ world: "", society: "", personal: "" });

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) return;
        setGeo({ scenes: d.geography?.scenes || "", climate: d.geography?.climate || "", limits: d.geography?.limits || "" });
        setPolitics({ rule: d.politics?.rule || "", factions: d.politics?.factions || "", social: d.politics?.social || "", cost: d.politics?.cost || "" });
        setRules({ world: d.rules?.world || "", society: d.rules?.society || "", personal: d.rules?.personal || "" });
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
    setSaving(true); setError("");
    try { await api.put(`/projects/${projectId}/settings/${settingKey}`, { geography: geo, politics, rules }); }
    catch (e: any) { setError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "geo" && (
        <div className="space-y-5">
          <Field label="主要场景" hint="关键地点、空间关系、距离" value={geo.scenes} onChange={(v) => setGeo((p) => ({ ...p, scenes: v }))} />
          <Field label="气候" hint="气候特征、季节、极端天气" value={geo.climate} onChange={(v) => setGeo((p) => ({ ...p, climate: v }))} />
          <Field label="地理限制" hint="山脉、水域、边界 — 什么分隔了区域" value={geo.limits} onChange={(v) => setGeo((p) => ({ ...p, limits: v }))} />
        </div>
      )}
      {tab === "politics" && (
        <div className="space-y-5">
          <Field label="统治形式" hint="谁统治？中央/联邦/宗派？权力是否受限？" value={politics.rule} onChange={(v) => setPolitics((p) => ({ ...p, rule: v }))} />
          <Field label="主要势力" hint="至少 2-3 个势力" value={politics.factions} onChange={(v) => setPolitics((p) => ({ ...p, factions: v }))} />
          <Field label="社会分层" hint="阶级结构、流动性" value={politics.social} onChange={(v) => setPolitics((p) => ({ ...p, social: v }))} />
          <Field label="不服从的代价" hint="违抗的后果，谁执行惩罚" value={politics.cost} onChange={(v) => setPolitics((p) => ({ ...p, cost: v }))} />
        </div>
      )}
      {tab === "rules" && (
        <div className="space-y-5">
          <Field label="世界级规则" hint="力量体系、物理法则、魔法来源" value={rules.world} onChange={(v) => setRules((p) => ({ ...p, world: v }))} />
          <Field label="社会级规则" hint="法律、门派规章、禁忌" value={rules.society} onChange={(v) => setRules((p) => ({ ...p, society: v }))} />
          <Field label="个人级规则" hint="血咒、功法限制、契约" value={rules.personal} onChange={(v) => setRules((p) => ({ ...p, personal: v }))} />
        </div>
      )}
      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}
    </div>
  );
}
