import { useState } from 'react';
import { request } from '../lib/api';

export default function ActivatePage() {
  const [step, setStep] = useState<'code' | 'register' | 'done'>('code');
  const [activationCode, setActivationCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (!activationCode.trim()) { setError('请输入激活码'); return; }
    setError('');
    setStep('register');
  };

  const handleActivate = async () => {
    setError('');
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (!securityQuestion.trim()) { setError('请设置密保问题'); return; }
    if (!securityAnswer.trim()) { setError('请设置密保答案'); return; }
    setLoading(true);
    const res = await request('/auth/activate', {
      method: 'POST',
      body: JSON.stringify({
        activation_code: activationCode.trim().toUpperCase(),
        username: username.trim(),
        password,
        security_question: securityQuestion.trim(),
        security_answer: securityAnswer.trim(),
      }),
    });
    setLoading(false);
    if (res.code === 0) {
      setStep('done');
    } else {
      setError(res.msg || '激活失败');
    }
  };

  if (step === 'done') {
    return (
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-3xl font-bold text-success">🎉 激活成功！</h1>
            <p className="py-4">现在可以去设置 AI API Key 开始创作了</p>
            <button className="btn btn-primary" onClick={() => window.location.href = '/#/config'}>
              配置 API Key
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content flex-col">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold">AI Novel</h1>
          <p className="text-base-content/60">激活你的 License</p>
        </div>
        <div className="card w-full max-w-sm bg-base-100 shadow-xl">
          <div className="card-body">
            {step === 'code' ? (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">激活码</span></label>
                  <input type="text" className="input input-bordered font-mono" placeholder="AC-XXXX-YYYY-ZZZZ-WWWW"
                    value={activationCode} onChange={e => setActivationCode(e.target.value.toUpperCase())} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleNext}>下一步</button>
              </>
            ) : (
              <>
                <div className="form-control">
                  <label className="label"><span className="label-text">用户名</span></label>
                  <input type="text" className="input input-bordered" placeholder="给自己起个名字"
                    value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密码</span></label>
                  <input type="password" className="input input-bordered" placeholder="至少 6 位"
                    value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">确认密码</span></label>
                  <input type="password" className="input input-bordered"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保问题</span></label>
                  <input type="text" className="input input-bordered" placeholder="例如：我最喜欢的城市是？"
                    value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">密保答案</span></label>
                  <input type="text" className="input input-bordered"
                    value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} />
                </div>
                {error && <p className="text-error text-sm">{error}</p>}
                <button className="btn btn-primary mt-4" onClick={handleActivate} disabled={loading}>
                  {loading ? <span className="loading loading-spinner" /> : '激活并注册'}
                </button>
              </>
            )}
            <p className="text-xs text-base-content/40 text-center mt-2">
              没有激活码？<a href="https://taobao.com" className="link" target="_blank">前往淘宝购买</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
