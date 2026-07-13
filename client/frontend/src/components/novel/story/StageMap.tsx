import { MapPin } from "lucide-react";

interface StageMapProps {
  terrain: string;
  characters: { id: string; position: string; stamina: number }[];
}

export default function StageMap({ terrain, characters }: StageMapProps) {
  return (
    <div className="rounded-xl border border-base-300/60 bg-base-200/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-4 h-4 text-primary/60" />
        <span className="text-xs font-medium text-base-content/50 tracking-wide">舞台</span>
      </div>
      <p className="text-sm text-base-content/70 leading-relaxed mb-4 font-serif italic">
        {terrain || "（场景未指定）"}
      </p>
      <div className="flex flex-wrap gap-2">
        {characters.map((c) => (
          <div
            key={c.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-base-300/40 bg-base-200/40 text-xs"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              c.stamina > 60 ? "bg-success" : c.stamina > 30 ? "bg-warning" : "bg-error"
            }`} />
            <span className="text-base-content/80">{c.id}</span>
            <span className="text-base-content/30">{c.position || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
