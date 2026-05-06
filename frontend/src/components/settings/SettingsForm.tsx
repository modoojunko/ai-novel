"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2 } from "lucide-react";

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "list";
  placeholder?: string;
};

export function SettingsForm({
  settingsType,
  title,
  fields,
  listFields,
}: {
  settingsType: string;
  title: string;
  fields: FieldDef[];
  listFields?: { key: string; label: string; itemLabel: string }[];
}) {
  const params = useParams();
  const slug = params?.slug as string;
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<Record<string, any>>({});
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => {
      setProjectId(p.id);
    });
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api
      .get(`/projects/${projectId}/settings/${settingsType}`)
      .then((d) => {
        setData(d || {});
        const l: Record<string, string[]> = {};
        listFields?.forEach((lf) => {
          l[lf.key] = Array.isArray(d[lf.key]) ? d[lf.key] : d[lf.key] || [];
        });
        setLists(l);
      })
      .catch(() => {});
  }, [projectId, settingsType]);

  async function save() {
    if (!projectId) return;
    setSaving(true);
    const payload = { ...data };
    Object.entries(lists).forEach(([k, v]) => {
      payload[k] = v.filter(Boolean);
    });
    await api.put(`/projects/${projectId}/settings/${settingsType}`, payload);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addItem(listKey: string) {
    setLists((prev) => ({ ...prev, [listKey]: [...(prev[listKey] || []), ""] }));
  }

  function updateItem(listKey: string, idx: number, value: string) {
    setLists((prev) => {
      const copy = [...(prev[listKey] || [])];
      copy[idx] = value;
      return { ...prev, [listKey]: copy };
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((f) =>
            f.type === "textarea" ? (
              <div key={f.key}>
                <label className="text-sm font-medium mb-1 block">{f.label}</label>
                <Textarea
                  rows={5}
                  placeholder={f.placeholder}
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              </div>
            ) : (
              <div key={f.key}>
                <label className="text-sm font-medium mb-1 block">{f.label}</label>
                <Input
                  placeholder={f.placeholder}
                  value={data[f.key] || ""}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                />
              </div>
            )
          )}

          {listFields?.map((lf) => (
            <div key={lf.key}>
              <label className="text-sm font-medium mb-1 block">{lf.label}</label>
              <div className="space-y-2">
                {(lists[lf.key] || []).map((item, i) => (
                  <Input
                    key={i}
                    placeholder={`${lf.itemLabel} #${i + 1}`}
                    value={item}
                    onChange={(e) => updateItem(lf.key, i, e.target.value)}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={() => addItem(lf.key)}>
                  + Add {lf.itemLabel}
                </Button>
              </div>
            </div>
          ))}

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved!" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
