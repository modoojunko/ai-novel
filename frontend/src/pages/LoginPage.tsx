import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="card bg-base-200 border border-base-300 sm:max-w-md w-full mx-4 shadow-lg">
        <div className="card-body">
          <h2 className="card-title font-display">登录</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="邮箱"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="密码"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {error && <p className="text-error text-sm">{error}</p>}
            <button type="submit" className="btn btn-primary w-full">
              登录
            </button>
            <p className="text-sm text-center text-base-content/60">
              没有账号？{" "}
              <Link to="/register" className="link link-primary">
                注册
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
