import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { api } from '../lib/api';
import { setToken } from '../lib/auth';
import { toast } from '../lib/toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<'email' | 'displayName' | 'password' | 'confirmPassword', string>>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!email) {
      errors.email = '请输入邮箱';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = '邮箱格式不正确';
    }

    if (!password) {
      errors.password = '请输入密码';
    } else if (password.length < 6) {
      errors.password = '密码至少6位';
    }

    if (!confirmPassword) {
      errors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = '两次密码不一致';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        email,
        password,
        display_name: displayName || undefined,
      });
      const token = res.token || res.access_token;
      const username = res.user?.display_name || displayName || email.split('@')[0];
      if (token) setToken(token, username);
      toast.success('注册成功');
      navigate('/books');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('已注册')) {
        setError('该邮箱已被注册');
      } else {
        toast.error(msg || '注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero min-h-screen bg-base-200">
      <div className="hero-content w-full max-w-md">
        <div className="card bg-base-100 shadow-xl w-full">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold">注册爱小说</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 邮箱 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">邮箱</span>
                </label>
                <input
                  type="email"
                  className={`input input-bordered${fieldErrors.email ? ' input-error' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱"
                  autoComplete="email"
                />
                {fieldErrors.email && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.email}</span>
                  </label>
                )}
              </div>

              {/* 昵称（选填） */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">昵称（选填）</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="请输入昵称"
                  autoComplete="name"
                />
              </div>

              {/* 密码 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">密码</span>
                </label>
                <input
                  type="password"
                  className={`input input-bordered${fieldErrors.password ? ' input-error' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少6位密码"
                  autoComplete="new-password"
                />
                {fieldErrors.password && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.password}</span>
                  </label>
                )}
              </div>

              {/* 确认密码 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">确认密码</span>
                </label>
                <input
                  type="password"
                  className={`input input-bordered${fieldErrors.confirmPassword ? ' input-error' : ''}`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  autoComplete="new-password"
                />
                {fieldErrors.confirmPassword && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.confirmPassword}</span>
                  </label>
                )}
              </div>

              {/* 服务端错误 */}
              {error && (
                <div className="alert alert-error py-2">
                  <span>{error}</span>
                </div>
              )}

              {/* 提交按钮 */}
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? <span className="loading loading-spinner" /> : '注册'}
              </button>
            </form>

            <div className="divider my-4" />

            <p className="text-center text-sm text-base-content/60">
              已有账号？
              <Link to="/login" className="link link-primary ml-1">去登录</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
