// AI 拆主线四步向导（settings-three-col 起挂在设定视图右栏）：
// 每步 AI 干一活 → 产出落卡（applyWizard 自动保存）→ 作者可在表单里改；
// 中途退出按卡片内容续步（resumeStep 保守取第一个未完成步骤）。
// 免费用户点击运行 → 后端 403 member_required → 全局升级弹窗（request 广播）。
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Ico, P } from "@/components/icons";
import type { ArcCtl } from "./useStoryArc";

const STEPS = [
  { n: 1, key: "condense", name: "说想法", hint: "用你的话讲讲这个故事——主角最想达成什么？" },
  { n: 2, key: "ending", name: "聊结局", hint: "想象最后一幕：主角最终站在什么位置？（没想好可跳过）" },
  { n: 3, key: "split", name: "倒推分卷", hint: "AI 基于主线+结局提一版分卷方案，你可以增删改。" },
  { n: 4, key: "audit", name: "自查", hint: "AI 三问自查：每卷挂主线吗？卷连成线吗？能拼回主线吗？" },
] as const;

interface Props {
  ctl: ArcCtl;
}

export default function ArcWizard({ ctl }: Props) {
  const { arc, resumeStep } = ctl;
  const [step, setStep] = useState(resumeStep);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [audit, setAudit] = useState<any>(null);
  const [endingNotes, setEndingNotes] = useState<{ contradiction: string; notes: string } | null>(null);

  // 挂载对齐续步位置（面板切换重挂时回到第一个未完成步骤）
  useEffect(() => { setStep(resumeStep); }, [resumeStep]);

  const runStep = async () => {
    if (running) return;
    const s = STEPS.find((x) => x.n === step)!;
    if (!input.trim()) {
      toast.info("先在这一步写点想法（哪怕很散）");
      return;
    }
    setRunning(true);
    try {
      const r = await api.runArcWizard(ctl.projectId, s.key, { input, arc });
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
            tone: v.ending.tone !== undefined ? String(v.ending.tone) : arc.ending.tone,
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
      setInput("");
      // 每步产出先落卡（向导内自动保存；作者随后可在表单改，改完走面板保存）
      await ctl.applyWizard(next, s.n < 4 ? s.n + 1 : resumeStep);
      if (s.n < 4) setStep(s.n + 1);
    } catch {
      // 403 member_required 已由全局升级弹窗提示；此处只收尾
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="arc-wizard">
      <div className="rail-sec-head">
        <Ico d={P.spark} size={13} />
        <b>AI 拆主线</b>
      </div>
      <p className="opt" style={{ fontSize: 12, margin: "0 0 8px" }}>
        会员功能 · 每步产出先落卡、随时可改、中途可续
      </p>
      <div className="seg" style={{ flexWrap: "wrap", marginBottom: 8 }}>
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

      {step === 2 && endingNotes && (endingNotes.contradiction || endingNotes.notes) && (
        <div className="notice info" style={{ margin: "0 0 8px" }}>
          <span className="nt">
            {endingNotes.contradiction && <b>{endingNotes.contradiction}</b>}
            <span>{endingNotes.notes}</span>
          </span>
        </div>
      )}
      {step === 4 && audit && (
        <div style={{ display: "grid", gap: 4, marginBottom: 8 }}>
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
        placeholder={step === 1 ? "把想法散着说也行，AI 会浓缩成一句话请你确认" : "写给 AI 的话（第 2 步没想好可点跳过）"}
        onChange={(e) => setInput(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={running} onClick={() => void runStep()}>
          {running ? "AI 处理中…" : step === 4 ? "开始自查" : "让 AI 处理并进下一步"}
        </button>
        {step === 2 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={running}
            onClick={() => setStep(3)}
          >
            没想好，先跳过
          </button>
        )}
      </div>
    </div>
  );
}
