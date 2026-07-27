import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { toast } from '../lib/toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  // 静默检测：当前浏览器在 S端 是否已登录
  useEffect(() => {
    (async () => {
      try {
        const res = await request('/auth/check-auth');
        if (res.code === 0 && res.data?.token && res.data.token !== 'dev-token') {
          localStorage.setItem('auth_token', res.data.token);
          if (res.data.username) localStorage.setItem('auth_username', res.data.username);
          toast.success('自动登录成功');
          navigate('/books');
          return;
        }
      } catch {
        // S端 不可用或未登录，用户手动点击按钮
      }
      setChecking(false);
    })();
  }, []);

  const handleBrowserAuth = async () => {
    setLoading(true);
    setError('');
    const res = await request('/auth/browser-auth', { method: 'POST' });
    setLoading(false);
    if (res.code === 0) {
      if (res.data?.token) localStorage.setItem('auth_token', res.data.token);
      toast.success('登录成功');
      navigate('/books');
    } else {
      setError(res.msg || '登录失败');
    }
  };

  if (checking) {
    return (
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col text-center">
        <h1 className="text-3xl font-bold">爱小说</h1>
        <p className="text-base-content/60 mb-6">登录后即可开始创作</p>
        <button className="btn btn-primary btn-lg" onClick={handleBrowserAuth} disabled={loading}>
          {loading ? <span className="loading loading-spinner" /> : '打开浏览器登录'}
        </button>
        <p className="text-xs text-base-content/40 mt-2">
          还未注册？<Link to="/register" className="link link-primary">去注册</Link>
        </p>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
        <p className="text-xs text-base-content/40 mt-4">将在系统浏览器中打开登录页面</p>
      </div>
    </div>
  );
}
