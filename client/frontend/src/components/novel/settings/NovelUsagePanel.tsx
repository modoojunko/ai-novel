import { useUsageStats } from "../../../hooks/useUsageStats";
import { UsagePieChart } from "../../api-config/UsagePieChart";

interface NovelUsagePanelProps {
  projectId: string;
}

export function NovelUsagePanel({ projectId }: NovelUsagePanelProps) {
  const { data, loading } = useUsageStats({ projectId });

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-4 w-32" />
      </div>
    );
  }

  if (!data || data.total_tokens === 0) {
    return <p className="text-sm text-base-content/50 py-3 text-center">暂无用量数据</p>;
  }

  return (
    <div className="space-y-4 py-2">
      <div className="text-lg font-bold">{data.total_tokens.toLocaleString()} tokens</div>

      {data.by_model && data.by_model.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-base-content/60 mb-2">按模型</h5>
          <UsagePieChart data={data.by_model} />
        </div>
      )}

      {data.by_operation && data.by_operation.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-base-content/60 mb-2">按阶段</h5>
          <div className="space-y-1">
            {data.by_operation.map((op: { operation: string; tokens: number }) => (
              <div key={op.operation} className="flex justify-between text-sm">
                <span className="text-base-content/70">{op.operation}</span>
                <span>{op.tokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
