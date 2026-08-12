import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import { Field, ListEditor, SaveButton, SettingSaveHandle, TabBar } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";

interface Props {
  projectId: string;
  settingKey: string;
  /** P2-1：脏状态回调（未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

const TABS = [
  { id: "role", label: "叙事身份" },
  { id: "principles", label: "核心原则" },
  { id: "mistakes", label: "常见错误" },
  { id: "techniques", label: "描写技法" },
  { id: "tone", label: "叙事基调" },
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
  // 非空字符串（AI 生成/存量单值）视为单元素列表，避免编辑时被丢弃
  if (typeof v === "string" && v.trim()) return [v];
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

const StyleSettingForm = forwardRef<SettingSaveHandle, Props>(function StyleSettingForm(
  { projectId, settingKey, onDirtyChange },
  ref,
) {
  const [tab, setTab] = useState("role");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<Record<string, unknown> | null>(null);
  const [role, setRole] = useState("");
  const [principles, setPrinciples] = useState<string[]>([""]);
  const [mistakes, setMistakes] = useState<string[]>([""]);
  const [techniques, setTechniques] = useState<string[]>([""]);
  // 叙事基调（ADR-007）：narrator_role + tone{default_tone, atmosphere, pov, techniques}
  const [narratorRole, setNarratorRole] = useState("");
  const [defaultTone, setDefaultTone] = useState("");
  const [atmosphere, setAtmosphere] = useState<string[]>([""]);
  const [pov, setPov] = useState<string[]>([""]);
  const [toneTechniques, setToneTechniques] = useState<string[]>([""]);

  // AI modal state
  const [aiField, setAiField] = useState<string | null>(null);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPendingField, setAiPendingField] = useState<string | null>(null);

  const currentValues = { role, core_principles: principles, possible_mistakes: mistakes, depiction_techniques: techniques };
  const currentShape = { role, principles, mistakes, techniques, narratorRole, defaultTone, atmosphere, pov, toneTechniques };
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
        setExisting(d);
        const p = toFlatList(d.core_principles);
        const m = toFlatList(d.possible_mistakes);
        const t = toTechniqueStrings(d.depiction_techniques);
        const tone = d.tone && typeof d.tone === "object" ? (d.tone as Record<string, unknown>) : {};
        const a = toFlatList(tone.atmosphere);
        const v = toFlatList(tone.pov);
        const tt = toFlatList(tone.techniques);
        const roleN = d.role || "";
        const principlesN = p.length ? p : [""];
        const mistakesN = m.length ? m : [""];
        const techniquesN = t.length ? t : [""];
        const narratorN = d.narrator_role || "";
        const defaultToneN = (tone.default_tone as string) || "";
        const atmosphereN = a.length ? a : [""];
        const povN = v.length ? v : [""];
        const toneTechniquesN = tt.length ? tt : [""];
        setRole(roleN);
        setPrinciples(principlesN);
        setMistakes(mistakesN);
        setTechniques(techniquesN);
        setNarratorRole(narratorN);
        setDefaultTone(defaultToneN);
        setAtmosphere(atmosphereN);
        setPov(povN);
        setToneTechniques(toneTechniquesN);
        snapshotLoaded({ role: roleN, principles: principlesN, mistakes: mistakesN, techniques: techniquesN, narratorRole: narratorN, defaultTone: defaultToneN, atmosphere: atmosphereN, pov: povN, toneTechniques: toneTechniquesN });
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
      // merge-on-save：只覆盖表单编辑的字段，保留模板其余键不被整表替换冲掉
      const edited = {
        role,
        core_principles: principles.filter(Boolean),
        possible_mistakes: mistakes.filter(Boolean),
        depiction_techniques: techniques.filter(Boolean),
        narrator_role: narratorRole,
        // tone 子键逐项合并，保留既有 tone 里的其他键（若有）
        tone: {
          ...(existing?.tone as Record<string, unknown> | undefined),
          default_tone: defaultTone,
          atmosphere: atmosphere.filter(Boolean),
          pov: pov.filter(Boolean),
          techniques: toneTechniques.filter(Boolean),
        },
      };
      await api.put(`/novels/${projectId}/settings/${settingKey}`, { ...existing, ...edited });
      markSaved();
      return true;
    } catch (e: any) { setError(e.message || "保存失败"); return false; }
    finally { setSaving(false); }
  }

  // gap3：完成设定前先把当前表单内容落库（恒保存，幂等）
  useImperativeHandle(ref, () => ({ save: handleSave }));

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
      {tab === "tone" && (
        <div className="space-y-4">
          <Field label="叙事者角色" hint="如：第三人称有限视角叙述者；留空则不注入叙事者定位" value={narratorRole} onChange={setNarratorRole} />
          <Field label="默认基调" hint="整部作品的整体语气/口吻，如：克制冷静、情绪靠细节外化" value={defaultTone} onChange={setDefaultTone} />
          <ListEditor items={atmosphere} onChange={setAtmosphere} placeholder='氛围关键词，如："压抑"' />
          <ListEditor items={pov} onChange={setPov} placeholder='叙事视角，如："第三人称有限视角"' />
          <ListEditor items={toneTechniques} onChange={setToneTechniques} placeholder="描写技法偏好，如：动作外化情绪" />
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
export default StyleSettingForm;
