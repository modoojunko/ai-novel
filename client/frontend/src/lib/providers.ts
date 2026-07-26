/* AI 服务商配置常量 */

export interface Provider {
  id: string;
  label: string;
  description: string;
  tag: string;
  baseUrl: string;
  defaultModel: string;
  signupUrl: string;
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
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: '全球最强模型，中文支持好',
    tag: '通用之选',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    signupUrl: 'https://platform.openai.com',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    description: '写作质量最高，适合专业作家',
    tag: '专业之选',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    signupUrl: 'https://console.anthropic.com',
  },
];
