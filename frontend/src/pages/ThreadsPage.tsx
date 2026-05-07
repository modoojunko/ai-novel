import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { GitBranch, Clock, AlertCircle, ChevronRight } from "lucide-react";

type Thread = {
  pov: string;
  last_chapter: string;
  current_state: string;
  pending_questions: string[];
  active_hooks: { ref: string; description: string; status: string }[];
  emotional_temperature: string;
};

const TEMP_COLORS: Record<string, string> = {
  low: "badge-primary",
  medium: "badge-info",
  high: "badge-warning",
  climax: "badge-error",
};

const TEMP_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  climax: "高潮",
};

export default function ThreadsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [projectId, setProjectId] = useState("");
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api
      .get(`/projects/${projectId}/threads`)
      .then((d) => setThreads(d.threads || {}))
      .catch(() => {});
  }, [projectId]);

  const entries = Object.entries(threads);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
          <GitBranch className="w-6 h-6" /> 线索时间线
        </h2>
        <span className="text-sm text-base-content/60">{entries.length} 条线索</span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-base-content/60">
          <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-30" />
          暂无线索。线索在章节存档时自动生成。
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(([name, t]) => {
            const isOpen = expanded[name] !== false;
            const temp = t.emotional_temperature || "medium";
            return (
              <div key={name} className="card bg-base-200 border border-base-300">
                <div
                  className="card-body py-4 cursor-pointer"
                  onClick={() => setExpanded((p) => ({ ...p, [name]: !p[name] }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight
                        className={`w-4 h-4 text-base-content/60 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                      <h3 className="card-title text-base">{name}</h3>
                      <span className={`badge badge-xs ${TEMP_COLORS[temp]}`}>
                        {TEMP_LABELS[temp]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-base-content/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.last_chapter || "—"}
                      </span>
                      <span>视角：{t.pov || "—"}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="space-y-4 pt-4">
                      <div>
                        <span className="text-xs font-medium text-base-content/60 uppercase tracking-wider">
                          当前状态
                        </span>
                        <p className="text-sm mt-1">{t.current_state || "暂无状态记录。"}</p>
                      </div>

                      {(t.pending_questions || []).length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-base-content/60 uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> 待解决问题
                          </span>
                          <ul className="mt-1 space-y-1">
                            {t.pending_questions.map((q, i) => (
                              <li key={i} className="text-sm text-base-content/60 flex items-start gap-2">
                                <span className="text-base-content/30 mt-0.5">•</span>
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(t.active_hooks || []).length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-base-content/60 uppercase tracking-wider">
                            活跃伏笔
                          </span>
                          <div className="mt-1 space-y-1">
                            {t.active_hooks.map((h) => (
                              <div key={h.ref} className="text-sm flex items-center gap-2">
                                <span className="font-mono text-xs bg-base-300 px-1.5 py-0.5 rounded">
                                  {h.ref}
                                </span>
                                <span>{h.description}</span>
                                <span className="text-xs text-base-content/60">({h.status})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
