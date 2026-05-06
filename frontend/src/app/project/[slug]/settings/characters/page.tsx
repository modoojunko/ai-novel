"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Users, ArrowRight, Trash2 } from "lucide-react";

export default function CharactersListPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [characters, setCharacters] = useState<string[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/settings/characters/list`).then(setCharacters).catch(() => {});
  }, [projectId]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    await api.put(`/projects/${projectId}/settings/character/${name}`, {
      name,
      summary: "",
      cognition: "",
      worldview: "",
      self_identity: "",
      values: "",
      abilities: "",
      skills: "",
      environment: "",
      relationships: [],
      appearance: "",
      background: "",
      story_role: "",
      state_history: [],
    });
    setCharacters([...characters, name]);
    setNewName("");
    router.push(`/project/${slug}/settings/characters/${encodeURIComponent(name)}`);
  }

  async function remove(name: string) {
    await api.put(`/projects/${projectId}/settings/character/${name}`, null);
    setCharacters(characters.filter((c) => c !== name));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" /> 角色管理
        </h2>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="新角色名称..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create} disabled={!newName.trim()}>
          <Plus className="w-4 h-4 mr-2" />创建
        </Button>
      </div>

      <div className="space-y-2">
        {characters.map((name) => (
          <Card
            key={name}
            className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
            onClick={() => router.push(`/project/${slug}/settings/characters/${encodeURIComponent(name)}`)}
          >
            <CardContent className="flex items-center justify-between py-4">
              <span className="font-medium">{name}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(name);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </Button>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {characters.length === 0 && (
          <p className="text-muted-foreground text-center py-8">暂无角色，请在上方创建你的第一个角色。</p>
        )}
      </div>
    </div>
  );
}
