"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
  current_phase: string;
  total_chapters: number;
  updated_at: string;
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.get("/projects")
      .then(setProjects)
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const p = await api.post("/projects", { name });
      toast.success(`Project "${p.name}" created`);
      router.push(`/project/${p.slug}`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-serif-heading)] text-primary">
          My Projects
        </h1>
      </div>

      <div className="flex gap-4 mb-8">
        <Input
          placeholder="New project name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          disabled={creating}
        />
        <Button onClick={create} disabled={creating || !name.trim()}>
          <Plus className="w-4 h-4 mr-2" />
          {creating ? "Creating..." : "New Project"}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-2 font-[family-name:var(--font-serif-heading)]">No projects yet</p>
          <p className="text-sm">Create one above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/20 transition-all"
              onClick={() => router.push(`/project/${p.slug}`)}
            >
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Phase: {p.current_phase} · Chapters: {p.total_chapters}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Updated: {new Date(p.updated_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
