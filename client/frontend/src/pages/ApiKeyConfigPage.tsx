import { useState, useEffect } from 'react';
import { request } from '../lib/api';

export default function ApiKeyConfigPage() {
  const [apiKey, setApiKey] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.deepseek.com/anthropic');
  const [apiModel, setApiModel] = useState('deepseek-v4-flash');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request('/auth/config').then((res: any) => {
      if (res.api_base_url) setApiBaseUrl(res.api_base_url);
      if (res.api_model) setApiModel(res.api_model);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) { alert('请输入 API Key'); return; }
    await request('/auth/config/api-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey.trim(), api_base_url: apiBaseUrl.trim(), api_model: apiModel.trim() }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI 模型配置</h1>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="form-control">
            <label className="label"><span className="label-text">API Key</span></label>
            <input type="password" className="input input-bordered" placeholder="sk-..."
              value={apiKey} onChange={e => setApiKey(e.target.value)} />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">API 地址</span></label>
            <input type="text" className="input input-bordered"
              value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} />
            <label className="label">
              <span className="label-text-alt text-base-content/50">例如: https://api.deepseek.com/anthropic</span>
            </label>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">模型名</span></label>
            <input type="text" className="input input-bordered"
              value={apiModel} onChange={e => setApiModel(e.target.value)} />
          </div>
          <button className="btn btn-primary mt-4" onClick={handleSave}>
            {saved ? '✅ 已保存' : '保存配置'}
          </button>
        </div>
      </div>
      <div className="mt-6 p-4 bg-base-200 rounded-lg text-sm">
        <p className="font-bold mb-2">支持的 AI 供应商</p>
        <ul className="list-disc list-inside space-y-1 text-base-content/70">
          <li>DeepSeek (Anthropic 格式): <code className="bg-base-300 px-1 rounded">https://api.deepseek.com/anthropic</code></li>
          <li>OpenAI: <code className="bg-base-300 px-1 rounded">https://api.openai.com/v1</code></li>
          <li>Anthropic: <code className="bg-base-300 px-1 rounded">https://api.anthropic.com/v1</code></li>
          <li>任意兼容 OpenAI/Anthropic 格式的 API</li>
        </ul>
      </div>
    </div>
  );
}
