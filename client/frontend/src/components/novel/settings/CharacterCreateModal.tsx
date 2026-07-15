import { useState } from "react";

interface CharacterCreateModalProps {
  onConfirm: (name: string, role: string) => void;
  onCancel: () => void;
}

const ROLE_OPTIONS = [
  {
    id: "protagonist", label: "主角", tag: "核心人物",
    desc: "故事的推动者，读者视角的锚点", icon: "⭐",
    gradient: "from-amber-400/20 to-amber-600/10", border: "border-amber-500/30", dot: "bg-amber-400",
  },
  {
    id: "antagonist", label: "反派", tag: "冲突之源",
    desc: "核心冲突的对立面，有独立的动机", icon: "🌑",
    gradient: "from-red-400/15 to-red-600/8", border: "border-red-500/25", dot: "bg-red-400",
  },
  {
    id: "supporting", label: "配角", tag: "世界血肉",
    desc: "有自己的目标，不依附主角存在", icon: "✦",
    gradient: "from-primary/20 to-primary/10", border: "border-primary/25", dot: "bg-primary",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-base-100 border border-base-300/50 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-accent/60" />

        <div className="p-6">
          <h3 className="text-lg font-serif font-semibold text-base-content mb-1">创建角色</h3>
          <p className="text-sm text-base-content/40 mb-5">取一个名字，选定它在故事中的位置。</p>

          <div className="relative mb-5">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-base-content/20">✎</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="角色名"
              className="w-full bg-base-200/40 border border-base-300/50 rounded-xl pl-9 pr-4 py-3 text-sm outline-none transition-all duration-200 focus:border-primary/40 focus:bg-base-200/70"
              autoFocus
            />
          </div>

          <div className="space-y-2 mb-6">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                  role === r.id
                    ? `${r.border} ${r.gradient} shadow-sm`
                    : "border-base-300/30 bg-base-200/20 hover:bg-base-200/50 hover:border-base-300/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-base-content">{r.label}</span>
                      <span className="text-[10px] text-base-content/30 bg-base-300/40 px-1.5 py-0.5 rounded-full">{r.tag}</span>
                    </div>
                    <p className="text-xs text-base-content/40 mt-0.5">{r.desc}</p>
                  </div>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                    role === r.id ? r.border : "border-base-300/40"
                  }`}>
                    {role === r.id && <span className={`w-2 h-2 rounded-full ${r.dot}`} />}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-base-content/40 hover:text-base-content/70 transition-colors">
              取消
            </button>
            <button onClick={handleConfirm} disabled={!name.trim()}
              className="px-5 py-2 text-sm bg-primary/10 border border-primary/30 text-primary rounded-lg font-medium hover:bg-primary/20 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed">
              ✦ 创建
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
