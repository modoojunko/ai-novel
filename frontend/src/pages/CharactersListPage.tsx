import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Plus, Users, ArrowRight, Trash2 } from "lucide-react";

export default function CharactersListPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
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
    navigate(`/project/${slug}/settings/characters/${encodeURIComponent(name)}`);
  }

  async function remove(name: string) {
    await api.put(`/projects/${projectId}/settings/character/${name}`, null);
    setCharacters(characters.filter((c) => c !== name));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-serif flex items-center gap-2">
          <Users className="w-6 h-6" /> 角色管理
        </h2>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          className="input input-bordered flex-1"
          placeholder="新角色名称..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="btn btn-primary" onClick={create} disabled={!newName.trim()}>
          <Plus className="w-4 h-4" />创建
        </button>
      </div>

      <div className="space-y-2">
        {characters.map((name) => (
          <div
            key={name}
            className="card bg-base-200 border border-base-300 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
            onClick={() => navigate(`/project/${slug}/settings/characters/${encodeURIComponent(name)}`)}
          >
            <div className="card-body py-4 flex flex-row items-center justify-between">
              <span className="font-medium">{name}</span>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(name);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ArrowRight className="w-4 h-4 text-base-content/40" />
              </div>
            </div>
          </div>
        ))}
        {characters.length === 0 && (
          <p className="text-base-content/60 text-center py-8">暂无角色，请在上方创建你的第一个角色。</p>
        )}
      </div>
    </div>
  );
}
