import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Ico, P } from "@/components/icons";
import { isLoggedIn } from "@/lib/auth";
import { PORTAL_URL } from "@/lib/portal";

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

  // 从作品列表「了解套餐」带 state.scrollTo 进入时，落地后滚到套餐区块
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (target) {
      requestAnimationFrame(() => scrollTo(target));
    }
  }, [location.state]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      {/* Nav */}
      <nav className="mkt-nav">
        <div className="mkt-nav-in">
          <button onClick={() => scrollTo("top")} className="mkt-logo">
            爱<b>小说</b>
          </button>
          <div className="mkt-navlinks">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="nl bg-transparent border-none cursor-pointer"
              >
                {s.label}
              </button>
            ))}
            <a href={GH_REPO} target="_blank" rel="noopener noreferrer" className="gh no-underline">
              <Ico d={P.star} size={13} />
              Star
            </a>
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
               style={{ background: "radial-gradient(ellipse, color-mix(in oklch, var(--accent) 8%, transparent) 0%, transparent 60%)" }} />
          <div className="absolute top-[40%] left-[15%] w-[300px] h-[300px] rounded-full"
               style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--warn) 4%, transparent) 0%, transparent 50%)" }} />
          <div className="absolute top-[30%] right-[15%] w-[300px] h-[300px] rounded-full"
               style={{ background: "radial-gradient(circle, color-mix(in oklch, var(--accent) 4%, transparent) 0%, transparent 50%)" }} />
        </div>

        <div className="mkt-in relative text-center">
          <span className="mkt-pill">
            <Ico d={P.spark} size={14} />
            AI 辅助长篇小说写作平台
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold serif leading-tight mb-6 max-w-4xl mx-auto">
            从空白文档到完整小说<br />
            <span className="mkt-grad-text">AI 陪你走完每一步</span>
          </h1>

          <p className="text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: "var(--muted)" }}>
            从世界设定到卷章管理，从逐章写作到版本回溯。
            AI 是笔，你才是作家。
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/login" className="btn btn-primary btn-lg px-8 text-base">
              免费开始写作
            </Link>
            <button
              onClick={() => scrollTo("how")}
              className="btn btn-ghost btn-lg px-8 text-base"
            >
              查看完整工作流 →
            </button>
          </div>
        </div>
      </section>

      {/* ───── Pain Points ───── */}
      <section id="pain-points" className="mkt-section">
        <div className="mkt-in">
          <div className="mb-12 animate-fade-up">
            <span className="mkt-eyebrow">创作之痛</span>
            <h2 className="mkt-h2">写小说最大的障碍，不是写得不好</h2>
            <p className="mkt-lead max-w-lg">
              是根本没开始写。或者写了一万字之后，发现前面全要推翻重来。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              [P.doc as string, "空白页恐惧", "每次打开文档面对闪烁的光标，脑子里有故事却不知道从哪下笔。AI 帮你把「想写」变成「在写」的第一步。"],
              [P.list as string, "大纲混乱、人设崩塌", "写到一半发现角色行为前后矛盾，情节漏洞越来越多。用结构化工作流从源头管理世界、角色、时间线。"],
              [P.refresh as string, "反复推翻重写", "写完三章觉得风格不对，删掉重来——循环三次，热情耗尽。写作前先定风格、定视角，减少 80% 返工。"],
            ].map(([icon, title, desc], i) => (
              <div
                key={title as string}
                className="mkt-card cursor-default animate-fade-up"
                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              >
                <div className="ico"><Ico d={icon as string} size={18} /></div>
                <h3>{title as string}</h3>
                <p>{desc as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section id="how" className="mkt-section alt">
        <div className="mkt-in">
          <div className="mb-14 text-center animate-fade-up">
            <span className="mkt-eyebrow">工作流程</span>
            <h2 className="mkt-h2">小说结构驱动创作</h2>
            <p className="mkt-lead max-w-lg mx-auto">
              设定世界、分卷规划、逐章写作。所有内容你亲手掌控，AI 随叫随到。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12">
            {[
              ["01", "设定世界", "世界规则、角色、风格。每个设定项独立存储，可随时回溯。"],
              ["02", "分卷规划", "创建卷，写卷纲。在卷下建章，每章可写章纲规划场景。"],
              ["03", "逐章写作", "每章独立编辑章纲和正文。写一页是一页，自动保存版本。"],
            ].map(([num, title, desc], i) => (
              <div key={num as string} className="text-center animate-fade-up" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                <div className="mkt-step-dot">{num as string}</div>
                <h3 className="text-lg font-semibold serif mb-3">{title as string}</h3>
                <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: "var(--muted)" }}>{desc as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="mkt-section">
        <div className="mkt-in">
          <div className="mb-14 animate-fade-up">
            <span className="mkt-eyebrow">为什么选择爱小说</span>
            <h2 className="mkt-h2">不只是生成文字，而是帮你写出好故事</h2>
            <p className="mkt-lead max-w-lg">
              所有的 AI 能力都围绕一个目标：让你更高效地写出更高质量的长篇小说。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              [P.eye as string, "上下文感知生成", "AI 知道前文情节、当前角色状态、风格规则，生成的内容和已有章节自然衔接。"],
              [P.search as string, "六维质量检测", "每段生成后自动做 6 项质量检查：逻辑、风格、角色、密度、语言、节奏。"],
              [P.pencil as string, "风格模板系统", "从爽文到严肃文学，设定一次，全书所有 AI 输出自动对齐你的风格。"],
              [P.chart as string, "用量透明可控", "按 token 计费，模型可选（Haiku / Sonnet）。每段写作前预估算量，不会出现意外账单。"],
            ].map(([icon, title, desc], i) => (
              <div
                key={title as string}
                className="mkt-card flex gap-5 items-start cursor-default animate-fade-up"
                style={{ animationDelay: `${0.1 + i * 0.08}s` }}
              >
                <div className="ico" style={{ marginBottom: 0, flex: "none" }}><Ico d={icon as string} size={18} /></div>
                <div className="min-w-0">
                  <h3 style={{ marginTop: 1 }}>{title as string}</h3>
                  <p>{desc as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 套餐 / Pricing ───── */}
      <section id="pricing" className="mkt-section alt">
        <div className="mkt-in">
          <div className="mb-14 text-center animate-fade-up">
            <span className="mkt-eyebrow">套餐</span>
            <h2 className="mkt-h2">免费写作，按需升级</h2>
            <p className="mkt-lead max-w-lg mx-auto">
              手工创作全免费，AI 能力按 Token 计费。用多少，付多少。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* 免费版 */}
            <div className="mkt-plan free">
              <h3>免费版</h3>
              <p className="sub">手工创作，永远免费</p>
              <div className="feats">
                {[
                  "卷章管理（树形结构）",
                  "正文手写编辑",
                  "版本历史与回溯",
                  "归档阅读",
                  "卷章配置",
                  "进阶设定入口",
                  "8 项创作设定",
                ].map((f) => (
                  <div key={f} className="f">
                    <Ico d={P.check} size={14} style={{ color: "var(--ok)" }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link to="/login" className="btn btn-secondary btn-block mt-8">免费开始</Link>
            </div>

            {/* PRO 版 */}
            <div className="mkt-plan pro">
              <span className="mkt-pro-pill">PRO</span>
              <h3>PRO 版</h3>
              <p className="sub">解锁全部 AI 能力</p>
              <div className="feats">
                {[
                  "AI 设定生成（文风/世界/反AI）",
                  "章纲进阶字段",
                  "AI 正文生成（SSE 流式）",
                  "提示词面板",
                  "模型自由选择（Haiku / Sonnet）",
                ].map((f) => (
                  <div key={f} className="f">
                    <Ico d={P.spark} size={14} style={{ color: "var(--accent)" }} />
                    {f}
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <a href={PORTAL_URL} target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
                  去授权中心开通
                  <Ico d={P.external} size={13} />
                </a>
                <p className="text-xs text-center mt-2" style={{ color: "var(--muted)" }}>支持 7 天免费试用 · 按月 / 按年订阅</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="mkt-section relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
             style={{ background: "linear-gradient(to right, transparent, color-mix(in oklch, var(--accent) 25%, transparent), transparent)" }} />
        <div className="mkt-in text-center relative">
          <h2 className="mkt-h2">现在开始，写你的第一部小说</h2>
          <p className="mkt-lead max-w-md mx-auto mb-10">
            不需要等待灵感，不需要万字规划。打开浏览器，从第一句话开始。
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/login" className="btn btn-primary btn-lg px-10 text-base">
              免费开始 →
            </Link>
            <a href={GH_REPO} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-lg px-10 text-base">
              <Ico d={P.star} size={15} />
              去 GitHub 点 Star
            </a>
          </div>
          <div className="mt-8">
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm inline-flex items-center gap-1.5 no-underline"
              style={{ color: "var(--muted)" }}
            >
              <Ico d={P.chat} size={14} />
              提建议 / 反馈问题
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mkt-foot">
        <div className="mkt-foot-in">
          <span>爱小说 · AI 辅助长篇小说写作平台</span>
          <a href={GH_REPO} target="_blank" rel="noopener noreferrer" className="no-underline">GitHub</a>
        </div>
      </footer>
    </div>
  );
}
