import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { toast } from '../lib/toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBrowserAuth = async () => {
    setLoading(true);
    setError('');
    const res = await request('/auth/browser-auth', { method: 'POST' });
    setLoading(false);
    if (res.code === 0) {
      toast.success('登录成功');
      navigate('/dashboard');
    } else {
      setError(res.msg || '登录失败');
    }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col text-center">
        <h1 className="text-3xl font-bold">AI Novel</h1>
        <p className="text-base-content/60 mb-6">登录以授权此设备</p>
        <button className="btn btn-primary btn-lg" onClick={handleBrowserAuth} disabled={loading}>
          {loading ? <span className="loading loading-spinner" /> : '打开浏览器登录'}
        </button>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
        <p className="text-xs text-base-content/40 mt-4">将在系统浏览器中打开登录页面</p>
      </div>
    </div>
  );
}
