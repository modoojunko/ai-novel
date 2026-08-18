import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import AuthGuard from "@/components/auth/AuthGuard";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import CreateProjectModal from "@/components/novel/CreateProjectModal";
import ImportNovelModal from "@/components/novel/ImportNovelModal";
import RenameModal from "@/components/novel/RenameModal";
import { FileUp, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

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
  const [loadError, setLoadError] = useState(false);
  const [tier, setTier] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(0);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [expired, setExpired] = useState<boolean>(false);
  const [portalUrl, setPortalUrl] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);
  const [renameTarget, setRenameTarget] = useState<Novel | null>(null);
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

  async function handleRename(next: string) {
    if (!renameTarget) return;
    try {
      const updated = await api.renameNovel(renameTarget.id, next);
      setNovels((prev: Novel[]) =>
        prev.map((p) => (p.id === updated.id ? { ...p, name: updated.name } : p)),
      );
      toast.success(`已更名为《${updated.name}》`);
      setRenameTarget(null);
    } catch {
      toast.error("改名失败");
    }
  }

  const fetchNovels = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.get("/novels");
      setNovels(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNovels();
    api.post("/auth/verify").then((r: any) => {
      if (r.tier) setTier(r.tier);
      if (r.trial_remaining_days !== undefined) setTrialDays(r.trial_remaining_days);
      if (r.is_member !== undefined) setIsMember(r.is_member);
      if (r.expired !== undefined) setExpired(r.expired);
    }).catch(() => {});
    // 检查 API Key 配置状态 + 取 S端 门户地址（续费/开通引导用）
    api.get("/auth/config").then((cfg: any) => {
      if (!cfg.has_api_key) setShowKeyHint(true);
      if (cfg.portal_url) setPortalUrl(cfg.portal_url);
    }).catch(() => {});
  }, [fetchNovels]);

  function handleCreated(novelId: string) {
    setShowCreate(false);
    navigate(`/novel/${novelId}`);
  }

  // 免费待遇 = 非有效会员（免费层或套餐过期），与后端 require_project_limit 口径一致
  const freeLimitReached = !isMember && novels.length >= 1;

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      {/* 过期降级 Banner（2026-08-18 口径：过期降为免费待遇） */}
      {expired && tier !== 'none' && (
        <div className="alert alert-warning mb-6 shadow-sm">
          <div className="flex-1">
            <span className="font-bold">⏰ 套餐已过期，已降为免费待遇</span>
            <span className="text-sm ml-2">
              AI 功能与多项目已暂停 · 免费待遇下可手工创作 1 本小说
            </span>
          </div>
          {portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noreferrer" className="btn btn-warning btn-sm">
              续费恢复
            </a>
          ) : (
            <Link to="/" state={{ scrollTo: "pricing" }} className="btn btn-warning btn-sm">了解套餐</Link>
          )}
        </div>
      )}
      {/* 试用中 Banner：提示剩余天数 + 到期影响，引导续费 */}
      {tier === 'trial' && !expired && (
        <div className="alert alert-info mb-6 shadow-sm">
          <div className="flex-1">
            <span className="font-bold">
              {trialDays > 0 ? `🔥 试用还剩 ${trialDays} 天` : '🔥 试用期进行中'}
            </span>
            <span className="text-sm ml-2">
              {trialDays > 0
                ? '试用内可免费用全部 AI 功能，到期后降为免费待遇（可手工创作 1 本小说）'
                : '可免费用全部 AI 功能，到期后降为免费待遇'}
            </span>
          </div>
          {portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">开通 PRO</a>
          ) : (
            <Link to="/" state={{ scrollTo: "pricing" }} className="btn btn-primary btn-sm">了解套餐</Link>
          )}
        </div>
      )}
      {/* 免费层 Banner：从未开通过套餐，引导试用 */}
      {tier === 'none' && (
        <div className="alert alert-info mb-6 shadow-sm">
          <div className="flex-1">
            <span className="font-bold">✨ 开通 7 天免费试用</span>
            <span className="text-sm ml-2">
              试用期内免费使用全部 AI 功能，到期自动降为免费待遇（可手工创作 1 本小说）
            </span>
          </div>
          {portalUrl ? (
            <a href={portalUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">免费试用</a>
          ) : (
            <Link to="/" state={{ scrollTo: "pricing" }} className="btn btn-primary btn-sm">了解套餐</Link>
          )}
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
        {!freeLimitReached && (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline"
              onClick={() => setShowImport(true)}
              title="导入已有稿子（.md / .txt / .docx）"
            >
              <FileUp className="w-4 h-4" />
              导入
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              开始新小说
            </button>
          </div>
        )}
      </div>

      {loadError ? (
        <div className="text-center py-20">
          <p className="text-base-content/60 mb-4">作品加载失败，请检查网络后重试</p>
          <button className="btn btn-outline" onClick={() => void fetchNovels()}>
            重新加载
          </button>
        </div>
      ) : loading ? (
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
          <p className="text-sm mb-6">点击「开始新小说」开始创作，或导入已有稿子</p>
          {!freeLimitReached && (
            <div className="flex items-center justify-center gap-2">
              <button className="btn btn-outline" onClick={() => setShowImport(true)}>
                <FileUp className="w-4 h-4" />
                导入已有稿子
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" />
                开始新小说
              </button>
            </div>
          )}
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
                    <div className="dropdown dropdown-end shrink-0">
                      <button
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-ghost btn-xs btn-square text-base-content/50 hover:text-base-content transition-all"
                        title="更多操作"
                        aria-label="更多操作"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-10 menu menu-sm mt-1 w-36 rounded-box bg-base-100 border border-base-300 shadow-lg p-1"
                      >
                        <li>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget(p);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            重命名
                          </button>
                        </li>
                        <li>
                          <button
                            className="text-error/70 hover:text-error"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(p);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        </li>
                      </ul>
                    </div>
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

      {/* Import Novel Modal */}
      <ImportNovelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={handleCreated}
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

      {/* Rename modal */}
      {renameTarget && (
        <RenameModal
          name={renameTarget.name}
          onConfirm={handleRename}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </main>
  );
}
