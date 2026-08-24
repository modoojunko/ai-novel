import { Ico, P } from "@/components/icons";
import Modal from "@/components/design/Modal";

interface AISuggestionModalProps {
  open: boolean;
  fieldLabel: string;
  content: string;
  loading: boolean;
  onAccept: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export default function AISuggestionModal({
  open, fieldLabel, content, loading, onAccept, onRetry, onClose,
}: AISuggestionModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={"AI 建议 · " + fieldLabel}
      width={520}
      footer={
        !loading ? (
          <>
            <button onClick={onRetry} className="btn btn-ghost btn-sm">
              <Ico d={P.refresh} size={13} />
              换一个
            </button>
            <button onClick={onAccept} className="btn btn-primary btn-sm">
              <Ico d={P.check} size={13} />
              接受这个
            </button>
          </>
        ) : undefined
      }
    >
      <div className="min-h-[120px] max-h-[300px] overflow-y-auto mb-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Ico d={P.spinner} className="spin" size={26} style={{ color: "var(--accent)" }} />
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              AI 正在生成…
            </span>
          </div>
        ) : (
          <div
            className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap serif"
            style={{
              background: "var(--fg-soft)",
              border: "1px solid var(--border)",
              color: "color-mix(in oklch, var(--fg) 80%, transparent)",
            }}
          >
            {content}
          </div>
        )}
      </div>
    </Modal>
  );
}
