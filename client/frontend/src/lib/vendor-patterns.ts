import type { VendorId } from '../types/api-config';

const VENDOR_URL_PATTERNS: Array<{ id: VendorId; pattern: RegExp }> = [
  { id: 'openai', pattern: /^https:\/\/api\.openai\.com/i },
  { id: 'anthropic', pattern: /^https:\/\/api\.anthropic\.com/i },
  { id: 'deepseek', pattern: /^https:\/\/api\.deepseek\.com/i },
  { id: 'glm', pattern: /^https:\/\/open\.bigmodel\.cn/i },
  { id: 'kimi', pattern: /^https:\/\/api\.moonshot\.cn/i },
  { id: 'qwen', pattern: /^https:\/\/dashscope\.aliyuncs\.com/i },
  { id: 'ollama', pattern: /^http:\/\/localhost:11434/i },
];

export function guessVendor(baseUrl: string): VendorId | null {
  for (const v of VENDOR_URL_PATTERNS) {
    if (v.pattern.test(baseUrl)) return v.id;
  }
  return null;
}
