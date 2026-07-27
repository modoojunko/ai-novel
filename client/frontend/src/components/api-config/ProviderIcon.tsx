import type { VendorId } from "../../types/api-config";

interface ProviderIconProps {
  vendor: VendorId;
  size?: number;
}

const ICONS = {
  openai: "⚡",
  anthropic: "🤖",
  deepseek: "🔍",
  glm: "📊",
  kimi: "🌙",
  qwen: "🐉",
  ollama: "🦙",
  "openai-compat": "🔗",
} satisfies Record<VendorId, string>;

export const VENDOR_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  glm: "GLM",
  kimi: "Kimi",
  qwen: "Qwen",
  ollama: "Ollama",
  "openai-compat": "OpenAI 兼容",
} satisfies Record<VendorId, string>;

export function ProviderIcon({ vendor, size = 36 }: ProviderIconProps) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-base-200 text-base-content"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      title={VENDOR_LABELS[vendor] || vendor}
    >
      {ICONS[vendor] || "🔗"}
    </div>
  );
}
