import WorldSettingForm from "./settings/WorldSettingForm";
import StyleSettingForm from "./settings/StyleSettingForm";
import AntiAiSettingForm from "./settings/AntiAiSettingForm";
import HooksSettingForm from "./settings/HooksSettingForm";
import CharacterManager from "./settings/CharacterManager";
import ConfirmToggle from "./settings/ConfirmToggle";

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
  confirmed?: boolean;
  onConfirm?: () => void;
}

export default function SettingsFormField({ projectId, settingKey, confirmed, onConfirm }: SettingsFormFieldProps) {
  const title = TITLE_MAP[settingKey] || settingKey;

  if (settingKey === "characters") {
    return <CharacterManager projectId={projectId} confirmed={confirmed} onConfirm={onConfirm} />;
  }

  return (
    <div className="p-6">
      {/* Header with title + confirm toggle */}
      <div className="flex items-center justify-between mb-5 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif font-semibold">{title}</h2>
          <div className={`h-5 w-px bg-base-300/60`} />
          <span className={`text-xs tracking-wide ${confirmed ? "text-success/60" : "text-base-content/20"}`}>
            {confirmed ? "已设定" : "待设定"}
          </span>
        </div>
        <ConfirmToggle confirmed={!!confirmed} onToggle={() => onConfirm?.()} />
      </div>

      {/* Version bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-base-200/40 border border-base-300/50 rounded-lg text-xs mb-5 max-w-3xl mx-auto">
        <span className="text-base-content/30 uppercase tracking-wider">版本</span>
        <span className="font-semibold text-primary">v1</span>
        <span className="text-base-content/20">· —</span>
        <div className="flex-1" />
      </div>

      {/* Form */}
      <div className={`transition-opacity duration-300 ${confirmed ? "opacity-60" : "opacity-100"}`}>
        {settingKey === "world" && <WorldSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "style" && <StyleSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "anti-ai" && <AntiAiSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "hooks" && <HooksSettingForm projectId={projectId} settingKey={settingKey} />}
      </div>
    </div>
  );
}
