import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import AuthGuard from "@/components/auth/AuthGuard";
import AiSuggestButton from "@/components/ui/ai-suggest-button";
import { Plus } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  init: "初始化",
  settings: "设定",
  outline: "大纲",
  prompts: "提示词",
  write: "写作",
  archives: "存档",
};

interface Project {
  id: string;
  name: string;
  slug: string;
  current_phase: string;
  total_chapters: number;
  updated_at: string;
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/projects")
      .then(setProjects)
      .catch(() => toast.error("加载失败"))
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const p = await api.post("/projects", { name });
      toast.success(`「${p.name}」已创建`);
      setShowCreate(false);
      setName("");
      setSummary("");
      navigate(`/project/${p.slug}`);
    } catch {
      toast.error("创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-primary">我的小说</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          开始新小说
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card bg-base-200 border border-base-300">
              <div className="card-body py-5">
                <div className="skeleton h-5 w-3/4 mb-2" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-2 w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-base-content/60">
          <p className="text-lg mb-2 font-serif">暂无小说</p>
          <p className="text-sm">点击「开始新小说」开始创作</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((p) => {
            const phaseIdx = ["init","settings","outline","prompts","write","archives"].indexOf(p.current_phase);
            return (
              <div
                key={p.id}
                className="card bg-base-200 border border-base-300 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => navigate(`/project/${p.slug}`)}
              >
                <div className="card-body py-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-serif text-base truncate">{p.name}</h3>
                      <p className="text-xs text-base-content/60 mt-1">
                        {p.total_chapters}章 · 更新于{new Date(p.updated_at).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[3px] mt-3">
                    {["init","settings","outline","prompts","write","archives"].map((ph, i) => (
                      <div
                        key={ph}
                        className={`w-[7px] h-[7px] rounded-full ${
                          i < phaseIdx
                            ? "bg-success"
                            : i === phaseIdx
                              ? "bg-primary shadow-[0_0_3px_hsl(var(--p))]"
                              : "border border-base-content/25"
                        }`}
                      />
                    ))}
                    <span className="text-[11px] text-base-content/60 ml-2">
                      {PHASE_LABELS[p.current_phase] || p.current_phase}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div
            className="border border-dashed border-base-300 rounded-xl flex items-center justify-center min-h-[100px] cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
            onClick={() => setShowCreate(true)}
          >
            <span className="text-base-content/60 text-sm">+ 开始新小说</span>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold font-serif text-lg mb-4">开始一部新小说</h3>
            <div className="space-y-4">
              <div>
                <label className="label py-1">
                  <span className="label-text text-xs font-medium">书名 *</span>
                </label>
                <input
                  className="input input-bordered w-full"
                  placeholder="给你的小说取个名字..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
              </div>
              <div>
                <div className="flex items-center justify-between py-1">
                  <span className="label-text text-xs font-medium">一句话梗概</span>
                  <AiSuggestButton
                    label="AI 建议书名"
                    onClick={() => toast.info("即将上线")}
                  />
                </div>
                <input
                  className="input input-bordered w-full"
                  placeholder="用一句话描述你的故事..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={create} disabled={creating || !name.trim()}>
                  {creating ? "创建中..." : "创建小说"}
                </button>
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreate(false)} />
        </div>
      )}
    </main>
  );
}
