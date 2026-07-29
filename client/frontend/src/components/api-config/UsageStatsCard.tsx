import type { UsageSummary } from "../../types/api-config";
import { UsagePieChart } from "./UsagePieChart";

interface UsageStatsCardProps {
  data: UsageSummary | null;
  loading?: boolean;
}

export function UsageStatsCard({ data, loading }: UsageStatsCardProps) {
  if (loading) {
    return (
      <div className="card bg-base-100 border border-base-300 p-4 space-y-3">
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 space-y-2">
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-6 w-20" />
              <div className="skeleton h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-base-content/50 text-center py-4">暂无数据</p>;
  }

  const stats = [
    { label: "总用量", value: data.total_all_time },
    { label: "本月", value: data.total_this_month },
    { label: "今日", value: data.total_today },
  ];

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body p-4">
        <div className="flex flex-wrap gap-4">
          {stats.map((s) => (
            <div key={s.label} className="flex-1 min-w-[80px]">
              <div className="text-xs text-base-content/50">{s.label}</div>
              <div className="text-xl font-bold">{s.value.toLocaleString()}</div>
              <div className="text-xs text-base-content/50">tokens</div>
            </div>
          ))}
        </div>
        {data.by_config && data.by_config.length > 0 && (
          <div className="mt-3">
            <UsagePieChart
              data={data.by_config.map((c) => ({ model: c.config_name || c.config_id, tokens: c.tokens }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
