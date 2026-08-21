// 章状态徽章 + 标签映射（卷工作台章节列表 / 章工作台共用）

const STATUS_LABELS: Record<string, string> = {
  outline: "细纲",
  draft: "草稿",
  confirmed: "已确认",
  archived: "已归档",
};

export function statusLabel(status?: string): string {
  return status ? STATUS_LABELS[status] || status : "";
}

export default function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const tone =
    status === "confirmed"
      ? "badge-success"
      : status === "draft"
        ? "badge-warning"
        : "badge-ghost";
  return <span className={`badge badge-sm ${tone}`}>{statusLabel(status)}</span>;
}
