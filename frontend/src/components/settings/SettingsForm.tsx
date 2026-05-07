import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface FieldDef {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
}

interface ListFieldDef {
  key: string;
  label: string;
  itemLabel: string;
}

export default function SettingsForm({
  settingsType,
  title,
  fields,
  listFields = [],
}: {
  settingsType: string;
  title: string;
  fields: FieldDef[];
  listFields?: ListFieldDef[];
}) {
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<Record<string, string>>({});
  const [lists, setLists] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const slug = window.location.hash.split("/")[2];
    if (!slug) return;
    api
      .get(`/projects/by-slug/${slug}`)
      .then((p: any) => {
        setProjectId(p.id);
        return api.get(`/projects/${p.id}/settings/${settingsType}`);
      })
      .then((s: any) => {
        if (s) {
          const d: Record<string, string> = {};
          const l: Record<string, string[]> = {};
          for (const [k, v] of Object.entries(s)) {
            if (Array.isArray(v)) l[k] = v;
            else if (typeof v === "string") d[k] = v;
          }
          setData(d);
          setLists(l);
        }
      })
      .catch(() => {});
  }, [settingsType]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const payload: Record<string, unknown> = { ...data };
      for (const lf of listFields) {
        payload[lf.key] = lists[lf.key] || [];
      }
      await api.put(`/projects/${projectId}/settings/${settingsType}`, payload);
      setSaved(true);
      toast.success(`${title}已保存`);
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  function addItem(key: string) {
    setLists((p) => ({ ...p, [key]: [...(p[key] || []), ""] }));
  }

  function updateItem(key: string, idx: number, val: string) {
    setLists((p) => {
      const copy = [...(p[key] || [])];
      copy[idx] = val;
      return { ...p, [key]: copy };
    });
  }

  function removeItem(key: string, idx: number) {
    setLists((p) => ({
      ...p,
      [key]: (p[key] || []).filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-serif font-bold text-primary mb-6">{title}</h2>
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body gap-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label py-1">
                <span className="label-text text-xs font-medium">{f.label}</span>
              </label>
              {f.type === "textarea" ? (
                <textarea
                  className="textarea textarea-bordered w-full h-24 text-sm"
                  value={data[f.key] || ""}
                  onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  className="input input-bordered w-full text-sm"
                  value={data[f.key] || ""}
                  onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}

          {listFields.map((lf) => (
            <div key={lf.key}>
              <div className="flex items-center justify-between py-1">
                <span className="label-text text-xs font-medium">{lf.label}</span>
                <button
                  className="btn btn-xs btn-ghost text-primary"
                  onClick={() => addItem(lf.key)}
                >
                  + 添加
                </button>
              </div>
              <div className="space-y-1">
                {(lists[lf.key] || []).map((item, i) => (
                  <div key={i} className="flex gap-1">
                    <input
                      className="input input-bordered input-sm flex-1 text-xs"
                      placeholder={`${lf.itemLabel} ${i + 1}`}
                      value={item}
                      onChange={(e) => updateItem(lf.key, i, e.target.value)}
                    />
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removeItem(lf.key, i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card-actions justify-end pt-2">
            <button
              className={`btn btn-primary btn-sm ${saving ? "btn-disabled" : ""}`}
              onClick={save}
              disabled={saving}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : null}
              {saving ? "保存中..." : saved ? "已保存 ✓" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
