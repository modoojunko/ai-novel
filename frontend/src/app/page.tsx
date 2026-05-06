import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-center px-12 md:px-24 lg:px-32 relative">
      <div className="max-w-2xl">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight font-[family-name:var(--font-serif-heading)] text-primary mb-6">
          NovelForge
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg leading-relaxed mb-8">
          AI 辅助长篇小说写作——从世界搭建到最终成稿，
          六阶段工作流陪你走完创作的每一步。
        </p>
        <div className="flex gap-4">
          <Link
            href="/register"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium
                       hover:shadow-[0_0_24px_var(--primary)] transition-shadow duration-300"
          >
            开始写作
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-border rounded-lg font-medium
                       text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            登录
          </Link>
        </div>
      </div>
      <p className="absolute bottom-8 right-12 text-muted-foreground/25 text-sm font-[family-name:var(--font-serif-heading)] italic tracking-wider">
        夜深人静，笔墨纸砚
      </p>
    </main>
  );
}
