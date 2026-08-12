import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import { Field, SaveButton, SettingSaveHandle, TabBar } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";

interface Props {
  projectId: string;
  settingKey: string;
  /** P2-1：脏状态回调（未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

const TABS = [
  { id: "geo", label: "地理" },
  { id: "politics", label: "政治" },
  { id: "rules", label: "规则" },
];

const WorldSettingForm = forwardRef<SettingSaveHandle, Props>(function WorldSettingForm(
  { projectId, settingKey, onDirtyChange },
  ref,
) {
  const [tab, setTab] = useState("geo");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [geo, setGeo] = useState({ scenes: "", climate: "", limits: "" });
  const [politics, setPolitics] = useState({ rule: "", factions: "", social: "", cost: "" });
  const [rules, setRules] = useState({ world: "", society: "", personal: "" });

  // AI modal state
  const [aiField, setAiField] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPendingField, setAiPendingField] = useState<string | null>(null);

  const currentValues = { geography: geo, politics, rules };
  const { snapshotLoaded, markSaved } = useDirtyState(currentValues, onDirtyChange);

  useEffect(() => {
    setLoading(true);
    api.get(`/novels/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) {
          // 空项目无 KV 行 → 以当前（初始）态为快照基线
          snapshotLoaded(currentValues);
          return;
        }
        const geoN = { scenes: d.geography?.scenes || "", climate: d.geography?.climate || "", limits: d.geography?.limits || "" };
        const polN = { rule: d.politics?.rule || "", factions: d.politics?.factions || "", social: d.politics?.social || "", cost: d.politics?.cost || "" };
        const rulN = { world: d.rules?.world || "", society: d.rules?.society || "", personal: d.rules?.personal || "" };
        setGeo(geoN);
        setPolitics(polN);
        setRules(rulN);
        snapshotLoaded({ geography: geoN, politics: polN, rules: rulN });
      })
      .catch(() => {
        setError("加载失败");
        snapshotLoaded(currentValues);
      })
      .finally(() => setLoading(false));
  }, [projectId, settingKey, snapshotLoaded]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.put(`/novels/${projectId}/settings/${settingKey}`, { geography: geo, politics, rules });
      markSaved();
      return true;
    }
    catch (e: any) { setError(e.message || "保存失败"); return false; }
    finally { setSaving(false); }
  }

  // gap3：SettingsFormField 经 ref 调 save()，完成设定前先把当前表单内容落库（恒保存，幂等）
  useImperativeHandle(ref, () => ({ save: handleSave }));

  function getFieldValue(fieldName: string): string {
    return (geo as any)[fieldName] ?? (politics as any)[fieldName] ?? (rules as any)[fieldName] ?? "";
  }

  function setFieldValue(fieldName: string, value: string) {
    if (fieldName in geo) setGeo((p) => ({ ...p, [fieldName]: value }));
    else if (fieldName in politics) setPolitics((p) => ({ ...p, [fieldName]: value }));
    else if (fieldName in rules) setRules((p) => ({ ...p, [fieldName]: value }));
  }

  async function handleAIGenerate(field: string, forceApi: boolean = false) {
    // If field has content already, show it directly (skip API call)
    const existing = !forceApi ? getFieldValue(field) : '';
    if (existing && existing.trim()) {
      setAiField(field);
      setAiContent(existing);
      return;
    }
    setAiPendingField(field);
    setAiLoading(true);
    setAiField(field);
    setAiContent("");
    try {
      const res = await api.post(`/novels/${projectId}/settings/ai/world/${field}`, {
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

  function handleAIAccept() {
    if (!aiField) return;
    setFieldValue(aiField, aiContent);
    setAiField(null);
    setAiContent("");
  }

  if (loading) return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-md text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab}>
        <SaveButton saving={saving} onClick={handleSave} />
      </TabBar>

      {tab === "geo" && (
        <div className="space-y-5">
          <Field label="主要场景" hint="关键地点、空间关系、距离" value={geo.scenes} onChange={(v) => setGeo((p) => ({ ...p, scenes: v }))}
            aiGeneratable aiLoading={aiPendingField === "scenes"} onAIGenerate={() => handleAIGenerate("scenes")} />
          <Field label="气候" hint="气候特征、季节、极端天气" value={geo.climate} onChange={(v) => setGeo((p) => ({ ...p, climate: v }))}
            aiGeneratable aiLoading={aiPendingField === "climate"} onAIGenerate={() => handleAIGenerate("climate")} />
          <Field label="地理限制" hint="山脉、水域、边界" value={geo.limits} onChange={(v) => setGeo((p) => ({ ...p, limits: v }))}
            aiGeneratable aiLoading={aiPendingField === "limits"} onAIGenerate={() => handleAIGenerate("limits")} />
        </div>
      )}
      {tab === "politics" && (
        <div className="space-y-5">
          <Field label="统治形式" hint="谁统治？" value={politics.rule} onChange={(v) => setPolitics((p) => ({ ...p, rule: v }))}
            aiGeneratable aiLoading={aiPendingField === "rule"} onAIGenerate={() => handleAIGenerate("rule")} />
          <Field label="主要势力" hint="至少 2-3 个势力" value={politics.factions} onChange={(v) => setPolitics((p) => ({ ...p, factions: v }))}
            aiGeneratable aiLoading={aiPendingField === "factions"} onAIGenerate={() => handleAIGenerate("factions")} />
          <Field label="社会分层" hint="阶级结构" value={politics.social} onChange={(v) => setPolitics((p) => ({ ...p, social: v }))}
            aiGeneratable aiLoading={aiPendingField === "social"} onAIGenerate={() => handleAIGenerate("social")} />
          <Field label="不服从的代价" hint="违抗的后果" value={politics.cost} onChange={(v) => setPolitics((p) => ({ ...p, cost: v }))}
            aiGeneratable aiLoading={aiPendingField === "cost"} onAIGenerate={() => handleAIGenerate("cost")} />
        </div>
      )}
      {tab === "rules" && (
        <div className="space-y-5">
          <Field label="世界级规则" hint="力量体系" value={rules.world} onChange={(v) => setRules((p) => ({ ...p, world: v }))}
            aiGeneratable aiLoading={aiPendingField === "world"} onAIGenerate={() => handleAIGenerate("world")} />
          <Field label="社会级规则" hint="法律、禁忌" value={rules.society} onChange={(v) => setRules((p) => ({ ...p, society: v }))}
            aiGeneratable aiLoading={aiPendingField === "society"} onAIGenerate={() => handleAIGenerate("society")} />
          <Field label="个人级规则" hint="血咒、功法限制" value={rules.personal} onChange={(v) => setRules((p) => ({ ...p, personal: v }))}
            aiGeneratable aiLoading={aiPendingField === "personal"} onAIGenerate={() => handleAIGenerate("personal")} />
        </div>
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
});
export default WorldSettingForm;
