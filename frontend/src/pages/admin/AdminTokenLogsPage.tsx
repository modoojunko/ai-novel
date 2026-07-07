import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface TokenLog {
  id: string;
  user_id: string;
  operation: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  created_at: string | null;
}

export default function AdminTokenLogsPage() {
  const [logs, setLogs] = useState<TokenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userIdFilter, setUserIdFilter] = useState("");

  function fetchLogs(userId?: string) {
    setLoading(true);
    const params = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    api.get(`/admin/token-logs${params}`)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  function handleFilter() {
    fetchLogs(userIdFilter.trim() || undefined);
  }

  return (
    <div>
      <h1 className="text-2xl font-serif font-semibold mb-6">Token 账单</h1>

      {/* Filter by user_id */}
      <div className="flex items-center gap-3 mb-4">
        <input
          className="input input-bordered input-sm w-64 font-mono"
          placeholder="按用户 ID 筛选…"
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFilter()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleFilter}>
          筛选
        </button>
        {userIdFilter && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setUserIdFilter(""); fetchLogs(); }}>
            清除
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-base-300/50">
          <table className="table table-sm">
            <thead>
              <tr className="text-base-content/50 text-xs uppercase">
                <th>用户 ID</th>
                <th>操作</th>
                <th>模型</th>
                <th>输入 Token</th>
                <th>输出 Token</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-base-200/80 transition-colors">
                  <td className="font-mono text-xs text-base-content/50">{l.user_id}</td>
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
                  <td colSpan={6} className="text-center py-8 text-base-content/40">暂无记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
