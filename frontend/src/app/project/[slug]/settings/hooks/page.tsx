"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

export default function HooksPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [projectId, setProjectId] = useState("");
  const [hooks, setHooks] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/settings/hooks`).then((d) => {
      setHooks(d.hooks || []);
    });
  }, [projectId]);

  async function save(updated: any[]) {
    await api.put(`/projects/${projectId}/settings/hooks`, { hooks: updated });
    setHooks(updated);
  }

  function add() {
    const h = { id: `hook-${Date.now()}`, description: "", introduced_in: "", type: "mystery", status: "planned", resolve_plan: "" };
    save([...hooks, h]);
  }

  function update(idx: number, field: string, value: string) {
    const updated = [...hooks];
    updated[idx][field] = value;
    setHooks(updated);
  }

  function remove(idx: number) {
    save(hooks.filter((_, i) => i !== idx));
  }

  const STATUS_COLORS: Record<string, string> = {
    planned: "bg-muted",
    mentioned: "bg-primary/20 text-primary",
    reinforced: "bg-amber-800/30 text-amber-300",
    resolved: "bg-emerald-800/30 text-emerald-300",
    abandoned: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Hooks Board</h2>
        <Button onClick={add}><Plus className="w-4 h-4 mr-2" />New Hook</Button>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4 text-sm font-medium text-muted-foreground px-4">
        <div>ID</div>
        <div className="col-span-2">Description</div>
        <div>Type</div>
        <div>Status / Resolve</div>
      </div>

      <div className="space-y-2">
        {hooks.map((h, i) => (
          <Card key={i}>
            <CardContent className="flex gap-2 py-3 items-center">
              <Input className="w-20" value={h.id} onChange={e => update(i, "id", e.target.value)} />
              <Input className="flex-1" placeholder="Hook description..." value={h.description} onChange={e => update(i, "description", e.target.value)} />
              <select
                className="border rounded px-2 py-1 text-sm"
                value={h.type}
                onChange={e => update(i, "type", e.target.value)}
              >
                {["mystery", "conflict", "character", "relationship"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className="flex gap-1 items-center">
                <select
                  className={`border rounded px-2 py-1 text-sm ${STATUS_COLORS[h.status] || ""}`}
                  value={h.status}
                  onChange={e => update(i, "status", e.target.value)}
                >
                  {["planned", "mentioned", "reinforced", "resolved", "abandoned"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Input className="w-24" placeholder="Resolve in" value={h.resolve_plan} onChange={e => update(i, "resolve_plan", e.target.value)} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(i)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="mt-4" onClick={() => save(hooks)}>Save Hooks</Button>
    </div>
  );
}
