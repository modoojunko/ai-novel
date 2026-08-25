// 主线卡（story-arc-planning）：建书后、卷纲前的拆纲环节。
// 三块内容：一句话主线 / 结局想法（三字段，可待定）/ 分卷规划（行编辑，后卷可整行待定）。
// 「AI 帮我拆」四步向导（会员）：每步 AI 干一活 → 产出落卡（自动保存）→ 作者可改；
// 中途退出按卡片内容续步（next_step 保守取第一个未完成步骤）。
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useDirtyState } from "@/hooks/useDirtyState";
import { type SettingSaveHandle } from "@/components/novel/settings/FormField";
import { Ico, P } from "@/components/icons";

export interface ArcVolumeRow {
  title: string;
  conflict: string;
  chapters: string;
}

export interface ArcData {
  premise: string;
  ending: { scene: string; hero: string; tone: string };
  volumes: ArcVolumeRow[];
}

const EMPTY_ARC: ArcData = { premise: "", ending: { scene: "", hero: "", tone: "" }, volumes: [] };

const STEPS = [
  { n: 1, key: "condense", name: "说想法", hint: "用你的话讲讲这个故事——主角最想达成什么？" },
  { n: 2, key: "ending", name: "聊结局", hint: "想象最后一幕：主角最终站在什么位置？（没想好可跳过）" },
  { n: 3, key: "split", name: "倒推分卷", hint: "AI 基于主线+结局提一版分卷方案，你可以增删改。" },
  { n: 4, key: "audit", name: "自查", hint: "AI 三问自查：每卷挂主线吗？卷连成线吗？能拼回主线吗？" },
] as const;

const TONE_OPTIONS = ["", "悲", "喜", "开放", "待定"];

interface Props {
  projectId: string;
  onDirtyChange?: (dirty: boolean) => void;
}

const StoryArcForm = forwardRef<SettingSaveHandle, Props>(function StoryArcForm(
  { projectId, onDirtyChange },
  ref,
) {
  const [arc, setArc] = useState<ArcData>(EMPTY_ARC);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 向导态（resumeStep = 后端按卡片内容推断的续步位置）
  const [wizOpen, setWizOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [resumeStep, setResumeStep] = useState(1);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [endingNotes, setEndingNotes] = useState<{ contradiction: string; notes: string } | null>(null);

  const { snapshotLoaded, markSaved } = useDirtyState(arc, onDirtyChange);
  // P3-4：晚到的挂载 fetch 不得覆盖用户输入
  const editedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .fetchStoryArc(projectId)
      .then((d: any) => {
        if (cancelled || editedRef.current) return;
        const next: ArcData = {
          premise: d.premise ?? "",
          ending: {
            scene: d.ending?.scene ?? "",
            hero: d.ending?.hero ?? "",
            tone: d.ending?.tone ?? "",
          },
          volumes: Array.isArray(d.volumes)
            ? d.volumes.map((v: any) => ({
                title: v.title ?? "", conflict: v.conflict ?? "", chapters: v.chapters ?? "",
              }))
            : [],
        };
        setArc(next);
        setResumeStep(typeof d.next_step === "number" ? d.next_step : 1);
        snapshotLoaded(next);
      })
      .catch(() => snapshotLoaded(EMPTY_ARC))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // snapshotLoaded 引用稳定；仅项目切换重拉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const save = useCallback(async (): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    try {
      await api.updateStoryArc(projectId, arc);
      markSaved();
      return true;
    } catch {
      toast.error("主线保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, arc, saving, markSaved]);

  useImperativeHandle(ref, () => ({ save }), [save]);

  const patch = useCallback((p: Partial<ArcData>) => {
    editedRef.current = true;
    setArc((prev) => ({ ...prev, ...p }));
  }, []);

  const patchVolume = useCallback((i: number, p: Partial<ArcVolumeRow>) => {
    editedRef.current = true;
    setArc((prev) => ({
      ...prev,
      volumes: prev.volumes.map((v, idx) => (idx === i ? { ...v, ...p } : v)),
    }));
  }, []);

  const addVolume = () => {
    editedRef.current = true;
    setArc((prev) => ({ ...prev, volumes: [...prev.volumes, { title: "", conflict: "", chapters: "" }] }));
  };
  const removeVolume = (i: number) => {
    editedRef.current = true;
    setArc((prev) => ({ ...prev, volumes: prev.volumes.filter((_, idx) => idx !== i) }));
  };
  const markTbd = (i: number) => patchVolume(i, { title: "待定", conflict: "待定", chapters: "?" });

  // ── 向导：跑一步，产出落卡并自动保存（可续的持久化基础）──────────────
  const runStep = async () => {
    if (running) return;
    const s = STEPS.find((x) => x.n === step)!;
    if (!input.trim()) {
      toast.info("先在这一步写点想法（哪怕很散）");
      return;
    }
    setRunning(true);
    try {
      const r = await api.runArcWizard(projectId, s.key, { input, arc });
      const v = r.value ?? {};
      const next = { ...arc };
      if (s.key === "condense" && v.premise) {
        next.premise = String(v.premise);
        if (v.notes) toast.info(String(v.notes));
      } else if (s.key === "ending") {
        if (v.ending) {
          next.ending = {
            scene: String(v.ending.scene ?? arc.ending.scene),
            hero: String(v.ending.hero ?? arc.ending.hero),
            tone: String(v.ending.tone ?? arc.ending.tone),
          };
        }
        setEndingNotes({
          contradiction: String(v.contradiction ?? ""),
          notes: String(v.notes ?? ""),
        });
      } else if (s.key === "split" && Array.isArray(v.volumes)) {
        next.volumes = v.volumes.map((row: any) => ({
          title: String(row.title ?? ""), conflict: String(row.conflict ?? ""), chapters: String(row.chapters ?? ""),
        }));
        if (v.notes) toast.info(String(v.notes));
      } else if (s.key === "audit") {
        setAudit(v);
      }
      editedRef.current = true;
      setArc(next);
      setInput("");
      // 每步产出先落卡：向导内自动保存（作者随后可改，改完走面板保存）
      await api.updateStoryArc(projectId, next).catch(() => toast.error("主线保存失败"));
      markSaved();
      if (s.n < 4) {
        setStep(s.n + 1);
        setResumeStep(s.n + 1);
      }
    } catch {
      // 403 member_required 已由全局升级弹窗提示；此处只收尾
    } finally {
      setRunning(false);
    }
  };

  const openWizard = () => {
    // 中途退出可续：重开按卡片内容回到第一个未完成的步骤
    setStep(resumeStep);
    setWizOpen(true);
    setEndingNotes(null);
    setAudit(null);
  };

  if (loading) {
    return <p className="opt">加载主线卡…</p>;
  }

  return (
    <div className="story-arc-form">
      {/* 一句话主线 */}
      <div className="field">
        <label>
          这本书讲什么 <span className="opt">一句话：谁 + 想要什么 + 什么拦着</span>
        </label>
        <textarea
          className="textarea"
          rows={2}
          maxLength={200}
          placeholder="例：陆征追查失踪案，发现三年前旧案被压，越查越深触及警队内部势力"
          value={arc.premise}
          disabled={saving}
          onChange={(e) => patch({ premise: e.target.value })}
        />
      </div>

      {/* 结局想法 */}
      <div className="field">
        <label>结局想法 <span className="opt">三项都可只填部分、可「待定」、可全空</span></label>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            className="input"
            placeholder="最后一幕画面（例：侦探所里看着旧卷宗）"
            value={arc.ending.scene}
            disabled={saving}
            onChange={(e) => patch({ ending: { ...arc.ending, scene: e.target.value } })}
          />
          <input
            className="input"
            placeholder="主角最终怎样（例：破案但心里装了更多）"
            value={arc.ending.hero}
            disabled={saving}
            onChange={(e) => patch({ ending: { ...arc.ending, hero: e.target.value } })}
          />
          <div className="seg">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t || "none"}
                type="button"
                className={`seg-btn${arc.ending.tone === t ? " on" : ""}`}
                disabled={saving}
                onClick={() => patch({ ending: { ...arc.ending, tone: t } })}
              >
                {t || "未定"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 分卷规划 */}
      <div className="field">
        <label>
          分卷规划 <span className="opt">每卷一行：卷名（2-4 字）/ 这卷干什么 / 大概几章；后面的卷可整行「待定」</span>
        </label>
        <div style={{ display: "grid", gap: 8 }}>
          {arc.volumes.length === 0 && (
            <p className="opt" style={{ fontSize: 12 }}>还没有分卷行。可手加，也可用下面的 AI 向导倒推。</p>
          )}
          {arc.volumes.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="opt" style={{ fontSize: 12 }}>卷{i + 1}</span>
              <input
                className="input"
                style={{ width: 90 }}
                placeholder="卷名"
                value={v.title}
                disabled={saving}
                onChange={(e) => patchVolume(i, { title: e.target.value })}
              />
              <input
                className="input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="这卷干什么（核心冲突一句话）"
                value={v.conflict}
                disabled={saving}
                onChange={(e) => patchVolume(i, { conflict: e.target.value })}
              />
              <input
                className="input"
                style={{ width: 70 }}
                placeholder="章数"
                value={v.chapters}
                disabled={saving}
                onChange={(e) => patchVolume(i, { chapters: e.target.value })}
              />
              <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => markTbd(i)}>
                待定
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`删除卷${i + 1}`}
                disabled={saving}
                onClick={() => removeVolume(i)}
              >
                <Ico d={P.trash} />
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={addVolume}>
              <Ico d={P.plus} />
              加一卷
            </button>
          </div>
        </div>
      </div>

      <p className="opt" style={{ fontSize: 12, margin: "-4px 0 16px" }}>
        分卷是规划草稿，不会自动变成实际的卷；主线没填也不影响直接去建卷写章。
      </p>

      {/* AI 向导入口（会员；免费点击走全局升级引导） */}
      {!wizOpen ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openWizard}>
            AI 帮我拆
          </button>
          <span className="opt" style={{ fontSize: 12, alignSelf: "center" }}>
            会员功能 · 四步向导，每步产出先落卡、随时可改、中途可续
          </span>
        </div>
      ) : (
        <div className="arc-wizard" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <b style={{ fontSize: 13 }}>AI 拆主线</b>
            <div className="seg" style={{ marginLeft: "auto" }}>
              {STEPS.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  className={`seg-btn${step === s.n ? " on" : ""}`}
                  onClick={() => { setStep(s.n); setEndingNotes(null); setAudit(null); }}
                >
                  {s.n}. {s.name}
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn" aria-label="收起向导" onClick={() => setWizOpen(false)}>
              <Ico d={P.close} />
            </button>
          </div>

          {step === 2 && endingNotes && (endingNotes.contradiction || endingNotes.notes) && (
            <div className="notice info" style={{ margin: 0 }}>
              <span className="nt">
                {endingNotes.contradiction && <b>{endingNotes.contradiction}</b>}
                <span>{endingNotes.notes}</span>
              </span>
            </div>
          )}
          {step === 4 && audit && (
            <div style={{ display: "grid", gap: 4 }}>
              {(audit.checks ?? []).map((c: any, i: number) => (
                <p key={i} style={{ fontSize: 12, margin: 0 }}>
                  {c.passed ? "✓" : "✗"} {c.question}：{c.detail}
                </p>
              ))}
              {audit.structure && (
                <p style={{ fontSize: 12, margin: 0 }}>
                  <b>{audit.structure}</b>
                </p>
              )}
            </div>
          )}

          <p className="opt" style={{ fontSize: 12, margin: 0 }}>
            {STEPS.find((s) => s.n === step)!.hint}
          </p>
          <textarea
            className="textarea"
            rows={3}
            value={input}
            disabled={running}
            placeholder={step === 1 ? "把想法散着说也行，AI 会浓缩成一句话请你确认" : "写给 AI 的话（第 2 步没想好可填「跳过」）"}
            onChange={(e) => setInput(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={running} onClick={() => void runStep()}>
              {running ? "AI 处理中…" : step === 4 ? "开始自查" : "让 AI 处理并进下一步"}
            </button>
            {step === 2 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={running}
                onClick={() => { patch({ ending: { ...arc.ending, tone: arc.ending.tone || "待定" } }); setStep(3); setResumeStep(3); }}
              >
                没想好，先跳过
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default StoryArcForm;
