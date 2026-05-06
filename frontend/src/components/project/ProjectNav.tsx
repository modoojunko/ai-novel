"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/settings", label: "Settings" },
  { href: "/outline", label: "Outline" },
  { href: "/prompts", label: "Prompts" },
  { href: "/write", label: "Write" },
  { href: "/archives", label: "Archives" },
  { href: "/threads", label: "Threads" },
];

export function ProjectNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/project/${slug}`;

  return (
    <nav className="flex gap-1 border-b border-border px-6 py-2 bg-card">
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
    </nav>
  );
}
