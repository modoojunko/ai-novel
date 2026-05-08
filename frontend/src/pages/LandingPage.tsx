import { Link } from "react-router-dom";

const GH_REPO = "https://github.com/modoojunko/ai-novel";
const GH_STAR_URL = `${GH_REPO}`;
const FEEDBACK_URL = `${GH_REPO}/issues/new`;

function SmoothAnchor({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) {
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }); }} {...rest}>
      {children}
    </a>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "#0a0e17", color: "#e2e8f0" }}>
      <style>{`
        .lp { max-width: 1100px; margin: 0 auto; padding: 0 32px; }
        .lp-blue { color: #60a5fa; }
        .lp-muted { color: #64748b; }
        .lp-card { background: rgba(30,41,59,0.5); border: 1px solid rgba(148,163,184,0.06); border-radius: 12px; padding: 32px; transition: all 0.2s; cursor: default; }
        .lp-card:hover { background: rgba(30,41,59,0.7); border-color: rgba(59,130,246,0.2); }
        .lp-gradient { background: linear-gradient(135deg, #f1f5f9 0%, #93c5fd 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .lp-btn { padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 500; text-decoration: none; display: inline-block; transition: all 0.2s; cursor: pointer; }
        .lp-btn-primary { background: #3b82f6; color: #fff; border: none; }
        .lp-btn-primary:hover { background: #2563eb; }
        .lp-btn-outline { background: transparent; border: 1px solid rgba(148,163,184,0.2); color: #94a3b8; }
        .lp-btn-outline:hover { border-color: rgba(148,163,184,0.4); color: #e2e8f0; }
        .lp-tag { display: inline-block; padding: 6px 16px; border-radius: 999px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); font-size: 13px; color: #93c5fd; margin-bottom: 24px; }
        .lp-nav { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); background: rgba(10,14,23,0.8); }
      `}</style>

      {/* Fixed Nav */}
      <nav className="lp-nav flex items-center justify-between px-4 lg:px-8" style={{ padding: "16px 32px", maxWidth: 1164, margin: "0 auto" }}>
        <SmoothAnchor href="#top" className="text-xl font-bold tracking-wide no-underline" style={{ color: "#f1f5f9", cursor: "pointer" }}>
          爱<span style={{ color: "#60a5fa" }}>小说</span>
        </SmoothAnchor>
        <div className="flex items-center gap-6">
          <SmoothAnchor href="#how" className="text-sm no-underline" style={{ color: "#94a3b8" }}>工作流</SmoothAnchor>
          <SmoothAnchor href="#features" className="text-sm no-underline" style={{ color: "#94a3b8" }}>特色</SmoothAnchor>
          <a href={GH_STAR_URL} target="_blank" rel="noopener noreferrer" className="text-sm no-underline hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md" style={{ color: "#94a3b8", border: "1px solid rgba(148,163,184,0.15)" }}>
            ⭐ Star
          </a>
          <Link to="/login" className="text-sm no-underline" style={{ color: "#94a3b8" }}>登录</Link>
          <Link to="/register" className="text-sm no-underline text-white px-5 py-2 rounded-lg font-medium" style={{ background: "#3b82f6" }}>
            开始使用
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section id="top" className="text-center px-4 lg:px-8" style={{ padding: "80px 32px 60px", position: "relative" }}>
        <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 800, height: 600, background: "radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="lp" style={{ position: "relative" }}>
          <div className="lp-tag">🎯 AI 辅助长篇小说写作平台</div>
          <h1 className="lp-gradient" style={{ fontSize: "clamp(36px, 5.5vw, 56px)", fontWeight: 700, lineHeight: 1.15, maxWidth: 700, margin: "0 auto 20px" }}>
            从空白文档到完整小说<br />AI 陪你走完每一步
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1.8, maxWidth: 520, margin: "0 auto 36px" }}>
            六阶段工作流：世界搭建 → 风格设定 → 大纲推演 → 逐段写作 → 质量检查 → 归档成稿。AI 是笔，你才是作家。
          </p>
          <div className="flex gap-4 justify-center" style={{ flexWrap: "wrap" }}>
            <Link to="/register" className="lp-btn lp-btn-primary">免费开始写作</Link>
            <SmoothAnchor href="#how" className="lp-btn lp-btn-outline">查看完整工作流 →</SmoothAnchor>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="px-4 lg:px-8" style={{ padding: "80px 32px" }}>
        <div className="lp">
          <div style={{ fontSize: 13, color: "#60a5fa", letterSpacing: "0.3em", marginBottom: 12 }}>创作之痛</div>
          <h2 style={{ fontSize: 32, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 }}>写小说最大的障碍，不是写得不好</h2>
          <p style={{ fontSize: 15, color: "#64748b", maxWidth: 480, marginBottom: 48 }}>是根本没开始写。或者写了一万字之后，发现前面全要推翻重来。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              ["😰", "空白页恐惧", "每次打开文档面对闪烁的光标，脑子里有故事却不知道从哪下笔。AI 帮你把「想写」变成「在写」的第一步。"],
              ["🕸️", "大纲混乱、人设崩塌", "写到一半发现角色行为前后矛盾，情节漏洞越来越多。用结构化工作流从源头管理世界、角色、时间线。"],
              ["🔄", "反复推翻重写", "写完三章觉得风格不对，删掉重来——循环三次，热情耗尽。写作前先定风格、定视角，减少 80% 返工。"],
            ].map(([icon, title, desc]) => (
              <div key={title as string} className="lp-card">
                <span style={{ fontSize: 28, display: "block", marginBottom: 16 }}>{icon}</span>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>{title as string}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{desc as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-4 lg:px-8" style={{ padding: "80px 32px" }}>
        <div className="lp">
          <div style={{ fontSize: 13, color: "#60a5fa", letterSpacing: "0.3em", marginBottom: 12 }}>工作流程</div>
          <h2 style={{ fontSize: 32, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 }}>六阶段，走完一部小说</h2>
          <p style={{ fontSize: 15, color: "#64748b", maxWidth: 480, marginBottom: 48 }}>从零到一，每个阶段都有 AI 辅助，但决定权永远在你手里。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ position: "relative" }}>
            {[
              ["1", "世界搭建", "设定世界观、规则、地理、势力。AI 帮你扩展细节，保持内部逻辑自洽。"],
              ["2", "风格设定", "定义叙事风格、节奏、视角。所有 AI 生成都对齐你定下的风格规则。"],
              ["3", "大纲推演", "分卷、分章、分节。拖拽调整结构，AI 检测节奏问题和逻辑漏洞。"],
              ["4", "提示词生成", "基于大纲自动生成每节的写作提示词，也可手动精调引导 AI 输出。"],
              ["5", "逐段写作", "AI 逐段生成内容，实时 SSE 流式输出。随时暂停、重写、调整方向。"],
              ["6", "归档成稿", "质量检查（逻辑、风格、文法）通过后归档。可回溯任意历史版本。"],
            ].map(([num, title, desc]) => (
              <div key={num as string} className="text-center">
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 14, fontWeight: 600, color: "#60a5fa" }}>
                  {num}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>{title as string}</h3>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, maxWidth: 280, margin: "0 auto" }}>{desc as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 lg:px-8" style={{ padding: "80px 32px" }}>
        <div className="lp">
          <div style={{ fontSize: 13, color: "#60a5fa", letterSpacing: "0.3em", marginBottom: 12 }}>为什么选择爱小说</div>
          <h2 style={{ fontSize: 32, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 }}>不只是生成文字，而是帮你写出好故事</h2>
          <p style={{ fontSize: 15, color: "#64748b", maxWidth: 480, marginBottom: 48 }}>所有的 AI 能力都围绕一个目标：让你更高效地写出更高质量的长篇小说。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              ["🧠", "上下文感知生成", "AI 知道前文情节、当前角色状态、风格规则，生成的内容和已有章节自然衔接。"],
              ["🔍", "六维质量检测", "每段生成后自动做 6 项质量检查：逻辑、风格、角色、密度、语言、节奏。"],
              ["🎨", "风格模板系统", "从爽文到严肃文学，设定一次，全书所有 AI 输出自动对齐你的风格。"],
              ["📊", "用量透明可控", "按 token 计费，模型可选（Haiku / Sonnet）。每段写作前预估算量，不会出现意外账单。"],
            ].map(([icon, title, desc]) => (
              <div key={title as string} className="flex gap-5 p-7 rounded-xl items-start" style={{ background: "rgba(30,41,59,0.3)", border: "1px solid rgba(148,163,184,0.06)", color: "inherit" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {icon}
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{title as string}</h4>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{desc as string}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-4 lg:px-8" style={{ padding: "80px 32px 60px" }}>
        <div className="lp">
          <h2 style={{ fontSize: 36, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 }}>现在开始，写你的第一部小说</h2>
          <p style={{ fontSize: 16, color: "#64748b", marginBottom: 36 }}>不需要等待灵感，不需要万字规划。打开浏览器，从第一句话开始。</p>
          <div className="flex gap-4 justify-center" style={{ flexWrap: "wrap" }}>
            <Link to="/register" className="lp-btn lp-btn-primary" style={{ padding: "16px 48px", fontSize: 18 }}>
              免费开始 →
            </Link>
            <a href={GH_STAR_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-outline" style={{ padding: "16px 48px", fontSize: 18 }}>
              ⭐ 去 GitHub 点 Star
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8" style={{ fontSize: 14, color: "#64748b" }}>
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 no-underline" style={{ color: "#94a3b8" }}>
              💬 提建议 / 反馈问题
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm" style={{ color: "#475569", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="lp" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24 }}>
          <span>爱小说 · AI 辅助长篇小说写作平台</span>
          <span style={{ color: "rgba(71,85,105,0.5)" }}>|</span>
          <a href={`${GH_REPO}`} target="_blank" rel="noopener noreferrer" style={{ color: "#64748b", textDecoration: "none" }}>GitHub</a>
        </div>
      </footer>
    </div>
  );
}
