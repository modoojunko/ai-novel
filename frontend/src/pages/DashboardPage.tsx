import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import AuthGuard from "@/components/auth/AuthGuard";
import { Plus, Wand2, Loader2 } from "lucide-react";

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

interface Suggestion {
  titles: string[];
  synopsis: string;
  genre_profile: string;
  genre_label: string;
  atmosphere: string;
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
  const [premise, setPremise] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/projects")
      .then(setProjects)
      .catch(() => toast.error("加载失败"))
      .finally(() => setLoading(false));
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
      navigate(`/project/${p.slug}`);
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
                </div>
                <div className="card bg-base-100 border border-base-300 p-3">
                  <span className="text-[10px] text-base-content/60 uppercase">简介</span>
                  <p className="text-sm mt-1 leading-relaxed">{suggestion.synopsis}</p>
                </div>
                <div className="flex gap-2 text-[11px] text-base-content/60">
                  <span className="badge badge-outline">{suggestion.genre_label}</span>
                  <span className="badge badge-outline">{suggestion.atmosphere}</span>
                </div>
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
    </main>
  );
}