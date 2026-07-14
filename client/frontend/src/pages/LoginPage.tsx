import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'login' | 'create'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) { setError('请输入用户名和密码'); return; }
    setLoading(true); setError('');
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setLoading(false);
    if (res.code === 0) { navigate('/dashboard'); }
    else { setError(res.msg || '登录失败'); }
  };

  const handleRegister = async () => {
    setError('');
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (!securityQuestion.trim()) { setError('请设置密保问题'); return; }
    if (!securityAnswer.trim()) { setError('请设置密保答案'); return; }
    setLoading(true);
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(), password,
        security_question: securityQuestion.trim(),
        security_answer: securityAnswer.trim(),
      }),
    });
    setLoading(false);
    if (res.code === 0) { navigate('/config'); }
    else { setError(res.msg || '注册失败'); }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">AI Novel</h1>
          <p className="text-base-content/60">{step === 'login' ? '登录' : '创建账号'}</p>
        </div>
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            {step === 'login' ? (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">用户名</span></label>
                  <input type="text" className="input input-bordered" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密码</span></label>
                  <input type="password" className="input input-bordered" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleLogin} disabled={loading}>
                  {loading ? <span className="loading loading-spinner" /> : '登录'}
                </button>
                <p className="text-sm text-center mt-3">首次使用？<button className="link link-primary" onClick={() => { setStep('create'); setError(''); }}>创建账号</button></p>
              </>
            ) : (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">用户名</span></label>
                  <input type="text" className="input input-bordered" placeholder="给自己起个名字" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密码</span></label>
                  <input type="password" className="input input-bordered" placeholder="至少 6 位" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">确认密码</span></label>
                  <input type="password" className="input input-bordered" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保问题</span></label>
                  <input type="text" className="input input-bordered" placeholder="例如：我最喜欢的城市是？" value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保答案</span></label>
                  <input type="text" className="input input-bordered" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleRegister} disabled={loading}>
                  {loading ? <span className="loading loading-spinner" /> : '创建并登录'}
                </button>
                <p className="text-sm text-center mt-3">已有账号？<button className="link link-primary" onClick={() => { setStep('login'); setError(''); }}>去登录</button></p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
