import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { PROVIDERS } from "@/lib/providers";
import { Brain, Info, Sparkles, ChevronDown } from "lucide-react";

interface ModelSettingFormProps {
  projectId: string;
  settingKey: string;
}

const MODEL_OPTIONS = [
  { value: "sonnet-4", label: "Sonnet 4 — 平衡之选（推荐）", desc: "平衡速度与质量的优选模型。中文写作表现优秀，既能理解复杂的剧情设定，又能产出流畅自然的叙述文字。适合多数写作场景。" },
  { value: "haiku-3.5", label: "Haiku 3.5 — 快速草稿", desc: "轻量快速模型，适合生成草稿、大纲和灵感发散。响应速度快，适合需要大量试写的场景。" },
  { value: "deepseek-v4-flash", label: "DeepSeek V4 — 性价比之选", desc: "高性价比模型，擅长逻辑严密的叙事。适合架构复杂的长篇故事。" },
  { value: "gpt-4o", label: "GPT-4o — 通用之选", desc: "OpenAI 通用旗舰模型，各方面表现均衡，支持多模态理解。" },
];

export default function ModelSettingForm({ projectId }: ModelSettingFormProps) {
  const [selectedModel, setSelectedModel] = useState("sonnet-4");
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [globalDefault, setGlobalDefault] = useState("sonnet-4");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current setting
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.get(`/projects/${projectId}/settings/ai-model`).catch(() => ({})),
      api.get("/auth/config").catch(() => ({})),
    ])
      .then(([modelData, config]: [any, any]) => {
        if (modelData?.model) {
          setSelectedModel(modelData.model);
          setOverrideEnabled(true);
        }
        if (config?.api_model) {
          setGlobalDefault(config.api_model);
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // Save when model changes
  const handleModelChange = useCallback(
    async (model: string) => {
      setSelectedModel(model);
      if (!overrideEnabled) return;
      setSaving(true);
      try {
        await api.put(`/projects/${projectId}/settings/ai-model`, {
          model,
          override: true,
        });
      } catch {
        // ignore
      } finally {
        setSaving(false);
      }
    },
    [projectId, overrideEnabled],
  );

  const handleToggleOverride = useCallback(
    async (enabled: boolean) => {
      setOverrideEnabled(enabled);
      if (enabled) {
        setSaving(true);
        try {
          await api.put(`/projects/${projectId}/settings/ai-model`, {
            model: selectedModel,
            override: true,
          });
        } catch {
          // ignore
        } finally {
          setSaving(false);
        }
      } else {
        // Remove per-novel override
        try {
          await api.put(`/projects/${projectId}/settings/ai-model`, {
            model: "",
            override: false,
          });
        } catch {
          // ignore
        }
      }
    },
    [projectId, selectedModel],
  );

  const currentModelInfo = MODEL_OPTIONS.find((m) => m.value === selectedModel);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="loading loading-spinner loading-sm text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-setting-key="ai-model">
      {/* Model selector */}
      <div>
        <label className="block text-sm font-medium text-base-content/80 mb-2">
          当前小说使用模型
          <span className="text-xs text-base-content/40 ml-2 font-normal">
            仅影响这部作品
          </span>
        </label>
        <div className="relative">
          <div className="flex items-center border border-base-300 rounded-lg bg-base-100/50 px-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <Brain className="w-4 h-4 text-base-content/40 shrink-0" />
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={!overrideEnabled || saving}
              className="flex-1 border-none bg-transparent py-2.5 px-2 text-sm text-base-content outline-none appearance-none cursor-pointer disabled:opacity-50"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-base-content/30 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Model info card */}
      {currentModelInfo && overrideEnabled && (
        <div className="flex items-start gap-3 p-4 bg-base-200/40 border border-base-300/60 rounded-lg">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-base-content">
              {currentModelInfo.label.split(" — ")[0]}
            </div>
            <div className="text-xs text-base-content/60 leading-relaxed mt-0.5">
              {currentModelInfo.desc}
            </div>
          </div>
        </div>
      )}

      {/* Per-novel override toggle */}
      <div className="flex items-center gap-3 py-1">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={overrideEnabled}
            onChange={(e) => handleToggleOverride(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-base-300 rounded-full peer peer-checked:bg-primary/70 peer-focus:ring-2 peer-focus:ring-primary/20 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
        </label>
        <div>
          <div className="text-sm text-base-content/80">为此小说单独设置模型</div>
          <div className="text-xs text-base-content/40">
            {overrideEnabled ? "关闭后将使用全局默认模型" : "开启后可为此小说单独指定模型"}
          </div>
        </div>
      </div>

      {/* Global default notice */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-700/20 rounded-lg text-sm text-base-content/70">
        <Info className="w-4 h-4 text-amber-600/60 shrink-0" />
        <span>
          当前全局默认：<strong>{globalDefault}</strong>（可在"AI 写作设置"中修改全局默认值）
        </span>
      </div>
    </div>
  );
}
