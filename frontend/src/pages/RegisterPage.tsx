import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "@/lib/auth";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await register(email, password, displayName);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="card bg-base-200 border border-base-300 sm:max-w-md w-full mx-4 shadow-lg">
        <div className="card-body">
          <h2 className="card-title font-serif">创建账号</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="昵称"
              className="input input-bordered w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
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
              placeholder="密码（至少 8 位）"
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {error && <p className="text-error text-sm">{error}</p>}
            <button type="submit" className="btn btn-primary w-full">
              创建账号
            </button>
            <p className="text-sm text-center text-base-content/60">
              已有账号？{" "}
              <Link to="/login" className="link link-primary">
                登录
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
