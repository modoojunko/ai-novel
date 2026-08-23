// 角色设定（book.html v2 设定视图·角色面板）：
//   列表区（char-row 头像/名称/故事角色/删除）+ 新建角色；
//   选中角色 → 3 组 .cfg 折叠卡（基本信息/认知模型/扩展信息，14 字段全保留）。
// 保存/确认语义收敛到面板脚注（gap3）：SettingsView 持 ref，确认完成前先 save。
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import CharacterCreateModal from "./CharacterCreateModal";
import DeleteConfirmModal from "../DeleteConfirmModal";
import { Ico, P } from "@/components/icons";
import { Cfg, Field, SettingSaveHandle } from "./FormField";

interface Props {
  projectId: string;
  /** P2-1：脏状态回调（角色编辑表单有未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

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

const ROLE_LABEL: Record<string, string> = { protagonist: "主角", antagonist: "反派", supporting: "配角" };

const CharacterManager = forwardRef<SettingSaveHandle, Props>(function CharacterManager(
  { projectId, onDirtyChange },
  ref,
) {
  const [names, setNames] = useState<string[]>([]);
  // char-row 副文本需要故事角色标签，而 /characters/list 只回名字 → 逐个补拉
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [char, setChar] = useState<CharData>(emptyChar());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [charError, setCharError] = useState("");
  const { isDirty, snapshotLoaded, markSaved } = useDirtyState(char, onDirtyChange);

  const loadNames = () => {
    api.get(`/novels/${projectId}/settings/characters/list`)
      .then((list: string[]) => {
        setNames(list);
        Promise.all(
          list.map((n) =>
            api
              .get(`/novels/${projectId}/settings/character/${n}`)
              .then((d: any) => [n, d?.role || "supporting"] as const)
              .catch(() => [n, "supporting"] as const),
          ),
        ).then((pairs) => setRoles(Object.fromEntries(pairs)));
      })
      .catch(() => {});
  };

  useEffect(() => { setLoading(true); loadNames(); setLoading(false); }, [projectId]);

  async function loadCharacter(name: string) {
    setCharError("");
    setSelected(name);
    try {
      const d = await api.get(`/novels/${projectId}/settings/character/${name}`);
      if (d && typeof d === "object") {
        const ch = {
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
        };
        setChar(ch);
        snapshotLoaded(ch);
      } else {
        const ch = emptyChar(name);
        setChar(ch);
        snapshotLoaded(ch);
      }
    } catch {
      const ch = emptyChar(name);
      setChar(ch);
      snapshotLoaded(ch);
    }
  }

  async function saveCharacter() {
    if (!selected) return true;
    if (saving) return false;
    setSaving(true); setCharError("");
    try {
      await api.put(`/novels/${projectId}/settings/character/${selected}`, char);
      markSaved();
      return true;
    } catch (e: any) { setCharError(e.message || "保存失败"); return false; }
    finally { setSaving(false); }
  }

  // gap3：确认完成前先把选中角色落库（无选中角色视为无需保存）
  useImperativeHandle(ref, () => ({ save: saveCharacter }));

  /** gap1：切换角色前，若有未保存修改先确认，避免静默丢输入。 */
  function handleSelectChar(name: string) {
    if (name === selected) return;
    if (isDirty) {
      const ok = window.confirm("当前角色有未保存的修改，切换将丢失这些修改。确定继续吗？");
      if (!ok) return;
    }
    loadCharacter(name);
  }

  async function addCharacter(name: string, role: string) {
    if (!projectId) { setCharError("项目未加载"); return; }
    try {
      const payload = { name, role, appearance: "", background: "", speech: "", world_view: "", self_image: "", values: "", abilities: "", skills: "", environment: "", possessions: "", relationships: "", experiences: "" };
      await api.put(`/novels/${projectId}/settings/character/${name}`, payload);
      await loadNames();
      setSelected(name);
      setChar(payload);
      snapshotLoaded(payload);
      setShowCreate(false);
      setCharError("");
    } catch (e: any) {
      console.error("addCharacter error:", e);
      setCharError(e?.message || "创建失败");
    }
  }

  async function deleteCharacter(name: string) {
    try {
      await api.delete(`/novels/${projectId}/settings/character/${name}`);
      loadNames();
      if (selected === name) {
        setSelected(null);
        setChar(emptyChar());
        snapshotLoaded(emptyChar());
      }
      setDeleteTarget(null);
      setCharError("");
    } catch (e: any) { setCharError(e.message || "删除失败"); }
  }

  if (loading) return <p className="opt">加载中…</p>;

  return (
    <div>
      <div className="field">
        <label>角色 <span className="opt">{names.length} 个</span></label>
        {names.length === 0
          ? <p className="sub-empty">暂无角色 · 点下方新建</p>
          : names.map((n) => (
            <div
              key={n}
              className={`char-row${selected === n ? " sel" : ""}`}
              onClick={() => handleSelectChar(n)}
            >
              <span className="avatar serif">{n[0]}</span>
              <div>
                <div className="cname">{n}</div>
                <div className="cdesc">{ROLE_LABEL[roles[n]] || "配角"}</div>
              </div>
              <button
                className="icon-btn del"
                type="button"
                title="移除"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(n); }}
              >
                <Ico d={P.trash} sw={1.7} />
              </button>
            </div>
          ))}
        <button className="text-btn" type="button" onClick={() => setShowCreate(true)}>
          <Ico d={P.plus} sw={2} size={13} />
          新建角色
        </button>
      </div>

      {selected && (
        <>
          <Cfg title="基本信息" open>
            <div className="tpl-row">
              <div className="field tpl-select">
                <label>角色名</label>
                <input className="input" value={char.name} placeholder="角色名"
                  onChange={(e) => setChar((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="field stage-map">
                <label>故事角色</label>
                <select className="input" value={char.role}
                  onChange={(e) => setChar((p) => ({ ...p, role: e.target.value }))}>
                  <option value="protagonist">主角</option>
                  <option value="antagonist">反派</option>
                  <option value="supporting">配角</option>
                </select>
              </div>
            </div>
            <Field label="外貌" value={char.appearance} onChange={(v) => setChar((p) => ({ ...p, appearance: v }))} />
            <Field label="背景" value={char.background} onChange={(v) => setChar((p) => ({ ...p, background: v }))} />
            <Field label="语言特征" value={char.speech} onChange={(v) => setChar((p) => ({ ...p, speech: v }))} />
          </Cfg>
          <Cfg title="认知模型">
            <p className="opt" style={{ margin: "0 0 12px" }}>上层难改变（世界观/自我/价值观），下层随情节自然变化（能力/技能/环境）</p>
            <Field label="世界观" hint="角色对世界运作方式的信念" value={char.world_view} onChange={(v) => setChar((p) => ({ ...p, world_view: v }))} />
            <Field label="自我定位" hint="角色如何看待自己（可能与现实不同）" value={char.self_image} onChange={(v) => setChar((p) => ({ ...p, self_image: v }))} />
            <Field label="价值观" hint="行为边界：什么绝不做，什么会打破原则" value={char.values} onChange={(v) => setChar((p) => ({ ...p, values: v }))} />
            <Field label="能力" hint="具体能力，有上限。如：十步内可感知杀意" value={char.abilities} onChange={(v) => setChar((p) => ({ ...p, abilities: v }))} />
            <Field label="技能" hint="习得技能及来源。如：码头帮派学的搏击" value={char.skills} onChange={(v) => setChar((p) => ({ ...p, skills: v }))} />
            <Field label="环境" hint="成长背景 + 当前处境" value={char.environment} onChange={(v) => setChar((p) => ({ ...p, environment: v }))} />
          </Cfg>
          <Cfg title="扩展信息">
            <Field label="持有物" value={char.possessions} onChange={(v) => setChar((p) => ({ ...p, possessions: v }))} />
            <Field label="关系" value={char.relationships} onChange={(v) => setChar((p) => ({ ...p, relationships: v }))} />
            <Field label="经历" value={char.experiences} onChange={(v) => setChar((p) => ({ ...p, experiences: v }))} />
          </Cfg>
        </>
      )}

      {charError && <p className="opt" style={{ color: "var(--err)" }}>{charError}</p>}

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
    </div>
  );
});
export default CharacterManager;
