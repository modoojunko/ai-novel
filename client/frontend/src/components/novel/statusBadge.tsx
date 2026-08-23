// 章状态徽章 + 标签映射（提示词管理页 / 章工作台共用）

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

// ── 章工作台（写作工作流四态，系统维护）───────────────────────────────────

const CHAPTER_STATUS_LABELS: Record<string, string> = {
  outline: "章纲",
  writing: "写作中",
  draft: "写作中", // unarchive 恢复态（后端历史值：有正文可编辑 = 写作中）
  review: "待修改", // 已退役手动值，存量数据兜底展示
  confirmed: "已确认",
  archived: "已归档",
};

export function chapterStatusLabel(status?: string): string {
  return status ? CHAPTER_STATUS_LABELS[status] || status : "";
}

export function ChapterStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const tone =
    status === "confirmed"
      ? "badge-success"
      : status === "writing" || status === "draft"
        ? "badge-warning"
        : status === "archived"
          ? "badge-ghost"
          : "badge-outline";
  return (
    <span className={`badge badge-sm ${tone}`}>{chapterStatusLabel(status)}</span>
  );
}
