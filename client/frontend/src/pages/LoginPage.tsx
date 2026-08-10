import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { toast } from '../lib/toast';
import { useDeviceActivation } from '../hooks/useDeviceActivation';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const { refreshStatus, showToast } = useDeviceActivation();

  /** 单次探测 S端 授权状态；成功则写入 token 并跳转 */
  const checkAuthorized = useCallback(async (): Promise<boolean> => {
    try {
      const check = await request('/auth/check-auth');
      if (check.code === 0 && check.data?.token) {
        localStorage.setItem('auth_token', check.data.token);
        if (check.data?.username) localStorage.setItem('auth_username', check.data.username);
        toast.success('登录成功');
        cancelledRef.current = true;
        const devStatus = await refreshStatus();
        if (devStatus) showToast(devStatus);
        navigate('/novels', { replace: true });
        return true;
      }
    } catch {
      // S端 暂时不可用，继续轮询
    }
    return false;
  }, [navigate, refreshStatus, showToast]);

  /** 轮询授权状态，最长 120 秒；供「打开浏览器登录」与「重新检测」共用 */
  const startPolling = useCallback(async () => {
    setLoading(true);
    setError('');
    cancelledRef.current = false;
    for (let i = 0; i < 60; i++) {
      if (cancelledRef.current) return;
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelledRef.current) return;
      if (await checkAuthorized()) return;
    }
    if (!cancelledRef.current) {
      setError('授权超时：请确认已在浏览器中完成登录，然后点击「重新检测」。');
      setLoading(false);
    }
  }, [checkAuthorized]);

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
    setAuthUrl(null);
    cancelledRef.current = false;
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
      if (authUrl) {
        setAuthUrl(authUrl);
        window.open(authUrl, '_blank');
        await startPolling();
      } else {
        setError('无法获取授权页面，请稍后重试。');
        setLoading(false);
      }
    } catch {
      setError('登录请求失败，请稍后重试。');
      setLoading(false);
    }
  };

  /** 用户已完成浏览器授权后手动触发检测 */
  const handleIHaveAuthorized = useCallback(async () => {
    setError('');
    const ok = await checkAuthorized();
    if (!ok) {
      setError('还没检测到登录状态，请确认已在弹出的浏览器窗口中完成授权后再点一次。');
    }
  }, [checkAuthorized]);

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
        {loading ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {authUrl ? (
              <>
                <div className="alert alert-info text-left shadow-sm w-full">
                  <div>
                    <span className="font-medium">授权页已打开</span>
                    <p className="text-xs text-base-content/60 mt-1">
                      请在弹出的浏览器窗口中完成登录，完成后回到这里继续。
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-primary w-full"
                  onClick={handleIHaveAuthorized}
                >
                  我已授权，继续
                </button>
                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary text-sm"
                >
                  重新打开授权页
                </a>
              </>
            ) : (
              <span className="loading loading-spinner loading-lg text-primary" />
            )}
            {error && <p className="text-error text-sm mt-2">{error}</p>}
          </div>
        ) : (
          <>
            <button className="btn btn-primary btn-lg" onClick={handleBrowserAuth}>
              打开浏览器登录
            </button>
            {authUrl && (
              <button className="btn btn-ghost btn-sm mt-1" onClick={startPolling}>
                重新检测
              </button>
            )}
            {error && <p className="text-error text-sm mt-2">{error}</p>}
            <p className="text-xs text-base-content/40 mt-4">将在系统浏览器中打开登录页面</p>
          </>
        )}
      </div>
    </div>
  );
}
