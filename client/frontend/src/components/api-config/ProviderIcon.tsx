import type { VendorId } from "../../types/api-config";
import { Ico, VENDOR_ICON } from "../icons";

export const VENDORS = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com" },
  { id: "anthropic", label: "Anthropic", baseUrl: "https://api.anthropic.com" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com" },
  { id: "glm", label: "GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "kimi", label: "Kimi", baseUrl: "https://api.moonshot.cn/v1" },
  { id: "qwen", label: "Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "ollama", label: "Ollama", baseUrl: "http://localhost:11434" },
  { id: "openai-compat", label: "OpenAI 兼容", baseUrl: "" },
] as const;

export const VENDOR_LABELS: Record<VendorId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  glm: "GLM",
  kimi: "Kimi",
  qwen: "Qwen",
  ollama: "Ollama",
  "openai-compat": "OpenAI 兼容",
};

/** 供应商图标（model-config.html iconSvg 原样：1.7 圆头线帽，尺寸由上下文 CSS 控制） */
export function VendorGlyph({ vendor }: { vendor: string }) {
  return <Ico d={VENDOR_ICON[vendor] || VENDOR_ICON["openai-compat"]} sw={1.7} round />;
}

/** 配置卡左上角的供应商格（.pv-icon 38px） */
export function ProviderIcon({ vendor }: { vendor: VendorId }) {
  return (
    <span className="pv-icon" title={VENDOR_LABELS[vendor] || vendor}>
      <VendorGlyph vendor={vendor} />
    </span>
  );
}
