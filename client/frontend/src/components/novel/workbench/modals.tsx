// 书工作台弹窗群（book.html 遮罩弹窗的 React 化，PR 5）：
//   DeleteConfirmModal  删除确认（章=内容盘点 chips / 卷=带章数字数文案）
//   UnlockModal         解除只读（归档章 AI 链的前置确认）
//   ArchiveModal        归档本章
//   HistoryModal        版本历史（wide · ver-rows + 恢复；产品扩展=行内对比）
//   AiModal             AI 生成正文（tall · 提示词预览可编辑 + 追加语义提示）
// 文案与结构与原型 modalDelete/modalUnlock/modalArchive/modalHistory/modalAi 逐字对齐；
// 产品化差异（升级跳 S端 等）见 docs/design-c/prototypes/ADJUSTMENTS.md。
import { useEffect, useState } from "react";
import Modal from "@/components/design/Modal";
import VersionDiff from "@/components/novel/VersionDiff";
import { api, request } from "@/lib/api";
import { toast } from "@/lib/toast";

const fmt = (n: number) => n.toLocaleString("zh-CN");

// ---------------------------------------------------------------------------
// 删除确认（分级：空章无盘点；有内容章 chips 盘点；卷带章数字数）
// ---------------------------------------------------------------------------

export function DeleteConfirmModal({
  open,
  onClose,
  kind,
  title,
  chips,
  chapterCount,
  totalWords,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  kind: "chapter" | "volume";
  /** 名称（不含序号前缀，#164 名称即标题口径） */
  title: string;
  /** 章：内容盘点（章纲已确认 / 章纲草稿 / 自定义提示词 / 正文 N 字） */
  chips: string[];
  /** 卷：卷内章数与总字数 */
  chapterCount: number;
  totalWords: number;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="删除确认"
      wbStyle
      hideClose
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "var(--err)" }}
            data-testid="del-confirm"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            确认删除
          </button>
        </>
      }
    >
      {kind === "chapter" ? (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
          确定删除章节 <b>《{title}》</b>？
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
          确定删除卷 <b>《{title}》</b> 及其全部 {chapterCount} 章（{fmt(totalWords)} 字）？
        </p>
      )}
      {kind === "chapter" && chips.length > 0 && (
        <div className="del-inventory">
          <span className="inv-title">本章包含</span>
          {chips.map((c) => (
            <span key={c} className="inv-chip">
              {c}
            </span>
          ))}
        </div>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
        此操作不可恢复。
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 解除只读（归档章点 AI → 确认解锁并继续）
// ---------------------------------------------------------------------------

export function UnlockModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="解除只读"
      wbStyle
      hideClose
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            data-testid="unlock-confirm"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            解除只读并继续
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
        本章已<b>归档</b>，正文处于<b>只读</b>状态。
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
        AI 生成将解除只读并继续编辑，请确认是否继续。
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 归档本章
// ---------------------------------------------------------------------------

export function ArchiveModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="归档本章"
      wbStyle
      hideClose
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            data-testid="arch-confirm"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            归档本章
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>
        归档后本章正文进入<b>只读</b>状态；大纲树与进度卡同步标记。
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
        仍可在版本历史中查看与恢复。
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// 版本历史（wide；行 = vtime / 版本 N · M 字 / 备注 / 当前 | 恢复）
// ---------------------------------------------------------------------------

interface VersionRow {
  version: string;
  time: number;
  comment: string;
  isCurrent: boolean;
  words?: number;
}

/** 版本时间（原型形态：今天 HH:mm / 昨天 HH:mm / N 天前 HH:mm / 更早 M月D日 HH:mm）。 */
function fmtVersionTime(ms: number): string {
  if (!ms) return "—";
  // 后端为 13 位毫秒；历史脏数据可能为秒级 → 归一
  const t = ms > 1e12 ? ms : ms * 1000;
  const d = new Date(t);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  if (days <= 0) return `今天 ${hm}`;
  if (days === 1) return `昨天 ${hm}`;
  if (days < 7) return `${days} 天前 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

export function HistoryModal({
  open,
  onClose,
  projectId,
  chapterRef,
  label,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  chapterRef: string;
  /** 章标签（第一章 · 锚点） */
  label: string;
  /** 恢复成功回调（刷新章 store / 树） */
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  // 产品扩展（ADJUSTMENTS）：行内行/词对比，默认旧=所选版本、新=当前
  const [diffOld, setDiffOld] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setDiffOld(null);
    api
      .get(`/novels/${projectId}/chapters/${chapterRef}/versions`)
      .then((data: VersionRow[]) => setVersions(Array.isArray(data) ? data : []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [open, projectId, chapterRef]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    try {
      await api.post(
        `/novels/${projectId}/chapters/${chapterRef}/versions/${versionId}/restore`,
      );
      toast.success("已恢复至该版本");
      onRestored();
      onClose();
    } catch {
      toast.error("恢复失败，请重试");
    } finally {
      setRestoring(null);
    }
  };

  const currentId = versions.find((v) => v.isCurrent)?.version;
  const showDiff = diffOld && currentId && diffOld !== currentId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`版本历史 · ${label}`}
      wbStyle
      width={620}
      footer={
        <button className="btn btn-secondary" onClick={onClose}>
          关闭
        </button>
      }
    >
      {loading ? (
        <p style={{ margin: 0, padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          加载中…
        </p>
      ) : versions.length === 0 ? (
        <p style={{ margin: 0, padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
          暂无版本记录
        </p>
      ) : showDiff ? (
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => setDiffOld(null)}>
            返回列表
          </button>
          <VersionDiff
            projectId={projectId}
            chapterRef={chapterRef}
            versions={versions}
            initialOldVersionId={diffOld ?? undefined}
            initialNewVersionId={currentId}
          />
        </div>
      ) : (
        <div id="hist-list">
          {versions.map((v, i) => (
            <div className="ver-row" key={v.version}>
              <span className="vtime">{fmtVersionTime(v.time)}</span>
              <div className="vinfo">
                <b>
                  {v.isCurrent
                    ? "当前版本"
                    : `版本 ${versions.length - i}${v.words ? ` · ${fmt(v.words)} 字` : ""}`}
                </b>
                <span>{v.comment || "自动保存"}</span>
              </div>
              {v.isCurrent ? (
                <span className="cur">当前</span>
              ) : (
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={restoring !== null}
                    onClick={() => setDiffOld(v.version)}
                  >
                    对比
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={restoring !== null}
                    onClick={() => void handleRestore(v.version)}
                  >
                    {restoring === v.version ? "恢复中…" : "恢复"}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// AI 生成正文（tall；提示词由「设定 + 章纲」组装、可编辑、确认后流式追加）
// ---------------------------------------------------------------------------

export function AiModal({
  open,
  onClose,
  projectId,
  chapterRef,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  chapterRef: string;
  /** 携带编辑后的提示词启动生成 */
  onConfirm: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [hasOutline, setHasOutline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    request(`/novels/${projectId}/chapters/${chapterRef}/write/prompt`, {
      quiet: true,
    })
      .then((d: { prompt?: string; has_outline?: boolean }) => {
        if (cancelled) return;
        setPrompt(d?.prompt ?? "");
        setHasOutline(!!d?.has_outline);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message || "提示词组装失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, chapterRef, reloadKey]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 生成正文"
      wbStyle
      width={560}
      afterTitle={
        <span className="ai-tag">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 6.2L21 9l-5 4.4 1.6 6.6L12 16.6 6.4 20 8 13.4 3 9l6.6-.8z" />
          </svg>
          PRO
        </span>
      }
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            data-testid="ai-confirm"
            disabled={loading || !!error}
            onClick={() => {
              onClose();
              onConfirm(prompt);
            }}
          >
            生成正文
          </button>
        </>
      }
    >
      <div className="field">
        <label>
          本章提示词 <span className="opt">由「设定 + 章纲」自动组装，可直接编辑</span>
        </label>
        <textarea
          className="ai-prompt"
          value={prompt}
          disabled={loading}
          placeholder={loading ? "组装中…" : ""}
          onChange={(e) => setPrompt(e.target.value)}
          data-testid="ai-prompt"
        />
      </div>
      {error ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--err)" }}>
          {error}·
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            重试
          </button>
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)" }}>
          {hasOutline
            ? "提示词已由设定与章纲组装 · 可直接编辑。生成内容将追加到本章末尾。"
            : "本章尚未配置章纲，将仅依据设定生成。建议先去「大纲」补章纲（不强制）。"}
        </p>
      )}
    </Modal>
  );
}
