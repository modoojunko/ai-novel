"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";

const FIELD_DEFS: { key: string; label: string; type: "text" | "textarea" }[] = [
  { key: "summary", label: "Summary", type: "textarea" },
  { key: "cognition", label: "Cognition", type: "textarea" },
  { key: "worldview", label: "World View", type: "textarea" },
  { key: "self_identity", label: "Self Identity", type: "text" },
  { key: "values", label: "Values", type: "text" },
  { key: "abilities", label: "Abilities", type: "text" },
  { key: "skills", label: "Skills", type: "text" },
  { key: "environment", label: "Environment", type: "text" },
  { key: "appearance", label: "Appearance", type: "textarea" },
  { key: "background", label: "Background", type: "textarea" },
  { key: "story_role", label: "Story Role", type: "text" },
];

export default function CharacterEditorPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const name = decodeURIComponent((params?.name as string) || "");
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<Record<string, any>>({});
  const [relationships, setRelationships] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId || !name) return;
    api.get(`/projects/${projectId}/settings/character/${name}`).then((d) => {
      setData(d || {});
      setRelationships(d.relationships || []);
    }).catch(() => {});
  }, [projectId, name]);

  async function save() {
    if (!projectId) return;
    setSaving(true);
    const payload = { ...data, relationships };
    await api.put(`/projects/${projectId}/settings/character/${name}`, payload);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addRelationship() {
    setRelationships([...relationships, { character: "", type: "", description: "" }]);
  }

  function updateRelationship(idx: number, field: string, value: string) {
    const copy = [...relationships];
    copy[idx] = { ...copy[idx], [field]: value };
    setRelationships(copy);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>
        <h2 className="text-2xl font-bold">{name}</h2>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input value={data.name || name} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </div>
          {FIELD_DEFS.map((f) => (
            <div key={f.key}>
              <label className="text-sm font-medium mb-1 block">{f.label}</label>
              {f.type === "textarea" ? (
                <Textarea
                  rows={4}
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Relationships</CardTitle>
          <Button variant="outline" size="sm" onClick={addRelationship}>
            <Plus className="w-4 h-4 mr-2" />Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {relationships.map((r, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input
                className="flex-1"
                placeholder="Character"
                value={r.character}
                onChange={(e) => updateRelationship(i, "character", e.target.value)}
              />
              <Input
                className="w-24"
                placeholder="Type"
                value={r.type}
                onChange={(e) => updateRelationship(i, "type", e.target.value)}
              />
              <Input
                className="flex-1"
                placeholder="Description"
                value={r.description}
                onChange={(e) => updateRelationship(i, "description", e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRelationships(relationships.filter((_, j) => j !== i))}
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          ))}
          {relationships.length === 0 && (
            <p className="text-muted-foreground text-sm">No relationships defined.</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        {saved ? "Saved!" : "Save Character"}
      </Button>
    </div>
  );
}
