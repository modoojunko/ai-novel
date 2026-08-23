// 本书用量统计（book.html v2 use-row 行式 + 产品保留的按模型饼图）。
import { useUsageStats } from "../../../hooks/useUsageStats";
import { UsagePieChart } from "../../api-config/UsagePieChart";

interface NovelUsagePanelProps {
  projectId: string;
}

export function NovelUsagePanel({ projectId }: NovelUsagePanelProps) {
  const { data, loading } = useUsageStats({ projectId });

  if (loading) {
    return <p className="opt">查询中…</p>;
  }

  if (!data || data.total_tokens === 0) {
    return <p className="opt">暂无用量数据</p>;
  }

  return (
    <div>
      <div className="use-row">
        <span>累计 tokens</span>
        <span className="uv">{data.total_tokens.toLocaleString()}</span>
      </div>
      {data.by_operation &&
        data.by_operation.length > 0 &&
        data.by_operation.map((op: { operation: string; tokens: number }) => (
          <div className="use-row" key={op.operation}>
            <span>{op.operation}</span>
            <span className="uv">{op.tokens.toLocaleString()}</span>
          </div>
        ))}
      {data.by_model && data.by_model.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="opt" style={{ margin: "0 0 8px" }}>按模型</p>
          <UsagePieChart data={data.by_model} />
        </div>
      )}
    </div>
  );
}
