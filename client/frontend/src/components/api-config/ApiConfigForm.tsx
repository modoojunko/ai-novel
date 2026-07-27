import { useState } from "react";
import type { ApiConfig } from "../../types/api-config";
import { ProviderIcon, VENDOR_LABELS } from "./ProviderIcon";

interface ApiConfigFormProps {
  config?: ApiConfig; // If provided, edit mode
  onSubmit: (data: ApiConfigFormData) => Promise<void>;
  onCancel: () => void;
}

export interface ApiConfigFormData {
  name: string;
  vendor_id: string;
  base_url: string;
  api_key: string;
}

const VENDORS = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com" },
  { id: "glm", label: "GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "kimi", label: "Kimi", baseUrl: "https://api.moonshot.cn/v1" },
  { id: "qwen", label: "Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434" },
  { id: "openai-compat", label: "OpenAI 兼容", baseUrl: "" },
];

export function ApiConfigForm({ config, onSubmit, onCancel }: ApiConfigFormProps) {
  const isEdit = !!config;
  const [name, setName] = useState(config?.name || "");
  const [vendorId, setVendorId] = useState(config?.vendor || "");
  const [baseUrl, setBaseUrl] = useState(config?.base_url || "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVendor = VENDORS.find((v) => v.id === vendorId);

  const handleVendorSelect = (id: string) => {
    if (isEdit) return;
    setVendorId(id);
    const v = VENDORS.find((x) => x.id === id);
    if (v && v.baseUrl) {
      setBaseUrl(v.baseUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("请输入配置名称"); return; }
    if (!vendorId) { setError("请选择供应商"); return; }
    if (!baseUrl.trim()) { setError("请输入 Base URL"); return; }
    // edit mode: empty api key means keep the existing key
    if (!isEdit && vendorId !== "ollama" && !apiKey.trim()) { setError("请输入 API Key"); return; }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), vendor_id: vendorId, base_url: baseUrl.trim(), api_key: apiKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="alert alert-error text-sm">{error}</div>}

      {/* Name */}
      <div className="form-control">
        <label className="label"><span className="label-text">配置名称</span></label>
        <input
          className="input input-bordered"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：我的 OpenAI"
          disabled={saving}
          required
        />
      </div>

      {/* Vendor selector (only in create mode) */}
      {!isEdit && (
        <div className="form-control">
          <label className="label"><span className="label-text">供应商</span></label>
          <div className="grid grid-cols-4 gap-2">
            {VENDORS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`btn btn-outline btn-sm flex-col gap-1 h-auto py-3 ${vendorId === v.id ? "btn-primary" : ""}`}
                onClick={() => handleVendorSelect(v.id)}
              >
                <ProviderIcon vendor={v.id as any} size={24} />
                <span className="text-xs">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit mode: show selected vendor */}
      {isEdit && selectedVendor && (
        <div className="form-control">
          <label className="label"><span className="label-text">供应商</span></label>
          <div className="flex items-center gap-2 p-3 bg-base-200 rounded-lg">
            <ProviderIcon vendor={config!.vendor} size={24} />
            <span>{selectedVendor.label}</span>
          </div>
        </div>
      )}

      {/* Base URL */}
      <div className="form-control">
        <label className="label"><span className="label-text">Base URL</span></label>
        <input
          className="input input-bordered"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com"
          disabled={saving}
          required
        />
      </div>

      {/* API Key */}
      <div className="form-control">
        <label className="label"><span className="label-text">API Key</span></label>
        <input
          className="input input-bordered"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={vendorId === "ollama" ? "Ollama 不需要 API Key" : isEdit ? "留空则保留当前密钥" : "sk-..."}
          disabled={saving || vendorId === "ollama"}
          required={!isEdit && vendorId !== "ollama"}
        />
        {isEdit && config?.api_key_masked && (
          <label className="label">
            <span className="label-text-alt text-base-content/50">
              当前密钥：{config.api_key_masked}
            </span>
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="loading loading-spinner" /> : null}
          {isEdit ? "保存" : "保存并测试连接"}
        </button>
      </div>
    </form>
  );
}
