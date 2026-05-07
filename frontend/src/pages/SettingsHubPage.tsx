import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { BookOpen, Palette, Shield, Anchor, Users, CheckCircle2, Circle } from "lucide-react";

const SECTIONS = [
  { key: "world", label: "世界设定", desc: "时代、地点、地理、政治、文化", icon: BookOpen },
  { key: "style", label: "写作风格", desc: "角色、核心原则、禁忌、技巧、类型", icon: Palette },
  { key: "anti-ai", label: "反AI规则", desc: "疲劳词黑名单、禁用句式", icon: Shield },
  { key: "hooks", label: "伏笔面板", desc: "伏笔生命周期追踪", icon: Anchor },
  { key: "characters", label: "角色管理", desc: "角色档案与状态历史", icon: Users },
];

export default function SettingsHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => {
      const pid = p.id;
      Promise.all(
        ["world", "style", "anti-ai", "hooks"].map(async (t) => {
          try {
            const d = await api.get(`/projects/${pid}/settings/${t}`);
            return { key: t, has: Object.keys(d).length > 0 };
          } catch {
            return { key: t, has: false };
          }
        })
      ).then((results) => {
        const c: Record<string, boolean> = {};
        results.forEach((r) => (c[r.key] = r.has));
        setChecks(c);
      });
    });
  }, [slug]);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold font-serif mb-6">项目设定</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <div
            key={s.key}
            className="card bg-base-200 border border-base-300 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-shadow"
            onClick={() => navigate(`/project/${slug}/settings/${s.key}`)}
          >
            <div className="card-body p-4">
              <div className="flex items-center gap-3">
                <s.icon className="w-5 h-5 text-primary/60" />
                <div className="flex-1">
                  <h3 className="card-title text-base">{s.label}</h3>
                </div>
                {checks[s.key] ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Circle className="w-4 h-4 text-base-content/20" />
                )}
              </div>
              <p className="text-sm text-base-content/60 mt-1">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
