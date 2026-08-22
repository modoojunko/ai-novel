import type { UsageSummary } from "../../types/api-config";

interface UsageStatsCardProps {
  data: UsageSummary | null;
  loading?: boolean;
  /** 最近更新的相对时间文案（页面传入，避免组件依赖时间工具） */
  updatedLabel?: string;
}

const fmt = (n: number) => n.toLocaleString("zh-CN");

/** 用量统计面板（model-config.html panel/stat-tiles/usage-rows 原样；饼图换条形行） */
export function UsageStatsCard({ data, loading, updatedLabel }: UsageStatsCardProps) {
  const stats = [
    { k: "累计", v: data?.total_all_time },
    { k: "本月", v: data?.total_this_month },
    { k: "今日", v: data?.total_today },
  ];
  const rows = data?.by_config || [];
  const max = Math.max(...rows.map((x) => x.tokens), 1);

  return (
    <div className="panel">
      <div className="panel-h">
        <h2>用量统计</h2>
        <span className="note">Token 计数 · 最近更新：{loading ? "—" : (updatedLabel || "—")}</span>
      </div>
      <div className="stat-tiles">
        {stats.map((s) => (
          <div key={s.k} className="stat">
            <div className="k">{s.k}</div>
            <div className="v">{loading || s.v === undefined ? "—" : fmt(s.v)}</div>
          </div>
        ))}
      </div>
      {rows.length > 0 && !loading && (
        <div className="usage-rows">
          {rows.map((x) => (
            <div key={x.config_id} className="usage-row">
              <span className="nm">{x.config_name || x.config_id}</span>
              <span className="bar">
                <i style={{ width: `${Math.round((x.tokens / max) * 100)}%` }} />
              </span>
              <span className="tok">{fmt(x.tokens)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
