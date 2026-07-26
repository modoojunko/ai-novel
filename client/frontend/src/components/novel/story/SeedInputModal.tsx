import { useState } from "react";
import { Sparkles, Send } from "lucide-react";

interface SeedInputModalProps {
  open: boolean;
  onSubmit: (seed: string) => void;
  onClose: () => void;
}

export default function SeedInputModal({ open, onSubmit, onClose }: SeedInputModalProps) {
  const [seed, setSeed] = useState("");

  if (!open) return null;

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div className="modal-box max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base-content">输入触发种子</h3>
        </div>
        <p className="text-xs text-base-content/50 mb-3 leading-relaxed">
          描述一个事件或情境，作为推演的第一推动力。
          例如：「B 朝 A 射了一箭」「张三发现了一封信」「城中突然发生爆炸」
        </p>
        <textarea
          className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 min-h-[80px]"
          placeholder="输入触发种子…"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
          <button
            onClick={() => { onSubmit(seed); setSeed(""); }}
            disabled={!seed.trim()}
            className="btn btn-primary btn-sm gap-1.5"
          >
            <Send className="w-4 h-4" />
            开始推演
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
