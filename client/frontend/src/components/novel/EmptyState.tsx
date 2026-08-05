import {
  ClipboardList,
  Book,
  PenLine,
  BookOpen,
  Lightbulb,
} from "lucide-react";

interface EmptyStateProps {
  onCreateVolume?: () => void;
  onCreateChapter?: () => void;
  onGoSettings?: () => void;
  settingsComplete?: boolean;
  /** PRD 3.4 AC-4.3：「仍然继续」旁路——作者选择继续创作后不再提示设定未完成 */
  bypass?: boolean;
}

export default function EmptyState({
  onCreateVolume,
  onCreateChapter,
  onGoSettings,
  settingsComplete = true,
  bypass = false,
}: EmptyStateProps) {
  if (!settingsComplete && !bypass) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
        <ClipboardList className="w-16 h-16 opacity-30 text-base-content/40" />
        <h2 className="text-2xl font-serif font-semibold text-base-content">
          设定尚未全部完成
        </h2>
        <p className="text-base text-base-content/50 max-w-sm text-center leading-relaxed">
          请先完成所有设定项的确认，再开始创建卷和章节。
          设定确认后可以随时回来修改。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onGoSettings}
            className="px-5 py-3 rounded-lg border bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20 transition-colors inline-flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" />
            先去设定
          </button>
          <button
            onClick={onCreateVolume}
            className="px-5 py-3 rounded-lg border bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300 transition-colors inline-flex items-center gap-2"
          >
            <Book className="w-4 h-4" />
            创建第一卷
          </button>
          <button
            onClick={onCreateChapter}
            className="px-5 py-3 rounded-lg border bg-base-200 border-base-300 text-base-content/50 hover:bg-base-300 transition-colors inline-flex items-center gap-2"
          >
            <PenLine className="w-4 h-4" />
            直接写第一章
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <BookOpen className="w-16 h-16 opacity-30 text-base-content/40" />
      <h2 className="text-2xl font-serif font-semibold text-base-content">
        开始写你的第一部小说
      </h2>
      <p className="text-base text-base-content/50 max-w-sm text-center">
        你的故事还没有任何内容，从这里开始你的创作之旅吧。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onCreateVolume}
          className="px-5 py-3 rounded-lg border bg-primary/10 border-primary/30 text-primary font-medium hover:bg-primary/20 transition-colors inline-flex items-center gap-2"
        >
          <Book className="w-4 h-4" />
          创建第一卷
        </button>
        <button
          onClick={onCreateChapter}
          className="px-5 py-3 rounded-lg border bg-base-200 border-base-300 text-base-content hover:bg-base-300 transition-colors inline-flex items-center gap-2"
        >
          <PenLine className="w-4 h-4" />
          直接写第一章
        </button>
        <button
          onClick={onGoSettings}
          className="px-5 py-3 rounded-lg border bg-base-200 border-base-300 text-base-content hover:bg-base-300 transition-colors inline-flex items-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          先去设定
        </button>
      </div>
      <div className="w-full max-w-md border-t border-base-300" />
      <p className="text-sm text-base-content/40 max-w-md text-center leading-relaxed flex items-center gap-2 justify-center">
        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
        建议顺序：先建卷（写卷纲），再在卷下建章（写章纲），最后写正文。每一步都可以 AI 辅助，但不是必须的。
      </p>
    </div>
  );
}
