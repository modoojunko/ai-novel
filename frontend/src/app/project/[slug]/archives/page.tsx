"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, ChevronLeft } from "lucide-react";

type Archive = { filename: string; path: string };

export default function ArchivesPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [projectId, setProjectId] = useState("");
  const [archives, setArchives] = useState<Archive[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Archive | null>(null);
  const [content, setContent] = useState("");

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/archives`).then(setArchives).catch(() => {});
  }, [projectId]);

  async function openArchive(a: Archive) {
    setSelected(a);
    const data = await api.get(`/projects/${projectId}/archives/${a.filename}`);
    setContent(data.content || "");
  }

  function parseChapterInfo(filename: string) {
    const match = filename.match(/vol-(\d+)-ch-(\d+)-(.+)\.md/);
    if (!match) return { vol: "?", ch: "?", title: filename };
    return { vol: match[1], ch: match[2], title: match[3].replace(/-/g, " ") };
  }

  const filtered = archives.filter((a) => {
    if (!search.trim()) return true;
    const info = parseChapterInfo(a.filename);
    return (
      info.title.toLowerCase().includes(search.toLowerCase()) ||
      a.filename.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (selected) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => { setSelected(null); setContent(""); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to list
        </button>
        <h2 className="text-xl font-bold mb-4">
          第{parseChapterInfo(selected.filename).vol}卷 第{parseChapterInfo(selected.filename).ch}章 — {parseChapterInfo(selected.filename).title}
        </h2>
        <Card>
          <CardContent className="py-6">
            <article className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-[15px]">
              {content || "Loading..."}
            </article>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Archives</h2>
        <span className="text-sm text-gray-400">{archives.length} chapters</span>
      </div>

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Search by title or filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          {archives.length === 0
            ? "No archived chapters yet. Complete Phase 5 writing and archive to see them here."
            : "No matching archives."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const info = parseChapterInfo(a.filename);
            return (
              <Card
                key={a.filename}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openArchive(a)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <span className="font-medium">
                      Vol {info.vol} · Ch {info.ch}
                    </span>
                    <span className="text-gray-500 ml-3 capitalize">{info.title}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{a.filename}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
