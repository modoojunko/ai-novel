import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { InputField, TabBar, SaveButton } from "./FormField";

interface Props { projectId: string; settingKey: string }

const TABS = [
  { id: "blocklists", label: "疲劳词" },
  { id: "sentences", label: "句式规则" },
  { id: "rewrite", label: "改写算法" },
];

export default function AntiAiSettingForm({ projectId, settingKey }: Props) {
  const [tab, setTab] = useState("blocklists");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adverbs, setAdverbs] = useState("");
  const [verbs, setVerbs] = useState("");
  const [adjectives, setAdjectives] = useState("");
  const [connectors, setConnectors] = useState("");
  const [bodyRx, setBodyRx] = useState("");
  const [sentenceRules, setSentenceRules] = useState("");
  const [rewriteRules, setRewriteRules] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get(`/projects/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) return;
        setAdverbs((d.blocklists?.adverbs || []).join("、"));
        setVerbs((d.blocklists?.verbs || []).join("、"));
        setAdjectives((d.blocklists?.adjectives || []).join("、"));
        setConnectors((d.blocklists?.connectors || []).join("、"));
        setBodyRx((d.body_reactions || []).join("、"));
        setSentenceRules((d.sentence_rules || []).join("\n"));
        setRewriteRules((d.rewrite_rules || []).join("\n"));
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.put(`/projects/${projectId}/settings/${settingKey}`, {
        blocklists: {
          adverbs: split(adverbs), verbs: split(verbs), adjectives: split(adjectives), connectors: split(connectors),
        },
        body_reactions: split(bodyRx),
        sentence_rules: lines(sentenceRules),
        rewrite_rules: lines(rewriteRules),
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

      {tab === "blocklists" && (
        <div className="space-y-4">
          <InputField label="副词类" value={adverbs} onChange={setAdverbs} placeholder="用顿号分隔：突然、忽然、猛然" />
          <InputField label="动词类" value={verbs} onChange={setVerbs} placeholder="意识到、感到、觉得、注意到" />
          <InputField label="形容词类" value={adjectives} onChange={setAdjectives} placeholder="某种、某种程度、某种方式" />
          <InputField label="连接词类" value={connectors} onChange={setConnectors} placeholder="然而、不过、尽管如此、与此同时" />
          <InputField label="身体反应模板" value={bodyRx} onChange={setBodyRx} placeholder="倒吸一口凉气、瞳孔微缩、身体一僵" />
        </div>
      )}
      {tab === "sentences" && (
        <textarea className="w-full bg-base-200/40 border border-base-300/60 rounded-lg p-3.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 resize-y min-h-[200px] placeholder:text-base-content/20"
          value={sentenceRules} onChange={(e) => setSentenceRules(e.target.value)}
          placeholder='禁止"不是 X，而是 Y"句式&#10;禁止"身体部位 + 情绪动词"模板' />
      )}
      {tab === "rewrite" && (
        <textarea className="w-full bg-base-200/40 border border-base-300/60 rounded-lg p-3.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 resize-y min-h-[200px] placeholder:text-base-content/20"
          value={rewriteRules} onChange={(e) => setRewriteRules(e.target.value)}
          placeholder='感知词移除：删除"看到/听到"等引导词' />
      )}
      {error && <p className="text-sm text-error/80 mt-3">{error}</p>}
    </div>
  );
}

function split(s: string) { return s.split(/[、,，]/).map((s) => s.trim()).filter(Boolean); }
function lines(s: string) { return s.split("\n").map((s) => s.trim()).filter(Boolean); }
