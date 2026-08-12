import { useRef } from "react";
import WorldSettingForm from "./settings/WorldSettingForm";
import StyleSettingForm from "./settings/StyleSettingForm";
import AntiAiSettingForm from "./settings/AntiAiSettingForm";
import HooksSettingForm from "./settings/HooksSettingForm";
import CharacterManager from "./settings/CharacterManager";
import ConfirmToggle from "./settings/ConfirmToggle";
import ModelSettingForm from "./settings/ModelSettingForm";
import GenreSettingForm from "./settings/GenreSettingForm";
import SynopsisCard from "./SynopsisCard";
import type { SettingSaveHandle } from "./settings/FormField";

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
  /** PRD 3.4：简介卡的完成确认状态（settings-status.yaml.synopsis） */
  synopsisConfirmed?: boolean;
  /** PRD 3.4：简介卡点「完成设定」回调 */
  onSynopsisConfirm?: () => void;
  /** P2-1：当前面板脏状态回调（未保存修改时 true），切换面板前确认 */
  onDirtyChange?: (dirty: boolean) => void;
}

export default function SettingsFormField({ projectId, settingKey, confirmed, onConfirm, synopsisConfirmed, onSynopsisConfirm, onDirtyChange }: SettingsFormFieldProps) {
  const title = TITLE_MAP[settingKey] || settingKey;

  // gap3：4 个「手动保存」表单的 ref（world/style/anti-ai/hooks）。
  // genre/ai-model 自动保存、数据恒最新，不暴露 save → ref 为 null，直接确认。
  const formRef = useRef<SettingSaveHandle>(null);

  /** gap3：完成设定前先把当前表单内容落库（恒保存，幂等）；保存失败则中止确认。 */
  const handleConfirmToggle = async () => {
    const saved = await formRef.current?.save();
    if (saved === false) return;
    onConfirm?.();
  };

  if (settingKey === "characters") {
    return (
      <div className="p-6">
        <SynopsisCard projectId={projectId} confirmed={synopsisConfirmed} onConfirm={onSynopsisConfirm} />
        <CharacterManager projectId={projectId} confirmed={confirmed} onConfirm={onConfirm} onDirtyChange={onDirtyChange} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 简介补录卡 —— 全局常驻（跨左侧子节点可见） */}
      <div className="max-w-3xl mx-auto">
        <SynopsisCard projectId={projectId} confirmed={synopsisConfirmed} onConfirm={onSynopsisConfirm} />
      </div>

      <div className="flex items-center justify-between mb-5 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-serif font-semibold">{title}</h2>
          <div className="h-5 w-px bg-base-300/60" />
          <span className={`text-xs tracking-wide ${confirmed ? "text-success/60" : "text-base-content/20"}`}>
            {confirmed ? "已设定" : "待设定"}
          </span>
        </div>
        <ConfirmToggle confirmed={!!confirmed} onToggle={() => void handleConfirmToggle()} />
      </div>

      <div className="flex items-center gap-3 px-4 py-2 bg-base-200/40 border border-base-300/50 rounded-lg text-xs mb-5 max-w-3xl mx-auto">
        <span className="text-base-content/30 uppercase tracking-wider">版本</span>
        <span className="font-semibold text-primary">v1</span>
        <span className="text-base-content/20">· —</span>
        <div className="flex-1" />
      </div>

      <div className={`transition-opacity duration-300 ${confirmed ? "opacity-60" : "opacity-100"}`}>
        {settingKey === "world" && <WorldSettingForm ref={formRef} projectId={projectId} settingKey={settingKey} onDirtyChange={onDirtyChange} />}
        {settingKey === "style" && <StyleSettingForm ref={formRef} projectId={projectId} settingKey={settingKey} onDirtyChange={onDirtyChange} />}
        {settingKey === "anti-ai" && <AntiAiSettingForm ref={formRef} projectId={projectId} settingKey={settingKey} onDirtyChange={onDirtyChange} />}
        {settingKey === "hooks" && <HooksSettingForm ref={formRef} projectId={projectId} settingKey={settingKey} onDirtyChange={onDirtyChange} />}
        {settingKey === "ai-model" && <ModelSettingForm projectId={projectId} settingKey={settingKey} />}
        {settingKey === "genre" && <GenreSettingForm projectId={projectId} settingKey={settingKey} />}
      </div>
    </div>
  );
}
