import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, FileText, Coins, Activity } from "lucide-react";

interface Stats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  total_projects: number;
  total_tokens: number;
  total_calls: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/admin/stats")
      .then(setStats)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "总用户", value: stats?.total_users ?? "—", icon: Users, color: "text-primary" },
    { label: "活跃用户", value: stats?.active_users ?? "—", icon: Activity, color: "text-success" },
    { label: "未激活", value: stats?.inactive_users ?? "—", icon: Users, color: "text-warning" },
    { label: "项目总数", value: stats?.total_projects ?? "—", icon: FileText, color: "text-info" },
    { label: "Token 消耗", value: stats?.total_tokens?.toLocaleString() ?? "—", icon: Coins, color: "text-accent" },
    { label: "API 调用", value: stats?.total_calls ?? "—", icon: Activity, color: "text-base-content/60" },
  ];

  if (loading) return <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>;

  if (error) return (
    <div className="text-center py-16">
      <p className="text-error/70">加载失败: {error}</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-serif font-semibold mb-6">仪表盘</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-base-300/50 bg-base-100 p-5">
            <div className="flex items-center gap-3">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-sm text-base-content/50">{card.label}</span>
            </div>
            <p className="text-2xl font-semibold mt-2 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
