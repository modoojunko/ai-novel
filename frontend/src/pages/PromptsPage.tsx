import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Loader2, Eye, Wand2, FileText, ChevronRight } from "lucide-react";

export default function PromptsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [projectId, setProjectId] = useState("");
  const [volumes, setVolumes] = useState<any[]>([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [chapter, setChapter] = useState<any>(null);
  const [guidance, setGuidance] = useState("");
  const [converting, setConverting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [promptContent, setPromptContent] = useState("");

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  const loadVolumes = useCallback(async () => {
    if (!projectId) return;
    const vols = await api.get(`/projects/${projectId}/volumes`);
    const withChapters: any[] = [];
    for (const v of vols) {
      const data = await api.get(`/projects/${projectId}/volumes/${v.filename}`);
      withChapters.push({ ...v, chapters: data?.chapters || [] });
    }
    setVolumes(withChapters);
  }, [projectId]);

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  async function selectChapter(ref: string) {
    setSelectedRef(ref);
    setPrompts([]);
    setSelectedPrompt("");
    setPromptContent("");
    const ch = await api.get(`/projects/${projectId}/chapters/${ref}`);
    setChapter(ch);
    setGuidance(ch?.outline?.summary || "");
  }

  async function runPerspectiveConversion() {
    if (!selectedRef) return;
    setConverting(true);
    const res = await api.post(`/projects/${projectId}/chapters/${selectedRef}/perspective`);
    setGuidance(res.guidance);
    setConverting(false);
    loadVolumes();
  }

  async function generatePrompts() {
    if (!selectedRef) return;
    setGenerating(true);
    const res = await api.post(`/projects/${projectId}/chapters/${selectedRef}/prompts/generate`);
    setPrompts(res.prompts || []);
    setGenerating(false);
  }

  async function viewPrompt(seg: string) {
    setSelectedPrompt(seg);
    const content = await api.get(
      `/projects/${projectId}/chapters/${selectedRef}/prompts/${seg}`
    );
    setPromptContent(typeof content === "string" ? content : JSON.stringify(content));
  }

  const chapterRefs: string[] = [];
  volumes.forEach((v) => {
    (v.chapters || []).forEach((ch: any) => {
      chapterRefs.push(`vol-${ch.volume}-ch-${ch.chapter}`);
    });
  });

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold font-serif mb-6">提示词查看器</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chapter selector + actions */}
        <div className="space-y-4">
          <div className="card bg-base-200 border border-base-300">
            <div className="card-body">
              <h3 className="card-title text-base">选择章节</h3>
              <div className="space-y-2">
                {chapterRefs.map((ref) => (
                  <button
                    key={ref}
                    className={`btn w-full justify-start ${selectedRef === ref ? "btn-primary" : "btn-outline"}`}
                    onClick={() => selectChapter(ref)}
                  >
                    <ChevronRight className="w-4 h-4" />
                    {ref}
                  </button>
                ))}
                {chapterRefs.length === 0 && (
                  <p className="text-base-content/60 text-sm">暂无章节，请先创建大纲。</p>
                )}
              </div>
            </div>
          </div>

          {selectedRef && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body">
                <h3 className="card-title text-base">操作</h3>
                <div className="space-y-3">
                  <button
                    className="btn btn-outline w-full"
                    onClick={runPerspectiveConversion}
                    disabled={converting}
                  >
                    {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    视角转换
                  </button>
                  <button
                    className="btn btn-primary w-full"
                    onClick={generatePrompts}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    生成提示词
                  </button>
                </div>
              </div>
            </div>
          )}

          {prompts.length > 0 && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body">
                <h3 className="card-title text-base">提示词文件</h3>
                <div className="space-y-1">
                  {prompts.map((p) => {
                    const segName = p.replace(`${selectedRef}-`, "").replace("-prompt.md", "");
                    return (
                      <button
                        key={p}
                        className={`btn w-full justify-start text-sm ${selectedPrompt === segName ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => viewPrompt(segName)}
                      >
                        <FileText className="w-3 h-3" />
                        {segName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Content viewer */}
        <div className="lg:col-span-2 space-y-4">
          {guidance && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body">
                <h3 className="card-title text-base">视角引导</h3>
                <div className="text-sm whitespace-pre-wrap bg-base-300/50 rounded p-4">
                  {guidance}
                </div>
              </div>
            </div>
          )}

          {promptContent && (
            <div className="card bg-base-200 border border-base-300">
              <div className="card-body">
                <h3 className="card-title text-base">提示词：{selectedPrompt}</h3>
                <div className="text-sm whitespace-pre-wrap bg-base-300/50 rounded p-4 max-h-96 overflow-y-auto">
                  {promptContent}
                </div>
              </div>
            </div>
          )}

          {!guidance && !promptContent && selectedRef && (
            <div className="flex items-center justify-center h-64 text-base-content/60">
              运行视角转换并生成提示词以查看内容
            </div>
          )}

          {!selectedRef && (
            <div className="flex items-center justify-center h-64 text-base-content/60">
              选择章节以开始
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
