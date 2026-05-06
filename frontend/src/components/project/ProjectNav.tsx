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
    <nav className="flex gap-1 border-b px-6 py-2 bg-white">
      {links.map((l) => (
        <Link
          key={l.href}
          href={`${base}${l.href}`}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            pathname.startsWith(`${base}${l.href}`)
              ? "bg-black text-white"
              : "hover:bg-gray-100 text-gray-600"
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
