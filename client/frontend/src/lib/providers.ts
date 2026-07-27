/* AI 服务商配置常量 */

import type { VendorId } from '../types/api-config';

export interface Provider {
  id: VendorId;
  label: string;
  description: string;
  tag: string;
  baseUrl: string;
  defaultModel: string;
  signupUrl: string;
  hasApiKey: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek（推荐）',
    description: '价格便宜，中文效果好，新用户送 500 万 Token',
    tag: '性价比之选',
    baseUrl: 'https://api.deepseek.com/anthropic',
    defaultModel: 'deepseek-v4-flash',
    signupUrl: 'https://platform.deepseek.com',
    hasApiKey: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: '全球最强模型，中文支持好',
    tag: '通用之选',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    signupUrl: 'https://platform.openai.com',
    hasApiKey: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: '写作质量最高，适合专业作家',
    tag: '专业之选',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    signupUrl: 'https://console.anthropic.com',
    hasApiKey: true,
  },
  {
    id: 'glm',
    label: 'GLM (智谱)',
    description: '国产大模型，中文理解和生成能力出色',
    tag: '国产之选',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    signupUrl: 'https://open.bigmodel.cn',
    hasApiKey: true,
  },
  {
    id: 'kimi',
    label: 'Kimi (月之暗面)',
    description: '长上下文能力强，适合处理长篇内容',
    tag: '长文利器',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    signupUrl: 'https://platform.moonshot.cn',
    hasApiKey: true,
  },
  {
    id: 'qwen',
    label: 'Qwen (通义千问)',
    description: '阿里云出品，综合能力强',
    tag: '阿里出品',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    signupUrl: 'https://www.aliyun.com/product/qwen',
    hasApiKey: true,
  },
  {
    id: 'ollama',
    label: 'Ollama (本地)',
    description: '本地运行开源模型，无需联网，完全免费',
    tag: '本地运行',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3',
    signupUrl: 'https://ollama.ai',
    hasApiKey: false,
  },
  {
    id: 'openai-compat',
    label: 'OpenAI 兼容',
    description: '兼容 OpenAI API 格式的任意服务商',
    tag: '自定义',
    baseUrl: '',
    defaultModel: '',
    signupUrl: '',
    hasApiKey: true,
  },
];
