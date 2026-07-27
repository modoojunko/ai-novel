interface UsagePieChartProps {
  data: Array<{ model: string; tokens: number }>;
  loading?: boolean;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function UsagePieChart({ data, loading }: UsagePieChartProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="oklch(var(--b3))" strokeWidth="14" />
        </svg>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-base-content/50 text-center py-4">暂无用量数据</p>;
  }

  const total = data.reduce((s, d) => s + d.tokens, 0);
  if (total === 0) {
    return <p className="text-sm text-base-content/50 text-center py-4">暂无用量数据</p>;
  }

  // Single segment: full circle
  if (data.length === 1) {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke={COLORS[0]} strokeWidth="14" />
        </svg>
        <div className="flex items-center gap-1 text-xs">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[0] }} />
          <span>{data[0].model}</span>
          <span className="text-base-content/50">{total.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // Multi-segment donut
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const percentage = d.tokens / total;
    const offset = cumulative * 360;
    const length = percentage * 360;
    cumulative += percentage;
    return { ...d, color: COLORS[i % COLORS.length], offset, length, percentage };
  });

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {segments.map((seg, i) => {
          const r = 32;
          const circumference = 2 * Math.PI * r;
          const dashLength = seg.length / 360 * circumference;
          const dashOffset = -seg.offset / 360 * circumference;
          return (
            <circle
              key={i}
              cx="40" cy="40" r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90, 40, 40)"
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: seg.color }} />
            <span>{seg.model}</span>
            <span className="text-base-content/50">{Math.round(seg.percentage * 100)}%</span>
            <span className="text-base-content/50">{seg.tokens.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
