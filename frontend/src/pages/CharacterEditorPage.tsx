import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Save, Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";

const FIELD_DEFS: { key: string; label: string; type: "text" | "textarea" }[] = [
  { key: "summary", label: "摘要", type: "textarea" },
  { key: "cognition", label: "认知", type: "textarea" },
  { key: "worldview", label: "世界观", type: "textarea" },
  { key: "self_identity", label: "自我认同", type: "text" },
  { key: "values", label: "价值观", type: "text" },
  { key: "abilities", label: "能力", type: "text" },
  { key: "skills", label: "技能", type: "text" },
  { key: "environment", label: "环境", type: "text" },
  { key: "appearance", label: "外貌", type: "textarea" },
  { key: "background", label: "背景", type: "textarea" },
  { key: "story_role", label: "故事角色", type: "text" },
];

export default function CharacterEditorPage() {
  const { slug, name: encodedName } = useParams<{ slug: string; name: string }>();
  const name = decodeURIComponent(encodedName || "");
  const navigate = useNavigate();
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
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />返回
        </button>
        <h2 className="text-2xl font-bold font-serif">{name}</h2>
      </div>

      <div className="card bg-base-200 border border-base-300 mb-6">
        <div className="card-body">
          <h3 className="card-title text-base">基本信息</h3>
          <div className="space-y-4">
            <div>
              <label className="label py-1">
                <span className="label-text text-xs font-medium">名称</span>
              </label>
              <input
                className="input input-bordered w-full"
                value={data.name || name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
              />
            </div>
            {FIELD_DEFS.map((f) => (
              <div key={f.key}>
                <label className="label py-1">
                  <span className="label-text text-xs font-medium">{f.label}</span>
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    className="textarea textarea-bordered w-full h-24"
                    value={data[f.key] || ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="input input-bordered w-full"
                    value={data[f.key] || ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 mb-6">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h3 className="card-title text-base">角色关系</h3>
            <button className="btn btn-ghost btn-sm" onClick={addRelationship}>
              <Plus className="w-4 h-4" />添加
            </button>
          </div>
          <div className="space-y-3">
            {relationships.map((r, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder="角色"
                  value={r.character}
                  onChange={(e) => updateRelationship(i, "character", e.target.value)}
                />
                <input
                  className="input input-bordered input-sm w-24"
                  placeholder="关系类型"
                  value={r.type}
                  onChange={(e) => updateRelationship(i, "type", e.target.value)}
                />
                <input
                  className="input input-bordered input-sm flex-1"
                  placeholder="描述"
                  value={r.description}
                  onChange={(e) => updateRelationship(i, "description", e.target.value)}
                />
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => setRelationships(relationships.filter((_, j) => j !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {relationships.length === 0 && (
              <p className="text-base-content/60 text-sm">暂无关系定义。</p>
            )}
          </div>
        </div>
      </div>

      <button className="btn btn-primary w-full" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "已保存！" : "保存角色"}
      </button>
    </div>
  );
}
