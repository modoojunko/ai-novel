import { useState } from "react";
import { Ico, P } from "@/components/icons";
import Modal from "@/components/design/Modal";

interface CharacterCreateModalProps {
  onConfirm: (name: string, role: string) => void;
  onCancel: () => void;
}

// 三档角色卡配色走 token 家族：主角=暖金(warn)、反派=赭红(err)、配角=墨绿(accent)
const ROLE_OPTIONS = [
  {
    id: "protagonist", label: "主角", tag: "核心人物",
    desc: "故事的推动者，读者视角的锚点", icon: P.star,
    tint: "color-mix(in oklch, var(--warn) 12%, transparent)",
    border: "color-mix(in oklch, var(--warn) 40%, transparent)",
    dot: "var(--warn)",
  },
  {
    id: "antagonist", label: "反派", tag: "冲突之源",
    desc: "核心冲突的对立面，有独立的动机", icon: P.moon,
    tint: "color-mix(in oklch, var(--err) 10%, transparent)",
    border: "color-mix(in oklch, var(--err) 35%, transparent)",
    dot: "var(--err)",
  },
  {
    id: "supporting", label: "配角", tag: "世界血肉",
    desc: "有自己的目标，不依附主角存在", icon: P.spark,
    tint: "color-mix(in oklch, var(--accent) 12%, transparent)",
    border: "color-mix(in oklch, var(--accent) 40%, transparent)",
    dot: "var(--accent)",
  },
];

export default function CharacterCreateModal({ onConfirm, onCancel }: CharacterCreateModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("supporting");

  function handleConfirm() {
    if (!name.trim()) return;
    onConfirm(name.trim(), role);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="创建角色"
      width={440}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={!name.trim()}>
            <Ico d={P.spark} size={13} />
            创建
          </button>
        </>
      }
    >
      <p className="text-sm" style={{ color: "var(--muted)", margin: "-2px 0 14px" }}>
        取一个名字，选定它在故事中的位置。
      </p>

      <div className="relative mb-4">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--muted)" }}
        >
          <Ico d={P.pencil} size={14} />
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          placeholder="角色名"
          className="input w-full"
          style={{ paddingLeft: 34 }}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            aria-label={"角色：" + r.label}
            className="w-full text-left p-3 rounded-xl border transition-all"
            style={
              role === r.id
                ? { borderColor: r.border, background: r.tint }
                : { borderColor: "var(--border)", background: "transparent" }
            }
          >
            <div className="flex items-center gap-3">
              <Ico d={r.icon} size={18} style={{ color: role === r.id ? r.dot : "var(--muted)" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ color: "var(--muted)", background: "var(--fg-soft)" }}
                  >
                    {r.tag}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {r.desc}
                </p>
              </div>
              <span
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: role === r.id ? r.dot : "var(--border)" }}
              >
                {role === r.id && (
                  <span className="w-2 h-2 rounded-full" style={{ background: r.dot }} />
                )}
              </span>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
