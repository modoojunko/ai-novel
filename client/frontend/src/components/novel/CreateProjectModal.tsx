import { useEffect, useReducer, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import Modal from "@/components/design/Modal";
import { Ico, P } from "@/components/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModalAction = { type: "SET_NAME"; value: string } | { type: "SET_GENRE"; value: string } | { type: "DISMISS" };

interface ModalState {
  name: string;
  genre: string;
}

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (novelId: string) => void;
  /** 是否有效会员（免费层或套餐过期均为 false，与后端 require_project_limit 口径一致） */
  isMember?: boolean;
  /** Current novel count, for free-limit check */
  novelCount?: number;
}

// ---------------------------------------------------------------------------
// Reducer — 极简两字段：书名 + 类型（选填），list.html modalCreate 原样
// ---------------------------------------------------------------------------

const INITIAL: ModalState = {
  name: "",
  genre: "",
};

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.value };
    case "SET_GENRE":
      return { ...state, genre: action.value };
    case "DISMISS":
      return { ...INITIAL };
    default:
      return state;
  }
}

const GENRE_OPTIONS = ["玄幻", "科幻", "都市", "悬疑", "武侠", "历史", "其他"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateProjectModal({
  open,
  onClose,
  onCreated,
  isMember,
  novelCount,
}: CreateProjectModalProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      dispatch({ type: "DISMISS" });
      setSubmitting(false);
    }
  }, [open]);

  // Focus the name input when the modal opens（原型 60ms 后聚焦）
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  async function handleCreate() {
    const name = state.name.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      const novel = await api.createNovel({
        name,
        source: "manual",
        genre: state.genre,
      });
      toast.success(`已创建《${novel.name}》，正在进入这本书…`);
      onCreated(novel.id);
    } catch {
      toast.error("创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  // 口径=页面级 !isMember（过期会员也拦，与后端 require_project_limit 一致）
  const freeLimitReached =
    isMember === false && novelCount !== undefined && novelCount >= 1;
  const canCreate = state.name.trim().length > 0 && !freeLimitReached && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={submitting}
      title="新建作品"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button className="btn btn-primary" onClick={() => void handleCreate()} disabled={!canCreate}>
            {submitting ? "创建中…" : "创建并开始写作"}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="bkTitle">书名</label>
        <input
          id="bkTitle"
          ref={inputRef}
          className="input"
          placeholder="起个名字，10 秒内就能开始写"
          maxLength={30}
          value={state.name}
          onChange={(e) => dispatch({ type: "SET_NAME", value: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
          disabled={submitting}
        />
      </div>
      <div className="field">
        <label htmlFor="bkGenre">
          类型 <span style={{ color: "var(--muted)", fontSize: 11 }}>选填</span>
        </label>
        <select
          id="bkGenre"
          className="input"
          value={state.genre}
          onChange={(e) => dispatch({ type: "SET_GENRE", value: e.target.value })}
          disabled={submitting}
        >
          {/* 空值=暂不选择（「选填」语义；原型 option 表无此项，产品侧扩展） */}
          <option value="">暂不选择</option>
          {GENRE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <p className="hint">
        创建后<b>直接进入这本书</b>。一本书两个模块：设定与大纲——大纲里点章，即可配章纲、看提示词、写正文；设定随时可补。
      </p>
      {freeLimitReached && (
        <p className="hint" style={{ marginTop: 10, background: "var(--warn-soft)" }}>
          免费用户限 1 本。升级套餐可创建更多小说。
        </p>
      )}
    </Modal>
  );
}
