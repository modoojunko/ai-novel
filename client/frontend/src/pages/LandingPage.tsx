import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "@/components/novel/ThemeToggle";
import { isLoggedIn } from "@/lib/auth";

const GH_REPO = "https://github.com/modoojunko/ai-novel";
const FEEDBACK_URL = `${GH_REPO}/issues/new`;

const SECTIONS = [
  { id: "pain-points", label: "创作之痛" },
  { id: "how", label: "工作流" },
  { id: "features", label: "特色" },
  { id: "pricing", label: "套餐" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function LandingPage() {
  const location = useLocation();

  // 从作品列表「了解套餐」等入口跳转过来时，滚动到套餐区块
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (target) {
      const timer = setTimeout(() => scrollTo(target), 80);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-base-100/70 border-b border-base-300/20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
          <button onClick={() => scrollTo("top")} className="text-xl font-display tracking-wide text-base-content no-underline cursor-pointer bg-transparent border-none">
            爱<span className="text-primary">小说</span>
          </button>
          <div className="flex items-center gap-6">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="text-sm text-base-content/50 hover:text-base-content transition-colors bg-transparent border-none cursor-pointer"
              >
                {s.label}
              </button>
            ))}
            <a
              href={GH_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-base-content/50 hover:text-base-content transition-colors no-underline hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-base-300/30"
            >
              ⭐ Star
            </a>
            <ThemeToggle />
            {(() => {
              const logged = isLoggedIn();
              return logged ? (
                <Link to="/novels" className="btn btn-primary btn-sm">
                  我的作品
                </Link>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm">
                  登录
                </Link>
              );
            })()}
          </div>
        </div>
      </nav>

      {/* ───── Hero ───── */}
      <section id="top" className="relative overflow-hidden pt-24 pb-28 lg:pt-32 lg:pb-36">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full"
               style={{ background: "radial-gradient(ellipse, rgba(212,163,115,0.08) 0%, transparent 60%)" }} />
          <div className="absolute top-[40%] left-[15%] w-[300px] h-[300px] rounded-full"
               style={{ background: "radial-gradient(circle, rgba(232,200,122,0.04) 0%, transparent 50%)" }} />
          <div className="absolute top-[30%] right-[15%] w-[300px] h-[300px] rounded-full"
               style={{ background: "radial-gradient(circle, rgba(212,163,115,0.04) 0%, transparent 50%)" }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 lg:px-8 relative text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                        bg-primary/10 border border-primary/15 text-primary text-sm mb-8">
            🎯 AI 辅助长篇小说写作平台
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-serif leading-tight mb-6 max-w-4xl mx-auto">
            <span className="text-base-content">从空白文档到完整小说<br /></span>
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              AI 陪你走完每一步
            </span>
          </h1>

          <p className="text-lg lg:text-xl text-base-content/50 leading-relaxed max-w-2xl mx-auto mb-10">
            从世界设定到卷章管理，从逐章写作到版本回溯。
            AI 是笔，你才是作家。
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/login" className="btn btn-primary btn-lg px-8 text-base">
              免费开始写作
            </Link>
            <button
              onClick={() => scrollTo("how")}
              className="btn btn-ghost btn-lg px-8 text-base text-base-content/50 hover:text-base-content"
            >
              查看完整工作流 →
            </button>
          </div>
        </div>
      </section>

      {/* ───── Pain Points ───── */}
      <section id="pain-points" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="mb-12 animate-fade-up">
            <span className="text-xs tracking-[0.25em] text-primary font-medium">创作之痛</span>
            <h2 className="text-3xl lg:text-4xl font-bold font-serif mt-3 mb-4">
              写小说最大的障碍，不是写得不好
            </h2>
            <p className="text-base text-base-content/50 max-w-lg">
              是根本没开始写。或者写了一万字之后，发现前面全要推翻重来。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              ["😰", "空白页恐惧", "每次打开文档面对闪烁的光标，脑子里有故事却不知道从哪下笔。AI 帮你把「想写」变成「在写」的第一步。"],
              ["🕸️", "大纲混乱、人设崩塌", "写到一半发现角色行为前后矛盾，情节漏洞越来越多。用结构化工作流从源头管理世界、角色、时间线。"],
              ["🔄", "反复推翻重写", "写完三章觉得风格不对，删掉重来——循环三次，热情耗尽。写作前先定风格、定视角，减少 80% 返工。"],
            ].map(([icon, title, desc], i) => (
              <div
                key={title as string}
                className={`group rounded-xl p-8 bg-base-200/60 border border-base-300/40
                            hover:bg-base-200 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5
                            transition-all duration-300 cursor-default animate-fade-up animate-fade-up-${i + 1}`}
              >
                <span className="text-3xl block mb-5">{icon}</span>
                <h3 className="text-lg font-semibold font-serif mb-3">{title as string}</h3>
                <p className="text-sm text-base-content/50 leading-relaxed">{desc as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section id="how" className="py-20 lg:py-28 bg-base-200/30">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="mb-14 text-center animate-fade-up">
            <span className="text-xs tracking-[0.25em] text-primary font-medium">工作流程</span>
            <h2 className="text-3xl lg:text-4xl font-bold font-serif mt-3 mb-4">
              小说结构驱动创作
            </h2>
            <p className="text-base text-base-content/50 max-w-lg mx-auto">
              设定世界、分卷规划、逐章写作。所有内容你亲手掌控，AI 随叫随到。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12">
            {[
              ["01", "设定世界", "世界规则、角色、风格。每个设定项独立存储，可随时回溯。"],
              ["02", "分卷规划", "创建卷，写卷纲。在卷下建章，每章可写章纲规划场景。"],
              ["03", "逐章写作", "每章独立编辑章纲和正文。写一页是一页，自动保存版本。"],
            ].map(([num, title, desc], i) => (
              <div key={num as string} className="text-center group animate-fade-up" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20
                              flex items-center justify-center mx-auto mb-5
                              group-hover:bg-primary/20 group-hover:border-primary/30
                              transition-all duration-300">
                  <span className="text-sm font-medium text-primary font-display">{num as string}</span>
                </div>
                <h3 className="text-lg font-semibold font-serif mb-3">{title as string}</h3>
                <p className="text-sm text-base-content/50 leading-relaxed max-w-xs mx-auto">{desc as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="mb-14 animate-fade-up">
            <span className="text-xs tracking-[0.25em] text-primary font-medium">为什么选择爱小说</span>
            <h2 className="text-3xl lg:text-4xl font-bold font-serif mt-3 mb-4">
              不只是生成文字，而是帮你写出好故事
            </h2>
            <p className="text-base text-base-content/50 max-w-lg">
              所有的 AI 能力都围绕一个目标：让你更高效地写出更高质量的长篇小说。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              ["🧠", "上下文感知生成", "AI 知道前文情节、当前角色状态、风格规则，生成的内容和已有章节自然衔接。"],
              ["🔍", "六维质量检测", "每段生成后自动做 6 项质量检查：逻辑、风格、角色、密度、语言、节奏。"],
              ["🎨", "风格模板系统", "从爽文到严肃文学，设定一次，全书所有 AI 输出自动对齐你的风格。"],
              ["📊", "用量透明可控", "按 token 计费，模型可选（Haiku / Sonnet）。每段写作前预估算量，不会出现意外账单。"],
            ].map(([icon, title, desc], i) => (
              <div
                key={title as string}
                className="flex gap-5 p-7 rounded-xl bg-base-200/50 border border-base-300/30
                          hover:bg-base-200 hover:border-primary/15 hover:shadow-lg hover:shadow-primary/5
                          transition-all duration-300 group cursor-default animate-fade-up"
                style={{ animationDelay: `${0.1 + i * 0.08}s` }}
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/15
                              flex items-center justify-center flex-shrink-0 text-xl
                              group-hover:bg-primary/20 transition-colors duration-300">
                  {icon as string}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold font-serif mb-2">{title as string}</h4>
                  <p className="text-sm text-base-content/50 leading-relaxed">{desc as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Pricing / 套餐 ───── */}
      <section id="pricing" className="py-20 lg:py-28 bg-base-200/30">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="mb-14 text-center animate-fade-up">
            <span className="text-xs tracking-[0.25em] text-primary font-medium">套餐与权益</span>
            <h2 className="text-3xl lg:text-4xl font-bold font-serif mt-3 mb-4">
              免费也能写完一本小说
            </h2>
            <p className="text-base text-base-content/50 max-w-lg mx-auto">
              先免费开始创作，按需再解锁 AI 辅助能力。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="rounded-2xl p-8 bg-base-100 border border-primary/25 shadow-sm relative">
              <span className="absolute top-4 right-4 badge badge-ghost badge-sm">当前可用</span>
              <h3 className="text-lg font-semibold font-serif mb-2">免费版</h3>
              <p className="text-sm text-base-content/50 leading-relaxed mb-5">
                手工创作 1 本小说：设定、卷纲、章纲、正文、归档全流程可用，不依赖任何 AI 配置。
              </p>
              <ul className="text-sm space-y-2 text-base-content/70">
                <li>✓ 六阶段创作流程完整可用</li>
                <li>✓ 卷 / 章管理、版本回溯</li>
                <li>✓ 不配置 API Key 也能开始</li>
              </ul>
            </div>

            <div className="rounded-2xl p-8 bg-base-100 border border-base-300 shadow-sm relative">
              <span className="absolute top-4 right-4 badge badge-primary badge-sm">即将开放</span>
              <h3 className="text-lg font-semibold font-serif mb-2">付费版</h3>
              <p className="text-sm text-base-content/50 leading-relaxed mb-5">
                解锁 AI 辅助与更多作品额度：AI 草稿、设定反推、续写润色等能力随套餐开放。
              </p>
              <ul className="text-sm space-y-2 text-base-content/70">
                <li>✓ 更多作品数量</li>
                <li>✓ AI 草稿 + 人工审核</li>
                <li>✓ 优先体验新能力</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center relative">
          <h2 className="text-3xl lg:text-4xl font-bold font-serif mb-4">
            现在开始，写你的第一部小说
          </h2>
          <p className="text-base text-base-content/50 max-w-md mx-auto mb-10">
            不需要等待灵感，不需要万字规划。打开浏览器，从第一句话开始。
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/login"
              className="btn btn-primary btn-lg px-10 text-base"
            >
              免费开始 →
            </Link>
            <a
              href={GH_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-lg px-10 text-base text-base-content/50"
            >
              ⭐ 去 GitHub 点 Star
            </a>
          </div>
          <div className="mt-8">
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-base-content/40 hover:text-base-content/60 transition-colors inline-flex items-center gap-1.5 no-underline"
            >
              💬 提建议 / 反馈问题
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-base-300/30">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex items-center justify-center gap-6 text-sm text-base-content/30">
          <span>爱小说 · AI 辅助长篇小说写作平台</span>
          <span className="text-base-content/10">|</span>
          <a href={GH_REPO} target="_blank" rel="noopener noreferrer" className="text-base-content/30 hover:text-base-content/60 transition-colors no-underline">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
