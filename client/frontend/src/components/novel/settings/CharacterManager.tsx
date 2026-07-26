import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import CharacterCreateModal from "./CharacterCreateModal";
import ConfirmToggle from "./ConfirmToggle";
import DeleteConfirmModal from "../DeleteConfirmModal";
import { Field, TabBar } from "./FormField";

interface Props { projectId: string; confirmed?: boolean; onConfirm?: () => void }

interface CharData {
  name: string;
  role: string;
  appearance: string;
  background: string;
  speech: string;
  world_view: string;
  self_image: string;
  values: string;
  abilities: string;
  skills: string;
  environment: string;
  possessions: string;
  relationships: string;
  experiences: string;
}

function emptyChar(name = ""): CharData {
  return { name, role: "supporting", appearance: "", background: "", speech: "", world_view: "", self_image: "", values: "", abilities: "", skills: "", environment: "", possessions: "", relationships: "", experiences: "" };
}

export default function CharacterManager({ projectId, confirmed, onConfirm }: Props) {
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [char, setChar] = useState<CharData>(emptyChar());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [charTab, setCharTab] = useState("basic");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [charError, setCharError] = useState("");

  const loadNames = () => {
    api.get(`/projects/${projectId}/settings/characters/list`).then(setNames).catch(() => {});
  };

  useEffect(() => { setLoading(true); loadNames(); setLoading(false); }, [projectId]);

  async function loadCharacter(name: string) {
    setCharError("");
    setSelected(name);
    try {
      const d = await api.get(`/projects/${projectId}/settings/character/${name}`);
      if (d && typeof d === "object") {
        setChar({
          name: d.name || name,
          role: d.role || "supporting",
          appearance: d.appearance || "",
          background: d.background || "",
          speech: d.speech || "",
          world_view: d.world_view || "",
          self_image: d.self_image || "",
          values: d.values || "",
          abilities: d.abilities || "",
          skills: d.skills || "",
          environment: d.environment || "",
          possessions: d.possessions || "",
          relationships: d.relationships || "",
          experiences: d.experiences || "",
        });
      } else {
        setChar(emptyChar(name));
      }
    } catch { setChar(emptyChar(name)); }
  }

  async function saveCharacter() {
    if (!selected) return;
    setSaving(true); setCharError("");
    try {
      await api.put(`/projects/${projectId}/settings/character/${selected}`, char);
    } catch (e: any) { setCharError(e.message || "保存失败"); }
    finally { setSaving(false); }
  }

  async function addCharacter(name: string, role: string) {
    if (!projectId) { setCharError("项目未加载"); return; }
    try {
      const payload = { name, role, appearance: "", background: "", speech: "", world_view: "", self_image: "", values: "", abilities: "", skills: "", environment: "", possessions: "", relationships: "", experiences: "" };
      await api.put(`/projects/${projectId}/settings/character/${name}`, payload);
      await loadNames();
      setSelected(name);
      setChar(payload);
      setShowCreate(false);
      setCharError("");
    } catch (e: any) {
      console.error("addCharacter error:", e);
      setCharError(e?.message || "创建失败");
    }
  }

  async function deleteCharacter(name: string) {
    try {
      await api.delete(`/projects/${projectId}/settings/character/${name}`);
      loadNames();
      if (selected === name) { setSelected(null); setChar(emptyChar()); }
      setDeleteTarget(null);
      setCharError("");
    } catch (e: any) { setCharError(e.message || "删除失败"); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-base-300">
        <h2 className="text-xl font-serif font-semibold">👥 角色管理</h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${confirmed ? "text-success" : "text-base-content/30"}`}>
            {confirmed ? "✓ 已确认" : "(未确认)"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Character list */}
        <div className="w-48 border-r border-base-300 p-3 overflow-y-auto flex-shrink-0 flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-wider text-base-content/40 mb-3 flex items-center justify-between">
            <span>角色</span>
            <span className="text-base-content/20">{names.length}</span>
          </div>
          {names.length === 0 ? (
            <div className="text-xs text-base-content/20 text-center py-6 px-2 leading-relaxed">
              暂无角色<br />点击下方创建
            </div>
          ) : (
            names.map((n) => (
              <div key={n}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors cursor-pointer group ${
                  selected === n ? "bg-primary/10" : "hover:bg-base-300/30"
                }`}
                onClick={() => loadCharacter(n)}
              >
                <span className="text-sm">👤</span>
                <span className={`flex-1 text-sm truncate ${selected === n ? "text-primary font-medium" : "text-base-content/60"}`}>{n}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(n); }}
                  className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-xs px-1"
                >✕</button>
              </div>
            ))
          )}
          <button type="button" onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-1 mt-2 px-3 py-2 text-xs text-primary/60 border border-dashed border-primary/20 rounded-lg hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <span className="text-base leading-none">+</span> 新建
          </button>
        </div>

        {/* Right: Character form */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-sm text-base-content/40">选择或创建一个角色</div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <TabBar tabs={CHAR_TABS} activeTab={charTab} onTabChange={setCharTab}>
                <button onClick={saveCharacter} disabled={saving}
                  className="px-4 py-1.5 text-xs bg-primary/10 border border-primary/30 rounded-lg text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-40 self-center">
                  {saving ? "保存中…" : "💾 保存"}
                </button>
              </TabBar>

              {charTab === "basic" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-base-content/60 font-medium mb-1.5 block tracking-wide">角色名</label>
                      <input className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60" value={char.name} onChange={(e) => setChar((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-base-content/60 font-medium mb-1.5 block tracking-wide">故事角色</label>
                      <select className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm outline-none" value={char.role} onChange={(e) => setChar((p) => ({ ...p, role: e.target.value }))}>
                        <option value="protagonist">主角</option>
                        <option value="antagonist">反派</option>
                        <option value="supporting">配角</option>
                      </select>
                    </div>
                  </div>
                  <Field label="外貌" value={char.appearance} onChange={(v) => setChar((p) => ({ ...p, appearance: v }))} />
                  <Field label="背景" value={char.background} onChange={(v) => setChar((p) => ({ ...p, background: v }))} />
                  <Field label="语言特征" value={char.speech} onChange={(v) => setChar((p) => ({ ...p, speech: v }))} />
                </div>
              )}

              {charTab === "cognition" && (
                <div className="space-y-4">
                  <p className="text-xs text-base-content/30 mb-1">上层难改变（世界观/自我/价值观），下层随情节自然变化（能力/技能/环境）</p>
                  <Field label="世界观" hint="角色对世界运作方式的信念" value={char.world_view} onChange={(v) => setChar((p) => ({ ...p, world_view: v }))} />
                  <Field label="自我定位" hint="角色如何看待自己（可能与现实不同）" value={char.self_image} onChange={(v) => setChar((p) => ({ ...p, self_image: v }))} />
                  <Field label="价值观" hint="行为边界：什么绝不做，什么会打破原则" value={char.values} onChange={(v) => setChar((p) => ({ ...p, values: v }))} />
                  <div className="border-t border-base-300/30 pt-4" />
                  <Field label="能力" hint="具体能力，有上限。如：十步内可感知杀意" value={char.abilities} onChange={(v) => setChar((p) => ({ ...p, abilities: v }))} />
                  <Field label="技能" hint="习得技能及来源。如：码头帮派学的搏击" value={char.skills} onChange={(v) => setChar((p) => ({ ...p, skills: v }))} />
                  <Field label="环境" hint="成长背景 + 当前处境" value={char.environment} onChange={(v) => setChar((p) => ({ ...p, environment: v }))} />
                </div>
              )}

              {charTab === "extra" && (
                <div className="space-y-4">
                  <Field label="持有物" value={char.possessions} onChange={(v) => setChar((p) => ({ ...p, possessions: v }))} />
                  <Field label="关系" value={char.relationships} onChange={(v) => setChar((p) => ({ ...p, relationships: v }))} />
                  <Field label="经历" value={char.experiences} onChange={(v) => setChar((p) => ({ ...p, experiences: v }))} />
                </div>
              )}

              {charError && <p className="text-sm text-error/80 mt-3">{charError}</p>}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CharacterCreateModal
          onConfirm={(name, role) => addCharacter(name, role)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title="角色"
          confirmText={String(deleteTarget)}
          onConfirm={() => deleteCharacter(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="flex items-center justify-between px-6 py-3 border-t border-base-300">
        <span className="text-xs text-base-content/20">{names.length} 个角色</span>
        <ConfirmToggle confirmed={!!confirmed} onToggle={() => onConfirm?.()} />
      </div>
    </div>
  );
}

const CHAR_TABS = [
  { id: "basic", label: "基本信息" },
  { id: "cognition", label: "认知模型" },
  { id: "extra", label: "扩展信息" },
];
