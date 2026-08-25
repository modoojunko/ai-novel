// 伏笔设定（settings-three-col：内嵌子双栏）：
//   内嵌左栏 = 按状态分组的伏笔列表（活跃/已收束/废弃）+ 添加伏笔；
//   内嵌右侧 = 选中伏笔的配置表单（描述/引入/类型/优先级/状态搬移 + AI 帮我填）。
// 数据模型不变：active/resolved/abandoned 三数组整存整取。
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { api } from "@/lib/api";
import { useDirtyState } from "@/hooks/useDirtyState";
import { SettingSaveHandle } from "./FormField";
import AISuggestionModal from "./AISuggestionModal";
import { Ico, P } from "@/components/icons";

interface Props {
  projectId: string;
  settingKey: string;
  /** P2-1：脏状态回调（未保存修改时 true），父组件切换面板前据此确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

const HOOK_TYPES = [
  { value: "mystery", label: "谜团" }, { value: "threat", label: "威胁" },
  { value: "promise", label: "承诺" }, { value: "clue", label: "线索" },
  { value: "relationship", label: "关系" }, { value: "power", label: "力量" },
  { value: "emotion", label: "情感" }, { value: "choice", label: "选择" }, { value: "desire", label: "欲望" },
];

type Group = "active" | "resolved" | "abandoned";

const GROUPS: { key: Group; label: string }[] = [
  { key: "active", label: "活跃" },
  { key: "resolved", label: "已收束" },
  { key: "abandoned", label: "废弃" },
];

/** 选中键：组名-下标 */
type SelKey = string;

const HooksSettingForm = forwardRef<SettingSaveHandle, Props>(function HooksSettingForm(
  { projectId, settingKey, onDirtyChange },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<any[]>([]);
  const [resolved, setResolved] = useState<any[]>([]);
  const [abandoned, setAbandoned] = useState<any[]>([]);
  const [sel, setSel] = useState<SelKey | null>(null);

  // AI modal state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const currentShape = { active, resolved, abandoned };
  const { isDirty, snapshotLoaded, markSaved } = useDirtyState(currentShape, onDirtyChange);

  useEffect(() => {
    setLoading(true);
    api.get(`/novels/${projectId}/settings/${settingKey}`)
      .then((d: any) => {
        if (!d) {
          // 空项目无 KV 行 → 以当前（初始）态为快照基线
          snapshotLoaded(currentShape);
          return;
        }
        const activeN = d.active || [];
        const resolvedN = d.resolved || [];
        const abandonedN = d.abandoned || [];
        setActive(activeN);
        setResolved(resolvedN);
        setAbandoned(abandonedN);
        snapshotLoaded({ active: activeN, resolved: resolvedN, abandoned: abandonedN });
      })
      .catch(() => {
        setError("加载失败");
        snapshotLoaded(currentShape);
      })
      .finally(() => setLoading(false));
  }, [projectId, settingKey, snapshotLoaded]);

  async function handleSave() {
    if (saving) return false;
    setSaving(true); setError("");
    try {
      await api.put(`/novels/${projectId}/settings/${settingKey}`, { active, resolved, abandoned });
      markSaved();
      return true;
    }
    catch (e: any) { setError(e.message || "保存失败"); return false; }
    finally { setSaving(false); }
  }

  // gap3：完成设定前先把当前表单内容落库（恒保存，幂等）
  useImperativeHandle(ref, () => ({ save: handleSave }));

  const groupArr = (g: Group) => (g === "active" ? active : g === "resolved" ? resolved : abandoned);
  const groupSet = (g: Group) => (g === "active" ? setActive : g === "resolved" ? setResolved : setAbandoned);

  const selParts = sel ? sel.split("-") : null;
  const selGroup = (selParts?.[0] as Group) ?? null;
  const selIdx = selParts ? parseInt(selParts[1], 10) : -1;
  const selHook = selGroup ? groupArr(selGroup)[selIdx] : undefined;

  function select(g: Group, i: number, dirty: boolean) {
    if (dirty) {
      const ok = window.confirm("当前伏笔有未保存的修改，切换将丢失这些修改。确定继续吗？");
      if (!ok) return;
    }
    setSel(`${g}-${i}`);
  }

  function patchSel(patchObj: Record<string, string>) {
    if (!selGroup) return;
    const arr = [...groupArr(selGroup)];
    arr[selIdx] = { ...arr[selIdx], ...patchObj };
    groupSet(selGroup)(arr);
  }

  /** 状态搬移：从当前组删除并追加到目标组（选中跟随） */
  function moveSel(to: Group) {
    if (!selGroup) return;
    const arr = [...groupArr(selGroup)];
    const [item] = arr.splice(selIdx, 1);
    groupSet(selGroup)(arr);
    const dst = [...groupArr(to), item];
    groupSet(to)(dst);
    setSel(`${to}-${dst.length - 1}`);
  }

  function addHook() {
    setActive([...active, { description: "", introduced_in: "", type: "mystery", priority: "2" }]);
    setSel(`active-${active.length}`);
  }

  function removeSel() {
    if (!selGroup) return;
    const arr = [...groupArr(selGroup)];
    arr.splice(selIdx, 1);
    groupSet(selGroup)(arr);
    setSel(null);
  }

  async function handleAIGenerate() {
    if (!selGroup) return;
    setAiLoading(true);
    setAiOpen(true);
    setAiContent("");
    try {
      const hooks = groupArr(selGroup);
      const res = await api.post(`/novels/${projectId}/settings/ai/hooks/description`, {
        context: { hooks, index: selIdx, current: hooks[selIdx] },
      });
      setAiContent(typeof res.value === "string" ? res.value : JSON.stringify(res.value, null, 2));
    } catch (e: any) {
      setAiContent(`生成失败：${e.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return <p className="opt">加载中…</p>;

  return (
    <div className="subsplit">
      <aside className="sub-list">
        <div className="sub-list-head">伏笔 <span className="opt">{active.length + resolved.length + abandoned.length} 条</span></div>
        {GROUPS.map((g) => {
          const arr = groupArr(g.key);
          return (
            <div key={g.key} className="sub-group">
              <span className="sub-group-label">{g.label} · {arr.length}</span>
              {arr.map((h, i) => (
                <div
                  key={`${g.key}-${i}`}
                  className={`hook-item${sel === `${g.key}-${i}` ? " sel" : ""}`}
                  onClick={() => select(g.key, i, isDirty)}
                  title={h.description || "未填写描述"}
                >
                  {h.description ? (h.description.length > 14 ? `${h.description.slice(0, 14)}…` : h.description) : "未填写"}
                </div>
              ))}
            </div>
          );
        })}
        <button className="text-btn" type="button" onClick={addHook}>
          <Ico d={P.plus} sw={2} size={13} />
          添加伏笔
        </button>
      </aside>

      <div className="sub-form">
        {selHook ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="field">
              <label>
                伏笔描述
                <button
                  className="text-btn"
                  type="button"
                  style={{ marginLeft: "auto" }}
                  onClick={() => void handleAIGenerate()}
                  disabled={aiLoading}
                >
                  <Ico d={P.spark} sw={1.8} size={13} />
                  {aiLoading ? "AI 生成中…" : "AI 帮我填"}
                </button>
              </label>
              <input
                className="input"
                placeholder="伏笔描述"
                value={selHook.description || ""}
                onChange={(e) => patchSel({ description: e.target.value })}
              />
            </div>
            <div className="tpl-row">
              <div className="field tpl-select">
                <label>引入</label>
                <input
                  className="input"
                  placeholder="在哪章引入"
                  value={selHook.introduced_in || ""}
                  onChange={(e) => patchSel({ introduced_in: e.target.value })}
                />
              </div>
              <div className="field tpl-select">
                <label>类型</label>
                <select className="input" value={selHook.type || "mystery"}
                  onChange={(e) => patchSel({ type: e.target.value })}>
                  {HOOK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="field tpl-select">
                <label>优先级</label>
                <select className="input" value={selHook.priority || "2"}
                  onChange={(e) => patchSel({ priority: e.target.value })}>
                  <option value="1">高</option><option value="2">中</option><option value="3">低</option>
                </select>
              </div>
              <div className="field tpl-select">
                <label>状态</label>
                <select className="input" value={selGroup || "active"}
                  onChange={(e) => moveSel(e.target.value as Group)}>
                  <option value="active">活跃</option>
                  <option value="resolved">已收束</option>
                  <option value="abandoned">废弃</option>
                </select>
              </div>
            </div>
            <div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={removeSel}>
                <Ico d={P.trash} sw={1.7} />
                删除这条伏笔
              </button>
            </div>
          </div>
        ) : (
          <p className="sub-empty">从左侧选择一条伏笔，或点「添加伏笔」开始埋线。</p>
        )}

        {error && <p className="opt" style={{ color: "var(--err)" }}>{error}</p>}
      </div>

      <AISuggestionModal
        open={aiOpen}
        fieldLabel="伏笔描述"
        content={aiContent}
        loading={aiLoading}
        onAccept={() => { patchSel({ description: aiContent }); setAiOpen(false); setAiContent(""); }}
        onRetry={() => void handleAIGenerate()}
        onClose={() => { setAiOpen(false); setAiContent(""); }}
      />
    </div>
  );
});

export default HooksSettingForm;
