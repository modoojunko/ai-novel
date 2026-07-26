import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { PROVIDERS, type Provider } from '../lib/providers';
import { toast } from '../lib/toast';

export default function ApiKeyConfigPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'config' | 'done'>('select');
  const [selected, setSelected] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request('/auth/config').then((cfg: any) => {
      setLoading(false);
      if (cfg.api_base_url) {
        const p = PROVIDERS.find((pr) => cfg.api_base_url.includes(pr.id));
        if (p) {
          setSelected(p);
          setBaseUrl(cfg.api_base_url);
          setModel(cfg.api_model || p.defaultModel);
          setStep('config');
        }
      }
    });
  }, []);

  const handleSelect = (p: Provider) => {
    setSelected(p);
    setBaseUrl(p.baseUrl);
    setModel(p.defaultModel);
    setApiKey('');
    setStep('config');
  };

  const handleVerifyAndSave = async () => {
    if (!apiKey.trim()) { toast.error('请输入 API Key'); return; }
    setVerifying(true);
    try {
      const res = await request('/auth/verify-key', {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKey.trim(), api_base_url: baseUrl }),
      });
      if (res.valid) {
        await request('/auth/config/api-key', {
          method: 'POST',
          body: JSON.stringify({ api_key: apiKey.trim(), api_base_url: baseUrl, api_model: model }),
        });
        toast.success('配置成功！');
        navigate('/books');
      } else {
        toast.error(res.error || 'Key 验证失败，请检查后重试');
      }
    } catch {
      toast.error('验证请求失败，请检查网络');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><span className="loading loading-spinner loading-lg" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">✨ AI 写作设置</h1>
      <p className="text-base-content/60 mb-6">
        爱小说需要接入 AI 才能帮你写作。选择下方的服务商，填入你的密钥即可开始。
      </p>

      {step === 'select' && (
        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <div
              key={p.id}
              className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary"
              onClick={() => handleSelect(p)}
            >
              <div className="card-body p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{p.label}</h3>
                    <p className="text-sm text-base-content/70 mt-1">{p.description}</p>
                  </div>
                  <span className="badge badge-primary badge-sm">{p.tag}</span>
                </div>
                <a href={p.signupUrl} target="_blank" rel="noopener noreferrer"
                  className="link link-primary text-sm mt-2 inline-block"
                  onClick={(e) => e.stopPropagation()}>
                  去 {p.label.split('（')[0]} 注册 →
                </a>
              </div>
            </div>
          ))}
          <p className="text-sm text-center mt-4">
            <button className="link link-hover" onClick={() => navigate('/books')}>
              稍后再说
            </button>
          </p>
        </div>
      )}

      {step === 'config' && selected && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="badge badge-primary mb-3">已选: {selected.label}</div>
            <div className="form-control">
              <label className="label"><span className="label-text">API Key</span></label>
              <input type="password" className="input input-bordered font-mono" placeholder="sk-..."
                value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">API 地址</span></label>
              <input type="text" className="input input-bordered bg-base-200" value={baseUrl} disabled />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">模型</span></label>
              <input type="text" className="input input-bordered bg-base-200" value={model} disabled />
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn btn-primary flex-1" onClick={handleVerifyAndSave} disabled={verifying}>
                {verifying ? <span className="loading loading-spinner" /> : '保存并测试连接'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setStep('select'); setSelected(null); }}>
                返回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
