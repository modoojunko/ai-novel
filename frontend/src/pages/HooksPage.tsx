import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

export default function HooksPage() {
  const { slug } = useParams<{ slug: string }>();
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
    const h = { id: `hook-${Date.now()}`, description: "", introduced_in: "", type: "mystery", status: "pending", resolve_plan: "" };
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
    active: "badge-primary",
    pending: "badge-ghost",
    resolved: "badge-success",
    abandoned: "badge-error",
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-serif">伏笔面板</h2>
        <button className="btn btn-primary btn-sm" onClick={add}>
          <Plus className="w-4 h-4" />新建伏笔
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4 text-sm font-medium text-base-content/60 px-4">
        <div>ID</div>
        <div className="col-span-2">描述</div>
        <div>类型</div>
        <div>状态 / 解决</div>
      </div>

      <div className="space-y-2">
        {hooks.map((h, i) => (
          <div key={i} className="card bg-base-200 border border-base-300">
            <div className="card-body py-3">
              <div className="flex gap-2 items-center">
                <input className="input input-bordered input-sm w-20" value={h.id} onChange={e => update(i, "id", e.target.value)} />
                <input className="input input-bordered input-sm flex-1" placeholder="伏笔描述..." value={h.description} onChange={e => update(i, "description", e.target.value)} />
                <select
                  className="select select-bordered select-sm"
                  value={h.type}
                  onChange={e => update(i, "type", e.target.value)}
                >
                  {["mystery", "conflict", "character", "relationship"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex gap-1 items-center">
                  <select
                    className={`select select-bordered select-sm ${STATUS_COLORS[h.status] || ""}`}
                    value={h.status}
                    onChange={e => update(i, "status", e.target.value)}
                  >
                    {["active", "pending", "resolved", "abandoned"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input className="input input-bordered input-sm w-24" placeholder="解决章节" value={h.resolve_plan} onChange={e => update(i, "resolve_plan", e.target.value)} />
                </div>
                <button className="btn btn-ghost btn-sm text-error" onClick={() => remove(i)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary mt-4" onClick={() => save(hooks)}>保存伏笔</button>
    </div>
  );
}
