import { useState } from "react";
import WorldSettingForm from "./settings/WorldSettingForm";
import StyleSettingForm from "./settings/StyleSettingForm";
import AntiAiSettingForm from "./settings/AntiAiSettingForm";
import HooksSettingForm from "./settings/HooksSettingForm";
import CharacterManager from "./settings/CharacterManager";
import ConfirmToggle from "./settings/ConfirmToggle";
import AIGenerateProgress from "./settings/AIGenerateProgress";
import { api } from "@/lib/api";
import ModelSettingForm from "./settings/ModelSettingForm";
import GenreSettingForm from "./settings/GenreSettingForm";
import { Sparkles, Brain } from "lucide-react";

const TITLE_MAP: Record<string, string> = {
  genre: "📖 题材设定",
  world: "🌍 世界设定",
  style: "✍️ 写作风格",
  "anti-ai": "🛡️ AI痕迹控制",
  hooks: "⚓ 伏笔管理",
  characters: "👥 角色管理",
  "ai-model": "🧠 AI 模型",
};

const ALL_TYPES = [
  { type: "genre", label: "题材设定" },
  { type: "world", label: "世界设定" },
  { type: "style", label: "写作风格" },
  { type: "anti-ai", label: "AI痕迹控制" },
  { type: "hooks", label: "伏笔管理" },
  { type: "characters", label: "角色管理" },
  { type: "ai-model", label: "AI 模型" },
] as const;

type StepItem = (typeof ALL_TYPES)[number] & { status: "pending" | "loading" | "done" | "error" };

interface SettingsFormFieldProps {
  projectId: string;
  settingKey: string;
  confirmed?: boolean;
  onConfirm?: () => void;
}

export default function SettingsFormField({ projectId, settingKey, confirmed, onConfirm }: SettingsFormFieldProps) {
  const title = TITLE_MAP[settingKey] || settingKey;
  const [showGenerate, setShowGenerate] = useState(false);
  const [genSteps, setGenSteps] = useState<StepItem[]>(() =>
    ALL_TYPES.map((t) => ({ ...t, status: "pending" as const }))
  );
  const [genRunning, setGenRunning] = useState(false);

  async function handleGenerateAll() {
    setShowGenerate(true);
    setGenRunning(true);
    setGenSteps(ALL_TYPES.map((t) => ({ ...t, status: "pending" as const })));

    for (const t of ALL_TYPES) {
      setGenSteps((prev) =>
        prev.map((s) => (s.type === t.type ? { ...s, status: "loading" as const } : s))
      );
      try {
        const res = await api.post(`/novels/${projectId}/settings/generate`, {
          types: [t.type],
        });
        if (res[t.type] && !res[t.type]._error) {
          await api.put(`/novels/${projectId}/settings/${t.type}`, res[t.type]);
          setGenSteps((prev) =>
            prev.map((s) => (s.type === t.type ? { ...s, status: "done" as const } : s))
          );
        } else {
          setGenSteps((prev) =>
            prev.map((s) => (s.type === t.type ? { ...s, status: "error" as const } : s))
          );
        }
      } catch {
        setGenSteps((prev) =>
          prev.map((s) => (s.type === t.type ? { ...s, status: "error" as const } : s))
        );
      }
    }

    setGenRunning(false);
  }

  if (settingKey === "characters") {
    return <CharacterManager projectId={projectId} confirmed={confirmed} onConfirm={onConfirm} />;
  }

  return (
    <div className="p-6">
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

      <div className="mb-5 max-w-3xl mx-auto">
        <button
          onClick={handleGenerateAll}
          disabled={genRunning}
          className="w-full px-4 py-3 bg-primary/5 border border-primary/20 border-dashed rounded-xl text-sm text-primary/70 hover:text-primary hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Sparkles className="w-4 h-4" />
          {genRunning ? "AI 生成中…" : "✨ AI 一键生成全部设定"}
        </button>
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

      <AIGenerateProgress
        open={showGenerate}
        steps={genSteps}
        onClose={() => setShowGenerate(false)}
      />
    </div>
  );
}
