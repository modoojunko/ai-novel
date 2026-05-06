"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Eye,
  Wand2,
  FileText,
  ChevronRight,
} from "lucide-react";

export default function PromptsPage() {
  const params = useParams();
  const slug = params?.slug as string;
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
    setGuidance(ch?.outline?.perspective_guidance || "");
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
      <h2 className="text-2xl font-bold mb-6">Prompt Viewer</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chapter selector + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Chapter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {chapterRefs.map((ref) => (
                <Button
                  key={ref}
                  variant={selectedRef === ref ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => selectChapter(ref)}
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  {ref}
                </Button>
              ))}
              {chapterRefs.length === 0 && (
                <p className="text-muted-foreground text-sm">No chapters yet. Create outlines first.</p>
              )}
            </CardContent>
          </Card>

          {selectedRef && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={runPerspectiveConversion}
                  disabled={converting}
                >
                  {converting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Eye className="w-4 h-4 mr-2" />
                  )}
                  Perspective Conversion
                </Button>
                <Button
                  className="w-full"
                  onClick={generatePrompts}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Generate Prompts
                </Button>
              </CardContent>
            </Card>
          )}

          {prompts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prompt Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {prompts.map((p) => {
                  const segName = p.replace(`${selectedRef}-`, "").replace("-prompt.md", "");
                  return (
                    <Button
                      key={p}
                      variant={selectedPrompt === segName ? "default" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => viewPrompt(segName)}
                    >
                      <FileText className="w-3 h-3 mr-2" />
                      {segName}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Content viewer */}
        <div className="lg:col-span-2 space-y-4">
          {guidance && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perspective Guidance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-4">
                  {guidance}
                </div>
              </CardContent>
            </Card>
          )}

          {promptContent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Prompt: {selectedPrompt}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-4 max-h-96 overflow-y-auto">
                  {promptContent}
                </div>
              </CardContent>
            </Card>
          )}

          {!guidance && !promptContent && selectedRef && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Run perspective conversion and generate prompts to see content here
            </div>
          )}

          {!selectedRef && (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a chapter to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
