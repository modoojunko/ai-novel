import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";

const PHASE_ROUTES: Record<string, string> = {
  init: "/settings",
  settings: "/settings",
  outline: "/outline",
  prompt: "/prompts",
  write: "/write",
  archive: "/archives",
};

export default function ProjectRedirectPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    api
      .get("/projects")
      .then((projects: { slug: string; current_phase: string }[]) => {
        const p = projects.find((p) => p.slug === slug);
        const route = PHASE_ROUTES[p?.current_phase || "init"] || "/settings";
        navigate(`/project/${slug}${route}`, { replace: true });
      })
      .catch(() => navigate(`/project/${slug}/settings`, { replace: true }));
  }, [slug, navigate]);

  return (
    <div className="flex items-center justify-center py-24">
      <span className="loading loading-spinner loading-md text-primary" />
    </div>
  );
}
