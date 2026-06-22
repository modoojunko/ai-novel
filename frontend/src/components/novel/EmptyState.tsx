interface EmptyStateProps {
  onCreateVolume?: () => void;
  onCreateChapter?: () => void;
  onGoSettings?: () => void;
}

export default function EmptyState({
  onCreateVolume,
  onCreateChapter,
  onGoSettings,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      {/* Decorative book icon — 30% opacity */}
      <span className="text-8xl opacity-30 select-none">📖</span>

      {/* Title */}
      <h2 className="text-2xl font-serif font-semibold text-base-content">
        开始写你的第一部小说
      </h2>

      {/* Description */}
      <p className="text-base text-base-content/50 max-w-sm text-center">
        你的故事还没有任何内容，从这里开始你的创作之旅吧。
      </p>

      {/* Action cards row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onCreateVolume}
          className="px-5 py-3 rounded-lg border bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20 transition-colors"
        >
          📚 创建第一卷
        </button>
        <button
          onClick={onCreateChapter}
          className="px-5 py-3 rounded-lg border bg-base-200 border-base-300 text-base-content hover:bg-base-300 transition-colors"
        >
          ✍️ 直接写第一章
        </button>
        <button
          onClick={onGoSettings}
          className="px-5 py-3 rounded-lg border bg-base-200 border-base-300 text-base-content hover:bg-base-300 transition-colors"
        >
          📋 先去设定
        </button>
      </div>

      {/* Divider */}
      <div className="w-full max-w-md border-t border-base-300" />

      {/* Hint text */}
      <p className="text-sm text-base-content/40 max-w-md text-center leading-relaxed">
        💡 建议顺序：先建卷（写卷纲），再在卷下建章（写章纲），最后写正文。每一步都可以 AI 辅助，但不是必须的。
      </p>
    </div>
  );
}
