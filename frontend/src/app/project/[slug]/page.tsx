"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";

const PHASE_ROUTES: Record<string, string> = {
  init: "/settings",
  settings: "/settings",
  outline: "/outline",
  prompt: "/prompts",
  write: "/write",
  archive: "/archives",
};

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  useEffect(() => {
    api
      .get(`/projects`)
      .then((projects: { slug: string; current_phase: string }[]) => {
        const p = projects.find((p) => p.slug === slug);
        const route = PHASE_ROUTES[p?.current_phase || "init"] || "/settings";
        router.replace(`/project/${slug}${route}`);
      })
      .catch(() => router.replace(`/project/${slug}/settings`));
  }, [slug, router]);

  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-gray-400">Loading project...</p>
    </div>
  );
}
