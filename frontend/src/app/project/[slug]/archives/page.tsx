"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ChapterTree, type VolumeInfo } from "@/components/project/ChapterTree";

type Archive = { filename: string; path: string };

export default function ArchivesPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [projectId, setProjectId] = useState("");
  const [archives, setArchives] = useState<Archive[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/archives`).then((arr) => {
      setArchives(arr || []);
      if (arr?.length > 0 && !selectedFilename) {
        setSelectedFilename(arr[0].filename);
      }
    }).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !selectedFilename) return;
    api.get(`/projects/${projectId}/archives/${selectedFilename}`)
      .then((data) => setContent(data.content || ""))
      .catch(() => setContent(""));
  }, [projectId, selectedFilename]);

  function parseChapterInfo(filename: string) {
    const match = filename.match(/vol-(\d+)-ch-(\d+)-(.+)\.md/);
    if (!match) return { vol: "?", ch: "?", title: filename };
    return { vol: match[1], ch: match[2], title: match[3].replace(/-/g, " ") };
  }

  // Build tree volumes from archives
  const volMap = new Map<number, any[]>();
  archives.forEach((a) => {
    const info = parseChapterInfo(a.filename);
    const volNum = parseInt(info.vol, 10);
    if (!volMap.has(volNum)) volMap.set(volNum, []);
    volMap.get(volNum)!.push({
      ref: a.filename,
      volume: volNum,
      chapter: parseInt(info.ch, 10),
      title: info.title,
      status: "archived",
    });
  });

  const treeVolumes: VolumeInfo[] = Array.from(volMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([volNum, chapters]) => ({
      name: `vol-${volNum}`,
      volNum,
      chapters: chapters.sort((a, b) => a.chapter - b.chapter),
    }));

  const currentInfo = selectedFilename ? parseChapterInfo(selectedFilename) : null;
  const totalFiles = archives.length;
  const currentIdx = selectedFilename ? archives.findIndex((a) => a.filename === selectedFilename) : -1;
  const prevFile = currentIdx > 0 ? archives[currentIdx - 1] : null;
  const nextFile = currentIdx < totalFiles - 1 ? archives[currentIdx + 1] : null;

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left: Chapter tree */}
      <div className="w-[220px] flex-shrink-0 border-r border-border p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">已存档</span>
          <span className="text-[10px] text-muted-foreground/50">{archives.length}章</span>
        </div>
        {treeVolumes.length > 0 ? (
          <ChapterTree
            volumes={treeVolumes}
            selectedRef={selectedFilename}
            onSelect={setSelectedFilename}
            expanded={expanded}
            onToggle={(name) => setExpanded((p) => ({ ...p, [name]: !p[name] }))}
          />
        ) : (
          <p className="text-xs text-muted-foreground p-2">暂无存档章节</p>
        )}
      </div>

      {/* Right: Reading area */}
      <div className="flex-1 overflow-y-auto relative" style={{ background: "oklch(0.23 0.012 245)" }}>
        {/* Paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />

        {selectedFilename && currentInfo ? (
          <div className="relative z-10 max-w-[640px] mx-auto py-9 px-8">
            {/* Chapter header */}
            <div className="text-center mb-10">
              <span className="text-[10px] text-muted-foreground tracking-[2px] uppercase">
                第{currentInfo.vol}卷 · 第{currentInfo.ch}章
              </span>
              <h2 className="mt-3 mb-2 font-[family-name:var(--font-serif-heading)] text-2xl text-foreground">
                {currentInfo.title}
              </h2>
            </div>

            {/* Prose */}
            <div className="font-[family-name:var(--font-serif-heading)] text-[16px] leading-[2] text-foreground">
              {content ? (
                content.split("\n\n").map((para, i) => (
                  <p key={i} className="indent-[2em] mb-[0.6em]">{para}</p>
                ))
              ) : (
                <p className="text-muted-foreground/30 italic indent-0">加载中...</p>
              )}
            </div>

            {/* Chapter nav */}
            <div className="flex items-center justify-between mt-12 pt-5 border-t border-border">
              <span
                className={`text-[11px] cursor-pointer transition-colors ${
                  prevFile ? "text-muted-foreground hover:text-primary" : "text-muted-foreground/20 cursor-default"
                }`}
                onClick={() => prevFile && setSelectedFilename(prevFile.filename)}
              >
                {prevFile ? `← ${parseChapterInfo(prevFile.filename).title}` : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                第 {currentIdx + 1} / {totalFiles} 章
              </span>
              <span
                className={`text-[11px] cursor-pointer transition-colors ${
                  nextFile ? "text-primary hover:text-primary/80" : "text-muted-foreground/20 cursor-default"
                }`}
                onClick={() => nextFile && setSelectedFilename(nextFile.filename)}
              >
                {nextFile ? `${parseChapterInfo(nextFile.filename).title} →` : "—"}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            选择左侧章节开始阅读
          </div>
        )}
      </div>
    </div>
  );
}
