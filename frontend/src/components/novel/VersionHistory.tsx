import { useState, useEffect } from "react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Version {
  version: string;
  time: string;
  comment: string;
  isCurrent: boolean;
}

interface VersionHistoryProps {
  projectId: string;
  chapterRef: string;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Mock data (fallback until version API exists)
// ---------------------------------------------------------------------------

const MOCK_VERSIONS: Version[] = [
  { version: "v1", time: "刚刚创建", comment: "首次创建", isCurrent: true },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VersionHistory({
  projectId,
  chapterRef,
  onBack,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>(MOCK_VERSIONS);

  useEffect(() => {
    // TODO: replace mock with real API call when endpoint is available
    // api.get(`/projects/${projectId}/chapters/${chapterRef}/versions`)
    //   .then((data: Version[]) => setVersions(data))
    //   .catch(() => setVersions(MOCK_VERSIONS));
    setVersions(MOCK_VERSIONS);
  }, [projectId, chapterRef]);

  const currentVersion = versions.find((v) => v.isCurrent);
  const diffAvailable = versions.length >= 2;

  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Back button ─────────────────────────────────────────── */}
      <button
        onClick={onBack}
        className="text-sm text-base-content/60 hover:text-base-content transition-colors mb-4 flex items-center gap-1"
      >
        &larr; 返回编辑器
      </button>

      {/* ── Title ───────────────────────────────────────────────── */}
      <h2 className="text-xl font-serif font-semibold text-base-content">
        版本历史
      </h2>
      <p className="text-xs text-base-content/50 mt-0.5 mb-6">{chapterRef}</p>

      {/* ── Version table ─────────────────────────────────────────── */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-base-300">
            <th className="text-[10px] uppercase tracking-wider text-base-content/60 text-left pb-2 pr-4">
              版本
            </th>
            <th className="text-[10px] uppercase tracking-wider text-base-content/60 text-left pb-2 pr-4">
              时间
            </th>
            <th className="text-[10px] uppercase tracking-wider text-base-content/60 text-left pb-2 pr-4">
              备注
            </th>
            <th className="text-[10px] uppercase tracking-wider text-base-content/60 text-left pb-2 pr-4">
              当前
            </th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr
              key={v.version}
              className={`group border-b border-base-200 ${
                v.isCurrent
                  ? "text-primary"
                  : "text-base-content/80 hover:bg-base-200/40"
              }`}
            >
              <td className="py-2.5 pr-4 font-medium">{v.version}</td>
              <td className="py-2.5 pr-4 text-xs">{v.time}</td>
              <td className="py-2.5 pr-4 text-xs text-base-content/60">
                {v.comment}
              </td>
              <td className="py-2.5 pr-4">
                {v.isCurrent ? (
                  <span className="badge badge-primary badge-sm">当前</span>
                ) : null}
              </td>
              <td className="py-2.5">
                {!v.isCurrent && (
                  <button className="text-xs text-base-content/50 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 rounded hover:bg-base-300/40">
                    恢复到 {v.version}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Diff section ──────────────────────────────────────────── */}
      <div className="mt-10">
        <h3 className="text-base font-medium text-base-content mb-3">
          📋 差异对比
        </h3>
        {diffAvailable ? (
          <div className="rounded-lg border border-base-300 bg-base-200/30 p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap text-base-content/70">
            {/* Diff content renders here when version API is available */}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-base-300 bg-base-200/20 p-6 text-center text-sm text-base-content/40">
            <p className="mb-1">暂无版本对比数据</p>
            <p className="text-xs">
              保存新版本后，此处将显示与
              {currentVersion ? ` ${currentVersion.version}` : ""} 的差异
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
