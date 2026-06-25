import { Activity } from "lucide-react";

interface EventWallProps {
  events: any[];
  currentRound: number;
}

export default function EventWall({ events, currentRound }: EventWallProps) {
  const roundEvents = events.filter((e) => e.round === currentRound);

  return (
    <div className="rounded-xl border border-base-300/50 bg-base-200/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-primary/60" />
        <span className="text-xs font-medium text-base-content/50 tracking-wide">
          第 {currentRound} 回合 · 事件
        </span>
      </div>
      {roundEvents.length === 0 ? (
        <p className="text-xs text-base-content/30 text-center py-4">暂无事件</p>
      ) : (
        <div className="space-y-2">
          {roundEvents.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-primary/40 mt-0.5 shrink-0">⚡</span>
              <span className="text-base-content/70">
                <strong className="text-base-content/90">{ev.actor}</strong>
                {ev.action && ` ${ev.action}`}
                {ev.target && ` → ${ev.target}`}
                {ev.result && ` · ${ev.result}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
