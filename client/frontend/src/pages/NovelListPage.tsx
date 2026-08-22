import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import AuthGuard from "@/components/auth/AuthGuard";
import DeleteConfirmModal from "@/components/novel/DeleteConfirmModal";
import CreateProjectModal from "@/components/novel/CreateProjectModal";
import ImportNovelModal from "@/components/novel/ImportNovelModal";
import RenameModal from "@/components/novel/RenameModal";
import { Ico, P, genreIconPath } from "@/components/icons";

interface Novel {
  id: string;
  name: string;
  slug: string;
  current_phase: string;
  total_volumes: number;
  total_chapters: number;
  updated_at: string;
  /** 卡片富化字段（list 接口附加；缺失时优雅降级） */
  word_count?: number;
  synopsis?: string;
  genre?: string | null;
}

/** 六阶段 → 设计三态：设定族灰、写作族琥珀、归档绿 */
const PHASE_STAGE: Record<string, "setting" | "writing" | "done"> = {
  init: "setting",
  settings: "setting",
  outline: "writing",
  prompt: "writing",
  write: "writing",
  archive: "done",
};
const STAGE_LABEL = { writing: "写作中", setting: "设定中", done: "已归档" } as const;
const STAGE_DOT = {
  writing: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  setting: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  done: '<path d="M5 13l4 4L19 7"/>',
} as const;

/** 相对时间（与原型文案口径：刚刚/N 分钟前/N 小时前/昨天/N 天前/超过一周落日期） */
function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  if (h < 48) return "昨天";
  const d = Math.floor(h / 24);
  if (d < 8) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

const fmt = (n: number) => n.toLocaleString("zh-CN");

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
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

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

  // 卡片 ⋯ 菜单：点外部收起
  useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuFor]);

  function handleCreated(novelId: string) {
    setShowCreate(false);
    navigate(`/novel/${novelId}`);
  }

  // 免费待遇 = 非有效会员（免费层或套餐过期），与后端 require_project_limit 口径一致
  const freeLimitReached = !isMember && novels.length >= 1;

  const upgradeBtn = (label: string) =>
    portalUrl ? (
      <a href={portalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
        {label}
      </a>
    ) : (
      <Link to="/" state={{ scrollTo: "pricing" }} className="btn btn-secondary btn-sm">
        {label}
      </Link>
    );

  return (
    <main className="main">
      {/* 过期降级 Banner（2026-08-18 口径：过期降为免费待遇） */}
      {expired && tier !== 'none' && (
        <div className="notice">
          <span className="nt">
            <b>套餐已过期，已降为免费待遇</b>
            <span>AI 功能与多项目已暂停 · 免费待遇下可手工创作 1 本小说</span>
          </span>
          {upgradeBtn("续费恢复")}
        </div>
      )}
      {/* 试用中 Banner：提示剩余天数 + 到期影响，引导续费 */}
      {tier === 'trial' && !expired && (
        <div className="notice info">
          <span className="nt">
            <b>{trialDays > 0 ? `试用还剩 ${trialDays} 天` : '试用期进行中'}</b>
            <span>
              {trialDays > 0
                ? '试用内可免费用全部 AI 功能，到期后降为免费待遇（可手工创作 1 本小说）'
                : '可免费用全部 AI 功能，到期后降为免费待遇'}
            </span>
          </span>
          {upgradeBtn("开通 PRO")}
        </div>
      )}
      {/* 免费层 Banner：从未开通过套餐，引导试用 */}
      {tier === 'none' && (
        <div className="notice info">
          <span className="nt">
            <b>开通 7 天免费试用</b>
            <span>试用期内免费使用全部 AI 功能，到期自动降为免费待遇（可手工创作 1 本小说）</span>
          </span>
          {upgradeBtn("免费试用")}
        </div>
      )}
      {showKeyHint && (
        <div className="notice info">
          <span className="nt">
            还没配置 API Key，AI 功能不可用。
          </span>
          <Link to="/config" className="btn btn-secondary btn-sm">去配置</Link>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>我的作品</h1>
          <p className="sub">建书即写 · 设定与大纲是高级配置，随时可补</p>
        </div>
        {!freeLimitReached && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowImport(true)}
              title="导入已有稿子（.md / .txt / .docx）"
            >
              <Ico d={P.upload} />
              导入
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Ico d={P.plus} />
              新建作品
            </button>
          </div>
        )}
      </div>

      {loadError ? (
        <div className="empty">
          <div className="serif">作品加载失败</div>
          <p>请检查网络后重试</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => void fetchNovels()}>
              重新加载
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="cards">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-skeleton">
              <div className="bar w40" />
              <div className="bar w90" />
              <div className="bar w70" />
            </div>
          ))}
        </div>
      ) : novels.length === 0 ? (
        /* 原型口径：empty 是 .cards 网格里的单个网格项（占一列），不改满宽 */
        <div className="cards">
          <div className="empty">
            <div className="serif">还没有作品</div>
            <p>点右上角「新建作品」，10 秒建好一本书，开始写第一章。</p>
          </div>
        </div>
      ) : (
        <div className="cards">
          {novels.map((p) => {
            const stage = PHASE_STAGE[p.current_phase] || "setting";
            const words = p.word_count ?? 0;
            return (
              <div
                key={p.id}
                className="book-card"
                role="link"
                tabIndex={0}
                aria-label={`打开《${p.name}》`}
                onClick={() => navigate(`/novel/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/novel/${p.id}`);
                }}
              >
                <div className="top">
                  <span className="mono">{(p.name || "书")[0]}</span>
                  <span className="genre">
                    <Ico d={genreIconPath(p.genre)} />
                    {p.genre || "其他"}
                  </span>
                  <span className={`b ${stage}`}>
                    <Ico d={STAGE_DOT[stage]} sw={2.4} />
                    {STAGE_LABEL[stage]}
                  </span>
                  <button
                    className="icon-btn card-menu-btn"
                    aria-label="更多操作"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuFor(menuFor === p.id ? null : p.id);
                    }}
                  >
                    <Ico d={P.dots} />
                  </button>
                </div>
                <h3>《{p.name}》</h3>
                <p className="summary">{p.synopsis || ""}</p>
                <div className="stats">
                  <span>
                    <b className="num">{p.total_volumes || 0} 卷</b>结构
                  </span>
                  <span>
                    <b className="num">{p.total_chapters || 0} 章</b>章节
                  </span>
                  <span>
                    <b className="num">{fmt(words)}</b>总字数
                  </span>
                </div>
                <div className="foot">
                  <span className="updated">更新于 {relTime(p.updated_at)}</span>
                  <span className="go">
                    {stage === "done" ? "查看" : "继续创作"}
                    <Ico d={P.arrowRight} />
                  </span>
                </div>
                {menuFor === p.id && (
                  <div ref={menuRef} className="card-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setMenuFor(null);
                        setRenameTarget(p);
                      }}
                    >
                      <Ico d={P.pencil} />
                      重命名
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        setMenuFor(null);
                        setDeleteTarget(p);
                      }}
                    >
                      <Ico d={P.trash} />
                      删除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreate}
        onClose={() => { setShowCreate(false); }}
        onCreated={handleCreated}
        isMember={isMember}
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
