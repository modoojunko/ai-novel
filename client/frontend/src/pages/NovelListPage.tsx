import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import AuthGuard from "@/components/auth/AuthGuard";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import CreateProjectModal from "@/components/novel/CreateProjectModal";
import { Plus } from "lucide-react";

interface Novel {
  id: string;
  name: string;
  slug: string;
  current_phase: string;
  total_volumes: number;
  total_chapters: number;
  updated_at: string;
}

export default function NovelListPage() {
  return (
    <AuthGuard>
      <NovelList />
    </AuthGuard>
  );
}

function NovelList() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(0);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);
  const [showKeyHint, setShowKeyHint] = useState(false);
  const navigate = useNavigate();

  async function handleDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    try {
      await api.delete(`/novels/${id}`);
      setNovels((prev: Novel[]) => prev.filter((p) => p.id !== id));
      toast.success(`《${name}》已删除`);
      setDeleteTarget(null);
    } catch {
      toast.error("删除失败");
    }
  }

  useEffect(() => {
    api.get("/novels").then(setNovels).catch(() => toast.error("加载失败")).finally(() => setLoading(false));
    api.post("/auth/verify").then((r: any) => {
      if (r.tier) setTier(r.tier);
      if (r.trial_remaining_days !== undefined) setTrialDays(r.trial_remaining_days);
    }).catch(() => {});
    // 检查 API Key 配置状态
    api.get("/auth/config").then((cfg: any) => {
      if (!cfg.has_api_key) setShowKeyHint(true);
    }).catch(() => {});
  }, []);

  function handleCreated(novelId: string) {
    setShowCreate(false);
    navigate(`/novel/${novelId}`);
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
        {!(tier === 'none' && novels.length >= 1) && (
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
      ) : novels.length === 0 ? (
        <div className="text-center py-20 text-base-content/60">
          <p className="text-lg mb-2 font-serif">暂无小说</p>
          <p className="text-sm">点击「开始新小说」开始创作</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {novels.map((p) => {
            return (
              <div
                key={p.id}
                className="card bg-base-200/70 border border-base-300/40 cursor-pointer
                          hover:bg-base-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5
                          transition-all duration-300 group"
              >
                <div className="card-body py-5" onClick={() => navigate(`/novel/${p.id}`)}>
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

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreate}
        onClose={() => { setShowCreate(false); }}
        onCreated={handleCreated}
        tier={tier}
        novelCount={novels.length}
      />

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
