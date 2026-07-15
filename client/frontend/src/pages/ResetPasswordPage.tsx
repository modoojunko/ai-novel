import { useState } from 'react';
import { request } from '../lib/api';

export default function ResetPasswordPage() {
  const [step, setStep] = useState<'username' | 'answer' | 'done'>('username');
  const [username, setUsername] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (!username.trim()) { setError('请输入用户名'); return; }
    setError('');
    setStep('answer');
  };

  const handleReset = async () => {
    if (!securityAnswer.trim()) { setError('请输入密保答案'); return; }
    if (newPassword.length < 6) { setError('密码至少 6 位'); return; }
    setLoading(true);
    setError('');
    const res = await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        security_answer: securityAnswer.trim(),
        new_password: newPassword,
      }),
    });
    setLoading(false);
    if (res.code === 0) {
      setStep('done');
    } else {
      setError(res.msg || '重置失败');
    }
  };

  if (step === 'done') {
    return (
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-success">密码已重置</h1>
            <a href="/#/login" className="btn btn-primary mt-4">去登录</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">重置密码</h2>
            {step === 'username' ? (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">用户名</span></label>
                  <input type="text" className="input input-bordered"
                    value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleNext}>下一步</button>
              </>
            ) : (
              <>
                <p className="text-sm">用户: {username}</p>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保答案</span></label>
                  <input type="text" className="input input-bordered"
                    value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">新密码</span></label>
                  <input type="password" className="input input-bordered" placeholder="至少 6 位"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleReset} disabled={loading}>
                  {loading ? <span className="loading loading-spinner" /> : '重置'}
                </button>
              </>
            )}
            <a href="/#/login" className="link link-hover text-sm">返回登录</a>
          </div>
        </div>
      </div>
    </div>
  );
}
