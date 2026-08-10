import {
  Book,
  PenLine,
  Lightbulb,
} from "lucide-react";

interface EmptyStateProps {
  onCreateVolume?: () => void;
  onCreateChapter?: () => void;
}

export default function EmptyState({
  onCreateVolume,
  onCreateChapter,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div className="text-5xl">✍️</div>
      <h2 className="text-2xl font-serif font-semibold text-base-content">
        开始写你的第一部小说
      </h2>
      <p className="text-base text-base-content/50 max-w-sm text-center">
        先写正文，随时可以回来配置设定与大纲。你的故事还没有任何内容，从这里开始你的创作之旅吧。
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
      </div>
      <div className="w-full max-w-md border-t border-base-300" />
      <p className="text-sm text-base-content/40 max-w-md text-center leading-relaxed flex items-center gap-2 justify-center">
        <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
        先写正文不受任何前置限制；想先铺设定或大纲，随时可从顶部「编辑设定」进入。
      </p>
    </div>
  );
}
