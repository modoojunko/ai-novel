// Unified form field components for all setting forms

import { Sparkles, Loader2 } from "lucide-react";

// ── Shared AI props ────────────────────────────────────────────────
interface AIProps {
  aiGeneratable?: boolean;
  onAIGenerate?: () => void;
  aiLoading?: boolean;
}

// ── Field ─────────────────────────────────────────────────────────
export function Field({ label, hint, value, onChange, aiGeneratable, onAIGenerate, aiLoading }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void
} & AIProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-base-content/60 font-medium block tracking-wide">{label}</label>
        {aiGeneratable && (
          <button
            onClick={onAIGenerate}
            disabled={aiLoading}
            className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
            title="AI 帮我填"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "生成中" : "AI 帮我填"}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-base-content/30 mb-1.5 leading-relaxed">{hint}</p>}
      <textarea
        className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 resize-y min-h-[80px] placeholder:text-base-content/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── InputField ────────────────────────────────────────────────────
export function InputField({ label, hint, value, onChange, placeholder, aiGeneratable, onAIGenerate, aiLoading }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string
} & AIProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-base-content/60 font-medium block tracking-wide">{label}</label>
        {aiGeneratable && (
          <button
            onClick={onAIGenerate}
            disabled={aiLoading}
            className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
            title="AI 帮我填"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "生成中" : "AI 帮我填"}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-base-content/30 mb-1.5">{hint}</p>}
      <input
        className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── ListEditor ────────────────────────────────────────────────────
export function ListEditor({ items, onChange, placeholder, aiGeneratable, onAIGenerate, aiLoading }: {
  items: string[]; onChange: (v: string[]) => void; placeholder?: string
} & AIProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {aiGeneratable && (
          <button
            onClick={onAIGenerate}
            disabled={aiLoading}
            className="text-xs text-primary/50 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-40"
            title="AI 帮我填"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {aiLoading ? "生成中" : "AI 帮我填"}
          </button>
        )}
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <span className="text-xs text-base-content/20 w-5 text-right tabular-nums">{i + 1}.</span>
          <input
            className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
            value={item}
            onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            placeholder={placeholder}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="text-xs text-primary/60 hover:text-primary transition-colors mt-1 inline-flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span> 添加一项
      </button>
    </div>
  );
}

// ── SaveButton ────────────────────────────────────────────────────
export function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-1.5 text-xs bg-primary/10 border border-primary/30 rounded-lg text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-40 self-center"
    >
      {saving ? "保存中…" : "💾 保存"}
    </button>
  );
}

// ── TabBar ────────────────────────────────────────────────────────
export function TabBar({ tabs, activeTab, onTabChange, children }: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-0 border-b border-base-300/70 mb-5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`px-4 py-2.5 text-sm border-b-2 transition-all duration-200 ${
            activeTab === t.id
              ? "text-primary border-primary font-medium"
              : "text-base-content/40 border-transparent hover:text-base-content/70"
          }`}
        >
          {t.label}
        </button>
      ))}
      <div className="flex-1" />
      {children}
    </div>
  );
}
