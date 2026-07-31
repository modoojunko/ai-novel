import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { toast } from '../lib/toast';
import { useDeviceActivation } from '../hooks/useDeviceActivation';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const { refreshStatus, showToast } = useDeviceActivation();

  // 静默检测：当前浏览器在 S端 是否已登录
  useEffect(() => {
    // 如果用户刚手动退出，跳过自动检测，让用户看到登录按钮
    if (sessionStorage.getItem("manual_logout")) {
      sessionStorage.removeItem("manual_logout");
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const res = await request('/auth/check-auth');
        if (res.code === 0 && res.data?.token && res.data.token !== 'dev-token') {
          localStorage.setItem('auth_token', res.data.token);
          if (res.data.username) localStorage.setItem('auth_username', res.data.username);
          toast.success('自动登录成功');
          // 获取设备激活状态
          const devStatus = await refreshStatus();
          if (devStatus) showToast(devStatus);
          navigate('/novels', { replace: true });
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
    try {
      const res = await request('/auth/browser-auth', { method: 'POST' });
      // 后端返回授权页 URL（宿主浏览器打开），不在容器内开浏览器/轮询
      if (res.code === 0 && res.data?.token) {
        // 已有会话
        localStorage.setItem('auth_token', res.data.token);
        toast.success('登录成功');
        const devStatus = await refreshStatus();
        if (devStatus) showToast(devStatus);
        navigate('/novels', { replace: true });
        return;
      }
      const authUrl = res.data?.auth_url;
      if (authUrl) window.open(authUrl, '_blank');

      // 前端轮询 check-auth 直到授权成功
      let ok = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const check = await request('/auth/check-auth');
        if (check.code === 0 && check.data?.token) {
          localStorage.setItem('auth_token', check.data.token);
          toast.success('登录成功');
          const devStatus = await refreshStatus();
          if (devStatus) showToast(devStatus);
          navigate('/novels', { replace: true });
          ok = true;
          break;
        }
      }
      if (!ok) setError('授权超时，请在浏览器中完成登录');
    } catch {
      setError('登录失败');
    } finally {
      setLoading(false);
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
        {error && <p className="text-error text-sm mt-2">{error}</p>}
        <p className="text-xs text-base-content/40 mt-4">将在系统浏览器中打开登录页面</p>
      </div>
    </div>
  );
}
