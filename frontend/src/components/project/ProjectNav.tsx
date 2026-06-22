import { Link, useLocation, useParams } from "react-router-dom";
import PhaseProgress from "./PhaseProgress";

const TABS = [
  { href: "settings", label: "设定" },
  { href: "outline", label: "大纲" },
  { href: "prompts", label: "细纲" },
  { href: "write", label: "写作" },
  { href: "archives", label: "正文" },
  { href: "threads", label: "线索" },
];

function currentPhase(pathname: string): string {
  for (const t of TABS) {
    if (pathname.includes(`/${t.href}`)) return t.href;
  }
  return "settings";
}

export default function ProjectNav() {
  const { slug } = useParams<{ slug: string }>();
  const loc = useLocation();
  const base = `/project/${slug}`;
  const phase = currentPhase(loc.pathname);

  return (
    <nav className="border-b border-base-300/60 bg-base-200/80 backdrop-blur-sm">
      <PhaseProgress current={phase} />
      <div className="tabs tabs-bordered px-6">
        {TABS.map((t) => {
          const active = loc.pathname.startsWith(`${base}/${t.href}`);
          return (
            <Link
              key={t.href}
              to={`${base}/${t.href}`}
              className={`tab tab-sm ${active ? "tab-active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
