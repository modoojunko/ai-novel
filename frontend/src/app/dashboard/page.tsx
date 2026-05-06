"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardSkeleton } from "@/components/ui/skeleton";
import { AiSuggestButton } from "@/components/ui/ai-suggest-button";
import { Plus } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  init: "初始化",
  settings: "设定",
  outline: "大纲",
  prompts: "提示词",
  write: "写作",
  archives: "存档",
};

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
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api.get("/projects")
      .then(setProjects)
      .catch(() => toast.error("加载失败"))
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const p = await api.post("/projects", { name });
      toast.success(`「${p.name}」已创建`);
      setShowCreate(false);
      setName("");
      setSummary("");
      router.push(`/project/${p.slug}`);
    } catch {
      toast.error("创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-serif-heading)] text-primary">
          我的小说
        </h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          开始新小说
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-2 font-[family-name:var(--font-serif-heading)]">暂无小说</p>
          <p className="text-sm">点击「开始新小说」开始创作</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((p) => {
            const phaseIdx = ["init","settings","outline","prompts","write","archives"].indexOf(p.current_phase);
            return (
              <Card
                key={p.id}
                className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => router.push(`/project/${p.slug}`)}
              >
                <CardContent className="py-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-[family-name:var(--font-serif-heading)] text-base text-foreground truncate">
                        {p.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.total_chapters}章 · 更新于{new Date(p.updated_at).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[3px] mt-3">
                    {["init","settings","outline","prompts","write","archives"].map((ph, i) => (
                      <div
                        key={ph}
                        className={`w-[7px] h-[7px] rounded-full ${
                          i < phaseIdx
                            ? "bg-emerald-600"
                            : i === phaseIdx
                              ? "bg-primary shadow-[0_0_3px_var(--primary)]"
                              : "border border-muted-foreground/25"
                        }`}
                      />
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-2">
                      {PHASE_LABELS[p.current_phase] || p.current_phase}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <div
            className="border border-dashed border-border rounded-xl flex items-center justify-center min-h-[100px] cursor-pointer hover:border-primary/30 hover:bg-primary/3 transition-colors"
            onClick={() => setShowCreate(true)}
          >
            <span className="text-muted-foreground text-sm">+ 开始新小说</span>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-serif-heading)]">
              开始一部新小说
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground">书名 *</label>
              <Input
                className="mt-1"
                placeholder="给你的小说取个名字..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">一句话梗概</label>
                <AiSuggestButton
                  label="AI 建议书名"
                  onClick={() => toast.info("即将上线")}
                />
              </div>
              <Input
                className="mt-1"
                placeholder="用一句话描述你的故事..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button onClick={create} disabled={creating || !name.trim()}>
                {creating ? "创建中..." : "创建小说"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
