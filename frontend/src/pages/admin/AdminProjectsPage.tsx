import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  slug: string;
  user_id: string;
  current_phase: string;
  status: string;
  total_chapters: number;
  created_at: string | null;
}

const PAGE_SIZE = 20;

const PHASE_LABELS: Record<string, string> = {
  init: "初始化", settings: "设定", outline: "大纲", prompt: "推演", write: "写作", archive: "归档",
};
const STATUS_LABELS: Record<string, string> = { active: "进行中", archived: "已归档" };

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    api.get(`/admin/projects?page=${page}`)
      .then((res: { projects: Project[]; total: number }) => {
        setProjects(res.projects);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-serif font-semibold mb-6">项目浏览</h1>

      {loading ? (
        <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300/50">
            <table className="table table-sm">
              <thead>
                <tr className="text-base-content/50 text-xs uppercase">
                  <th>项目名</th>
                  <th>用户 ID</th>
                  <th>状态</th>
                  <th>当前阶段</th>
                  <th>章节数</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-base-200/80 transition-colors">
                    <td className="font-medium">{p.name}</td>
                    <td className="font-mono text-xs text-base-content/50">{p.user_id}</td>
                    <td>
                      <span className={`badge badge-xs ${p.status === "active" ? "badge-success" : "badge-ghost"}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-xs badge-outline">{PHASE_LABELS[p.current_phase] || p.current_phase}</span>
                    </td>
                    <td className="tabular-nums">{p.total_chapters ?? 0}</td>
                    <td className="text-xs text-base-content/50">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString("zh-CN") : "—"}
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-base-content/40">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-base-content/60">
            <span>共 {total} 条，第 {page}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                className="btn btn-ghost btn-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
