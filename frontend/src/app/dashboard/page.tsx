"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [name, setName] = useState("");
  const router = useRouter();

  useEffect(() => {
    api.get("/projects").then(setProjects).catch(console.error);
  }, []);

  async function create() {
    if (!name.trim()) return;
    try {
      const p = await api.post("/projects", { name });
      router.push(`/project/${p.slug}`);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Projects</h1>
      </div>

      <div className="flex gap-4 mb-8">
        <Input
          placeholder="New project name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {projects.length === 0 && (
        <p className="text-gray-400 text-center py-12">
          No projects yet. Create one to get started.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {projects.map((p) => (
          <Card
            key={p.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/project/${p.slug}`)}
          >
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Phase: {p.current_phase} · Chapters: {p.total_chapters}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Updated: {new Date(p.updated_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
