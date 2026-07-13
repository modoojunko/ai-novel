import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';
import { setToken } from '../lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true);
    setError('');
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setLoading(false);
    if (res.code === 0) {
      setToken(res.data.token, username.trim());
      navigate('/dashboard');
    } else {
      setError(res.msg || '登录失败');
    }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">AI Novel</h1>
          <p className="text-base-content/60">登录你的账号</p>
        </div>
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="form-control">
              <label className="label"><span className="label-text">用户名</span></label>
              <input type="text" className="input input-bordered"
                value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">密码</span></label>
              <input type="password" className="input input-bordered"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {error && <p className="text-error text-sm">{error}</p>}
            <button className="btn btn-primary mt-4" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="loading loading-spinner" /> : '登录'}
            </button>
            <div className="flex justify-between mt-2 text-sm">
              <a href="/#/activate" className="link link-hover">激活新 License</a>
              <a href="/#/reset-password" className="link link-hover">忘记密码？</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
