import WorldSettingForm from "./settings/WorldSettingForm";
import StyleSettingForm from "./settings/StyleSettingForm";
import AntiAiSettingForm from "./settings/AntiAiSettingForm";
import HooksSettingForm from "./settings/HooksSettingForm";
import CharacterManager from "./settings/CharacterManager";
import ConfirmToggle from "./settings/ConfirmToggle";
import ModelSettingForm from "./settings/ModelSettingForm";
import GenreSettingForm from "./settings/GenreSettingForm";
import SynopsisCard from "./SynopsisCard";

const TITLE_MAP: Record<string, string> = {
  genre: "📖 题材设定",
  world: "🌍 世界设定",
  style: "✍️ 写作风格",
  "anti-ai": "🛡️ AI痕迹控制",
  hooks: "⚓ 伏笔管理",
  characters: "👥 角色管理",
  "ai-model": "🧠 AI 模型",
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
    return (
      <div className="p-6">
        <SynopsisCard projectId={projectId} />
        <CharacterManager projectId={projectId} confirmed={confirmed} onConfirm={onConfirm} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 简介补录卡 —— 全局常驻（跨左侧子节点可见） */}
      <div className="max-w-3xl mx-auto">
        <SynopsisCard projectId={projectId} />
      </div>

      <div className="flex items-center justify-between mb-5 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif font-semibold">{title}</h2>
          <div className="h-5 w-px bg-base-300/60" />
          <span className={`text-xs tracking-wide ${confirmed ? "text-success/60" : "text-base-content/20"}`}>
            {confirmed ? "已设定" : "待设定"}
          </span>
        </div>
        <ConfirmToggle confirmed={!!confirmed} onToggle={() => onConfirm?.()} />
      </div>

      <div className="flex items-center gap-3 px-4 py-2 bg-base-200/40 border border-base-300/50 rounded-lg text-xs mb-5 max-w-3xl mx-auto">
        <span className="text-base-content/30 uppercase tracking-wider">版本</span>
        <span className="font-semibold text-primary">v1</span>
        <span className="text-base-content/20">· —</span>
        <div className="flex-1" />
      </div>

      <div className={`transition-opacity duration-300 ${confirmed ? "opacity-60" : "opacity-100"}`}>
        {settingKey === "world" && <WorldSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "style" && <StyleSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "anti-ai" && <AntiAiSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "hooks" && <HooksSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "ai-model" && <ModelSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "genre" && <GenreSettingForm projectId={projectId} settingKey={settingKey} />}
      </div>
    </div>
  );
}
