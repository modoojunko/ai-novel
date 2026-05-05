"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Clock, AlertCircle, ChevronRight } from "lucide-react";

type Thread = {
  pov: string;
  last_chapter: string;
  current_state: string;
  pending_questions: string[];
  active_hooks: { ref: string; description: string; status: string }[];
  emotional_temperature: string;
};

const TEMP_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  climax: "bg-red-100 text-red-700",
};

const TEMP_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  climax: "Climax",
};

export default function ThreadsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [projectId, setProjectId] = useState("");
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get(`/projects/by-slug/${slug}`).then((p: any) => setProjectId(p.id));
  }, [slug]);

  useEffect(() => {
    if (!projectId) return;
    api
      .get(`/projects/${projectId}/threads`)
      .then((d) => setThreads(d.threads || {}))
      .catch(() => {});
  }, [projectId]);

  const entries = Object.entries(threads);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="w-6 h-6" /> Thread Timeline
        </h2>
        <span className="text-sm text-gray-400">{entries.length} threads</span>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-30" />
          No threads defined yet. Threads are created automatically when chapters are archived with thread assignments.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(([name, t]) => {
            const isOpen = expanded[name] !== false;
            const temp = t.emotional_temperature || "medium";
            return (
              <Card key={name}>
                <CardHeader
                  className="cursor-pointer py-4"
                  onClick={() => setExpanded((p) => ({ ...p, [name]: !p[name] }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                      <CardTitle className="text-base">{name}</CardTitle>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TEMP_COLORS[temp]}`}>
                        {TEMP_LABELS[temp]}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.last_chapter || "—"}
                      </span>
                      <span>POV: {t.pov || "—"}</span>
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-4 pt-0">
                    <div>
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Current State
                      </label>
                      <p className="text-sm mt-1">{t.current_state || "No state recorded."}</p>
                    </div>

                    {(t.pending_questions || []).length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Pending Questions
                        </label>
                        <ul className="mt-1 space-y-1">
                          {t.pending_questions.map((q, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-gray-300 mt-0.5">•</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(t.active_hooks || []).length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Active Hooks
                        </label>
                        <div className="mt-1 space-y-1">
                          {t.active_hooks.map((h) => (
                            <div key={h.ref} className="text-sm flex items-center gap-2">
                              <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                {h.ref}
                              </span>
                              <span>{h.description}</span>
                              <span className="text-xs text-gray-400">({h.status})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
