import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { ArrowLeft, Loader2 } from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  plan: string;
  subscription_type: string;
  token_balance: number;
  total_tokens: number;
  is_lifetime: boolean;
  created_at: string | null;
}

interface TokenLog {
  id: string;
  user_id: string;
  operation: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string | null;
}

const PLAN_OPTIONS = [
  { value: "trial", label: "试用" },
  { value: "monthly", label: "月付" },
  { value: "quarterly", label: "季付" },
  { value: "yearly", label: "年付" },
  { value: "lifetime", label: "永久" },
];

const PLAN_LABELS: Record<string, string> = {
  trial: "试用", monthly: "月付", quarterly: "季付", yearly: "年付", lifetime: "永久",
};

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [logs, setLogs] = useState<TokenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      api.get(`/admin/users/${userId}`),
      api.get(`/admin/token-logs?user_id=${userId}&limit=50`),
    ])
      .then(([userData, logsData]) => {
        setUser(userData);
        setPlan(userData.subscription_type || "trial");
        setLogs(logsData);
      })
      .catch(() => toast.error("加载用户信息失败"))
      .finally(() => setLoading(false));
  }, [userId]);

  async function handlePlanChange() {
    if (!userId || !plan) return;
    setSavingPlan(true);
    try {
      await api.put(`/admin/users/${userId}/plan`, { subscription_type: plan });
      toast.success("套餐已更新");
    } catch (err: any) {
      toast.error(err.message || "更新失败");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleTopup() {
    if (!userId) return;
    const amount = parseInt(topupAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("请输入有效的点数");
      return;
    }
    setTopupLoading(true);
    try {
      const res = await api.post(`/admin/users/${userId}/topup`, { amount });
      setUser((prev) => prev ? { ...prev, token_balance: res.token_balance } : null);
      toast.success(`已充值 ${amount} Token`);
      setTopupAmount("");
    } catch (err: any) {
      toast.error(err.message || "充值失败");
    } finally {
      setTopupLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-base-content/50">用户不存在</p>
        <button className="btn btn-ghost btn-sm mt-4" onClick={() => navigate("/admin/users")}>
          返回用户列表
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn btn-ghost btn-sm gap-2 mb-6 text-base-content/50"
        onClick={() => navigate("/admin/users")}
      >
        <ArrowLeft className="w-4 h-4" />
        返回用户列表
      </button>

      <h1 className="text-2xl font-serif font-semibold mb-6">{user.display_name || user.email}</h1>

      {/* User info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-base-300/50 bg-base-100 p-4">
          <span className="text-xs text-base-content/40 uppercase">邮箱</span>
          <p className="font-mono text-sm mt-1">{user.email}</p>
        </div>
        <div className="rounded-xl border border-base-300/50 bg-base-100 p-4">
          <span className="text-xs text-base-content/40 uppercase">角色</span>
          <p className="mt-1">
            <span className={`badge badge-sm ${user.role === "admin" ? "badge-primary" : "badge-ghost"}`}>
              {user.role === "admin" ? "管理员" : "用户"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-base-300/50 bg-base-100 p-4">
          <span className="text-xs text-base-content/40 uppercase">状态</span>
          <p className="mt-1">
            <span className={`badge badge-sm ${user.status === "active" ? "badge-success" : "badge-warning"}`}>
              {user.status === "active" ? "正常" : "未激活"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-base-300/50 bg-base-100 p-4">
          <span className="text-xs text-base-content/40 uppercase">Token 余额</span>
          <p className="text-xl font-semibold mt-1 tabular-nums">{user.token_balance?.toLocaleString() ?? 0}</p>
        </div>
        <div className="rounded-xl border border-base-300/50 bg-base-100 p-4">
          <span className="text-xs text-base-content/40 uppercase">累计消耗</span>
          <p className="text-xl font-semibold mt-1 tabular-nums">{user.total_tokens?.toLocaleString() ?? 0}</p>
        </div>
        <div className="rounded-xl border border-base-300/50 bg-base-100 p-4">
          <span className="text-xs text-base-content/40 uppercase">注册时间</span>
          <p className="text-sm mt-1">{user.created_at ? new Date(user.created_at).toLocaleDateString("zh-CN") : "—"}</p>
        </div>
      </div>

      {/* Plan modification */}
      <div className="rounded-xl border border-base-300/50 bg-base-100 p-5 mb-8">
        <h2 className="font-medium mb-4">套餐管理</h2>
        <div className="flex items-end gap-3">
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">当前套餐: {PLAN_LABELS[user.subscription_type] || user.subscription_type || "无"}</span></label>
            <select
              className="select select-bordered select-sm w-40"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              {PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handlePlanChange}
            disabled={savingPlan || plan === user.subscription_type}
          >
            {savingPlan && <Loader2 className="w-3 h-3 animate-spin" />}
            更新套餐
          </button>
        </div>
      </div>

      {/* Top-up */}
      <div className="rounded-xl border border-base-300/50 bg-base-100 p-5 mb-8">
        <h2 className="font-medium mb-4">Token 充值</h2>
        <div className="flex items-end gap-3">
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs">充值点数</span></label>
            <input
              type="number"
              className="input input-bordered input-sm w-40"
              placeholder="输入数量"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTopup()}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleTopup}
            disabled={topupLoading || !topupAmount}
          >
            {topupLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            确认充值
          </button>
        </div>
      </div>

      {/* Token consumption history */}
      <div className="rounded-xl border border-base-300/50 bg-base-100 p-5">
        <h2 className="font-medium mb-4">Token 消耗记录</h2>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="text-base-content/50 text-xs uppercase">
                <th>操作</th>
                <th>模型</th>
                <th>输入 Token</th>
                <th>输出 Token</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="text-xs">{l.operation}</td>
                  <td className="font-mono text-xs">{l.model || "—"}</td>
                  <td className="tabular-nums text-xs">{l.tokens_in?.toLocaleString() ?? 0}</td>
                  <td className="tabular-nums text-xs">{l.tokens_out?.toLocaleString() ?? 0}</td>
                  <td className="text-xs text-base-content/50">
                    {l.created_at ? new Date(l.created_at).toLocaleString("zh-CN") : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-base-content/40">暂无记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
