import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import AuthGuard from "@/components/auth/AuthGuard";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import { Plus, Wand2, Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
  current_phase: string;
  total_volumes: number;
  total_chapters: number;
  updated_at: string;
}

interface Suggestion {
  titles: string[];
  synopsis: string;
  genre_profile: string;
  genre_label: string;
  atmosphere: string;
  elements?: Record<string, string>;
  missing?: string[];
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
  const [tier, setTier] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(0);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [premise, setPremise] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [showKeyHint, setShowKeyHint] = useState(false);
  const navigate = useNavigate();

  async function handleDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev: Project[]) => prev.filter((p) => p.id !== id));
      toast.success(`《${name}》已删除`);
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败");
    }
  }

  useEffect(() => {
    api.get("/projects").then(setProjects).catch(() => toast.error("加载失败")).finally(() => setLoading(false));
    api.post("/auth/verify").then((r: any) => {
      if (r.tier) setTier(r.tier);
      if (r.trial_remaining_days !== undefined) setTrialDays(r.trial_remaining_days);
    }).catch(() => {});
    // 检查 API Key 配置状态
    api.get("/auth/config").then((cfg: any) => {
      if (!cfg.has_api_key) setShowKeyHint(true);
    }).catch(() => {});
  }, []);

  async function doSuggest() {
    if (!premise.trim()) return;
    setSuggesting(true);
    try {
      const res = await api.post("/ai/suggest-meta", { premise });
      setSuggestion(res);
      setSelectedTitle(res.titles?.[0] || "");
    } catch {
      toast.error("AI 建议失败，请重试或手动输入书名");
    } finally {
      setSuggesting(false);
    }
  }

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const body: any = { name };
      if (suggestion) {
        body.synopsis = suggestion.synopsis;
        body.genre_profile = suggestion.genre_profile;
      }
      const p = await api.post("/projects", body);
      toast.success(`「${p.name}」已创建`);
      setShowCreate(false);
      resetForm();
      navigate(`/project/${p.id}`);
    } catch {
      toast.error("创建失败");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setName("");
    setPremise("");
    setSuggestion(null);
    setSelectedTitle("");
  }

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      {/* 免费层 Banner */}
      {tier === 'none' && (
        <div className="alert alert-info mb-6 shadow-sm">
          <div className="flex-1">
            <span className="font-bold">
              {trialDays > 0 ? `🔥 AI 试用还剩 ${trialDays} 天` : '⏰ AI 试用已到期'}
            </span>
            <span className="text-sm ml-2">
              {trialDays > 0
                ? '到期后可免费手工创作 1 本小说'
                : '购买套餐后可继续使用 AI 功能，免费用户可手工创作 1 本小说'
              }
            </span>
          </div>
          <a href="https://taobao.com" target="_blank" className="btn btn-primary btn-sm">了解套餐</a>
        </div>
      )}

      {showKeyHint && (
        <div className="alert alert-info mb-4 shadow-sm">
          <span>💡 还没配置 API Key，</span>
          <a href="/#/config" className="link link-primary">去配置</a>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-display text-base-content">我的作品</h1>
        {!(tier === 'none' && projects.length >= 1) && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            开始新小说
          </button>
        )}
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
            return (
              <div
                key={p.id}
                className="card bg-base-200/70 border border-base-300/40 cursor-pointer
                          hover:bg-base-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5
                          transition-all duration-300 group"
              >
                <div className="card-body py-5" onClick={() => navigate(`/project/${p.id}`)}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-serif text-base truncate group-hover:text-primary transition-colors">{p.name}</h3>
                      <p className="text-xs text-base-content/50 mt-1">
                        {p.total_chapters}章 · 更新于{new Date(p.updated_at).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                      className="opacity-0 group-hover:opacity-100 btn btn-ghost btn-xs text-error/60 hover:text-error transition-all shrink-0"
                      title="删除小说"
                    >
                      🗑
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-base-content/50">
                    <span>{p.total_volumes || 0} 卷</span>
                    <span>·</span>
                    <span>{p.total_chapters || 0} 章</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div
            className="border border-dashed border-base-300/40 rounded-xl flex items-center justify-center min-h-[100px] cursor-pointer
                      hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 transition-all duration-300"
            onClick={() => setShowCreate(true)}
          >
            <span className="text-base-content/40 text-sm group-hover:text-base-content/60">+ 开始新小说</span>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold font-serif text-lg mb-4">开始一部新小说</h3>

            {/* State 0: AI greeting — author describes story or clicks skip */}
            {!suggestion && !manualMode && (
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Wand2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-base-200 rounded-lg p-3 text-sm leading-relaxed">
                    你想写一个什么样的故事？简单描述就行——主角是谁、在什么世界、发生了什么。
                    不用想书名，先跟我聊聊你的故事。
                  </div>
                </div>

                <textarea
                  className="textarea textarea-bordered w-full h-28"
                  placeholder="比如：一个退役刑警在调查三年前的悬案时，发现所有线索都指向他自己。"
                  value={premise}
                  onChange={(e) => setPremise(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      doSuggest();
                    }
                  }}
                />

                <button
                  className="btn btn-primary w-full"
                  onClick={doSuggest}
                  disabled={suggesting || !premise.trim()}
                >
                  {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {suggesting ? "AI 正在构思…" : "AI 帮我起名 & 分析类型"}
                </button>

                <div className="divider text-[11px] text-base-content/40">或者</div>

                <button className="btn btn-ghost w-full text-sm" onClick={() => setManualMode(true)}>
                  跳过 — 我已经有书名和想法了
                </button>
              </div>
            )}

            {/* State 1: AI results — author picks a title */}
            {suggestion && (
              <div className="space-y-4">
                <div>
                  <span className="label-text text-xs font-medium">AI 为你准备了</span>
                  <div className="space-y-2 mt-2">
                    {suggestion.titles.map((t, i) => (
                      <button
                        key={i}
                        className={`btn w-full justify-start text-sm ${selectedTitle === t ? "btn-primary" : "btn-outline"}`}
                        onClick={() => { setSelectedTitle(t); setName(t); }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {selectedTitle && (
                    <div className="mt-2">
                      <label className="label-text text-xs text-base-content/40">或修改标题</label>
                      <input
                        className="input input-bordered w-full text-sm mt-1"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setSelectedTitle(e.target.value); }}
                        placeholder="修改标题…"
                      />
                    </div>
                  )}
                </div>
                <div className="card bg-base-100 border border-base-300 p-3">
                  <span className="text-[10px] text-base-content/60 uppercase">简介</span>
                  <p className="text-sm mt-1 leading-relaxed">{suggestion.synopsis}</p>
                </div>
                <div className="flex gap-2 text-[11px] text-base-content/60">
                  <span className="badge badge-outline">{suggestion.genre_label}</span>
                  <span className="badge badge-outline">{suggestion.atmosphere}</span>
                </div>

                {/* Story elements */}
                {suggestion.elements && (
                  <div className="bg-base-200/50 border border-base-300/50 rounded-lg p-3 space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-base-content/40 font-medium">故事要素</span>
                    {Object.entries(suggestion.elements).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className={val ? "text-success" : "text-warning"}>
                          {val ? "✅" : "⚠️"}
                        </span>
                        <span className="text-base-content/50 w-16 shrink-0">{key}</span>
                        <span className={val ? "text-base-content/80" : "text-base-content/30 italic"}>
                          {val || "未提及"}
                        </span>
                      </div>
                    ))}
                    {suggestion.missing && suggestion.missing.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-base-300/40">
                        <p className="text-[11px] text-warning/70">
                          {suggestion.missing.join("；")}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-base-content/50 bg-base-200 rounded p-2">
                  创建后自动填好：小说简介、类型设定。可在设置页面修改。
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button className="btn btn-ghost btn-sm" onClick={resetForm}>重新构思</button>
                  <button className="btn btn-primary" onClick={create} disabled={creating || !name.trim()}>
                    {creating ? "创建中…" : `创建《${name}》`}
                  </button>
                </div>
              </div>
            )}

            {/* State 2: Manual mode — author has a title already */}
            {manualMode && !suggestion && (
              <div className="space-y-4">
                <div>
                  <label className="label py-1"><span className="label-text text-xs font-medium">书名</span></label>
                  <input
                    className="input input-bordered w-full"
                    placeholder="给你的小说取个名字…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && create()}
                  />
                </div>
                <div className="text-[11px] text-base-content/50">
                  书名确定后可以随时修改。简介和类型可以在设置页面补充。
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button className="btn btn-ghost" onClick={() => { setManualMode(false); setName(""); }}>
                    返回
                  </button>
                  <button className="btn btn-primary" onClick={create} disabled={creating || !name.trim()}>
                    {creating ? "创建中…" : "创建"}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreate(false)} />
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          title="小说"
          confirmText={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}