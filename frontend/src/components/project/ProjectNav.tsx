"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PhaseProgress } from "./PhaseProgress";

const links = [
  { href: "/settings", label: "设定" },
  { href: "/outline", label: "大纲" },
  { href: "/prompts", label: "提示词" },
  { href: "/write", label: "写作" },
  { href: "/archives", label: "存档" },
  { href: "/threads", label: "线索" },
];

function phaseFromPath(pathname: string, base: string): string {
  for (const l of links) {
    if (pathname.startsWith(`${base}${l.href}`)) return l.href.slice(1);
  }
  return "settings";
}

export function ProjectNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/project/${slug}`;
  const currentPhase = phaseFromPath(pathname, base);

  return (
    <nav className="border-b border-border bg-card">
      <PhaseProgress current={currentPhase} />
      <div className="flex gap-1 px-6 py-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={`${base}${l.href}`}
            className={cn(
              "relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              "after:absolute after:bottom-[-9px] after:left-1/2 after:-translate-x-1/2 after:h-0.5 after:rounded-full after:transition-all after:duration-200",
              pathname.startsWith(`${base}${l.href}`)
                ? "text-primary after:w-full after:bg-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted after:w-0"
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
