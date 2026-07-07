import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Search } from "lucide-react";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  plan: string;
  subscription_type: string;
  token_balance: number;
  created_at: string | null;
}

const PAGE_SIZE = 20;

const ROLE_LABELS: Record<string, string> = { admin: "管理员", user: "用户" };
const STATUS_LABELS: Record<string, string> = { active: "正常", inactive: "未激活" };
const PLAN_LABELS: Record<string, string> = {
  trial: "试用", monthly: "月付", quarterly: "季付", yearly: "年付", lifetime: "永久",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/users?page=${page}`)
      .then((res: { users: User[]; total: number }) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = search
    ? users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div>
      <h1 className="text-2xl font-serif font-semibold mb-6">用户管理</h1>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
        <input
          className="input input-bordered input-sm w-full max-w-xs pl-9"
          placeholder="搜索邮箱…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300/50">
            <table className="table table-sm">
              <thead>
                <tr className="text-base-content/50 text-xs uppercase">
                  <th>邮箱</th>
                  <th>昵称</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>套餐</th>
                  <th>Token 余额</th>
                  <th>注册时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer hover:bg-base-200/80 transition-colors"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    <td className="font-mono text-xs">{u.email}</td>
                    <td>{u.display_name || "—"}</td>
                    <td>
                      <span className={`badge badge-xs ${u.role === "admin" ? "badge-primary" : "badge-ghost"}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-xs ${u.status === "active" ? "badge-success" : "badge-warning"}`}>
                        {STATUS_LABELS[u.status] || u.status}
                      </span>
                    </td>
                    <td className="text-xs">{PLAN_LABELS[u.subscription_type] || u.subscription_type || "—"}</td>
                    <td className="tabular-nums">{u.token_balance?.toLocaleString() ?? "—"}</td>
                    <td className="text-xs text-base-content/50">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("zh-CN") : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-base-content/40">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-base-content/60">
            <span>共 {total} 条，第 {page}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                className="btn btn-ghost btn-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
