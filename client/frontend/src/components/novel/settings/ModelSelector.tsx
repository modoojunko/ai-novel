import type { FlatModelOption } from "../../../types/api-config";

interface ModelSelectorProps {
  options: FlatModelOption[];
  currentConfigId: string | null;
  currentModel: string | null;
  onSelect: (apiConfigId: string, model: string) => void;
  loading?: boolean;
}

export function ModelSelector({
  options,
  currentConfigId,
  currentModel,
  onSelect,
  loading,
}: ModelSelectorProps) {
  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="text-sm text-base-content/50 text-center py-6">
        <p>暂无可用模型</p>
        <a href="/config" className="link link-primary text-xs mt-1 inline-block">
          请先配置 API Key
        </a>
      </div>
    );
  }

  // Group by config
  const grouped: Record<string, FlatModelOption[]> = {};
  for (const opt of options) {
    if (!grouped[opt.api_config_id]) grouped[opt.api_config_id] = [];
    grouped[opt.api_config_id].push(opt);
  }

  return (
    <div className="space-y-4 py-2">
      {Object.entries(grouped).map(([configId, models]) => (
        <div key={configId}>
          <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-2">
            {models[0].config_name}
          </div>
          <div className="space-y-1">
            {models.map((opt) => {
              const isSelected = configId === currentConfigId && opt.model === currentModel;
              return (
                <button
                  key={`${configId}-${opt.model}`}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                    isSelected
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-base-300 hover:border-base-content/30"
                  }`}
                  onClick={() => onSelect(configId, opt.model)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "border-primary bg-primary" : "border-base-300"
                      }`}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span>{opt.model}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
