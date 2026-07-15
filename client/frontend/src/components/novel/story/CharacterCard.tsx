import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, Ear, Brain, Heart, Zap } from "lucide-react";
import type { DecisionLogData } from "@/lib/story";

interface CharacterCardProps {
  id: string;
  stamina: number;
  emotion: string;
  urgency: string;
  position: string;
  knowledge: string[];
  decision?: DecisionLogData | null;
}

export default function CharacterCard({
  id, stamina, emotion, urgency, position, knowledge, decision,
}: CharacterCardProps) {
  const [expanded, setExpanded] = useState(false);

  const staminaColor = stamina > 60 ? "bg-success" : stamina > 30 ? "bg-warning" : "bg-error";

  return (
    <div className="rounded-xl border border-base-300/50 bg-base-200/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-base-content">{id}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
            stamina > 60 ? "border-success/30 text-success/70" :
            stamina > 30 ? "border-warning/30 text-warning/70" :
            "border-error/30 text-error/70"
          }`}>
            {stamina}%
          </span>
        </div>
        {decision && (
          <button onClick={() => setExpanded(!expanded)} className="btn btn-ghost btn-xs">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Status */}
      <div className="space-y-1 text-xs text-base-content/50 mb-2">
        <div className="flex gap-2">
          <span className="text-base-content/30">位置</span>
          <span>{position || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-base-content/30">情绪</span>
          <span>{emotion}</span>
        </div>
        {urgency && (
          <div className="flex gap-2">
            <span className="text-warning/60">紧急</span>
            <span className="text-warning/80">{urgency}</span>
          </div>
        )}
      </div>

      {/* Mini stamina bar */}
      <div className="w-full h-1 bg-base-300/30 rounded-full overflow-hidden mb-2">
        <div className={`h-full ${staminaColor} rounded-full transition-all`} style={{ width: `${stamina}%` }} />
      </div>

      {/* Expanded decision log */}
      {expanded && decision && (
        <div className="mt-3 pt-3 border-t border-base-300/30 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <Eye className="w-3 h-3 text-base-content/30 mt-0.5 shrink-0" />
            <span className="text-base-content/60">{decision.see || "—"}</span>
          </div>
          <div className="flex items-start gap-2">
            <Ear className="w-3 h-3 text-base-content/30 mt-0.5 shrink-0" />
            <span className="text-base-content/60">{decision.hear || "—"}</span>
          </div>
          <div className="flex items-start gap-2">
            <Brain className="w-3 h-3 text-base-content/30 mt-0.5 shrink-0" />
            <span className="text-base-content/60">{decision.understanding || "—"}</span>
          </div>
          <div className="flex items-start gap-2">
            <Heart className="w-3 h-3 text-base-content/30 mt-0.5 shrink-0" />
            <span className="text-base-content/60">{decision.emotion || "—"}</span>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-3 h-3 text-base-content/30 mt-0.5 shrink-0" />
            <span className="text-base-content/80 font-medium">{decision.action_description || decision.action_type || "—"}</span>
          </div>
          {decision.inner_monologue && (
            <div className="mt-2 p-2 bg-base-300/20 rounded-lg italic text-base-content/50">
              "{decision.inner_monologue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
