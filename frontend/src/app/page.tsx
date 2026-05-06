import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 relative overflow-hidden">
      {/* Lamp glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.72 0.15 72 / 12%), transparent 60%)",
        }}
      />

      {/* Heading */}
      <div className="relative z-10 text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight font-[family-name:var(--font-serif-heading)] text-primary">
          NovelForge
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
          AI-assisted novel writing — from world-building to final prose,
          guided by a 6-phase workflow in the quiet warmth of the late-night
          study.
        </p>
      </div>

      {/* CTAs */}
      <div className="relative z-10 flex gap-4 mt-4">
        <Link
          href="/register"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium
                     hover:shadow-[0_0_20px_var(--primary)] transition-shadow duration-300"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 border border-border rounded-lg font-medium
                     text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Sign In
        </Link>
      </div>

      {/* Subtle decoration — a faint Chinese verse */}
      <p className="absolute bottom-8 text-muted-foreground/30 text-sm font-[family-name:var(--font-serif-heading)] italic tracking-wider">
        夜深人静，笔墨纸砚
      </p>
    </main>
  );
}
