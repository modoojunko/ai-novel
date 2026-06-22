// ---------------------------------------------------------------------------
// SettingsFormField — generic settings editor for world/style/anti-ai/hooks/characters
// ---------------------------------------------------------------------------

const TITLE_MAP: Record<string, string> = {
  world: "🌍 世界设定",
  style: "✍️ 写作风格",
  "anti-ai": "🛡️ 反AI规则",
  hooks: "⚓ 伏笔面板",
  characters: "👥 角色管理",
};

interface SettingsFormFieldProps {
  projectId: string;
  settingKey: string;
}

export default function SettingsFormField({
  projectId: _projectId,
  settingKey,
}: SettingsFormFieldProps) {
  const title = TITLE_MAP[settingKey] || settingKey;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-serif text-base-content">
          {title}
        </h2>
      </div>

      {/* ── Version bar ───────────────────────────────────────── */}
      <div className="text-sm text-base-content/40 select-none">
        v1 · —
      </div>

      {/* ── Textarea ──────────────────────────────────────────── */}
      <textarea
        className="textarea textarea-bordered w-full min-h-[400px] font-mono text-sm leading-relaxed resize-y"
        placeholder="（暂无内容，点击此处编辑）"
      />

      {/* ── Save button ───────────────────────────────────────── */}
      <div className="flex justify-end">
        <button className="btn btn-primary btn-sm">
          {"💾"} 保存
        </button>
      </div>
    </div>
  );
}
