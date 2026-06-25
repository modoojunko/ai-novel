import { useState, useCallback } from "react";
import { Sparkles, StepForward, Rewind, Square } from "lucide-react";
import type { RoundResultData, DecisionLogData } from "@/lib/story";
import * as Story from "@/lib/story";
import StageMap from "./StageMap";
import CharacterCard from "./CharacterCard";
import EventWall from "./EventWall";
import SeedInputModal from "./SeedInputModal";

interface DeductionPanelProps {
  projectId: string;
  chapterRef?: string;
}

export default function DeductionPanel({ projectId, chapterRef }: DeductionPanelProps) {
  const [deductionId, setDeductionId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [stage, setStage] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [roundResults, setRoundResults] = useState<RoundResultData[]>([]);
  const [currentDecisions, setCurrentDecisions] = useState<Record<string, DecisionLogData | null>>({});
  const [loading, setLoading] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [initCheck, setInitCheck] = useState<any>(null);
  const [missing, setMissing] = useState<string[]>([]);

  // Initialize deduction
  const handleInit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Story.initDeduction(projectId, chapterRef);
      setDeductionId(res.deduction_id);
      setStage(res.stage);
      setInitCheck(res);
      setMissing(res.missing || []);
      setCharacters(res.characters?.map((name: string) => ({ id: name, position: "", stamina: 100, emotion: "平静", urgency: "", knowledge: [] })) || []);
      if (!res.missing || res.missing.length === 0) {
        setShowSeed(true);
      }
    } catch (e: any) {
      console.error("Init failed:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId, chapterRef]);

  // Submit seed
  const handleSeed = useCallback(async (seed: string) => {
    if (!deductionId) return;
    setLoading(true);
    try {
      await Story.setSeed(deductionId, seed);
      setShowSeed(false);
      // Auto-run first round
      await handleRunRound();
    } catch (e: any) {
      console.error("Seed failed:", e);
    } finally {
      setLoading(false);
    }
  }, [deductionId]);

  // Run a round
  const handleRunRound = useCallback(async () => {
    if (!deductionId) return;
    setLoading(true);
    try {
      const result = await Story.runRound(deductionId);
      setRound(result.round);
      setEvents((prev) => [...prev, ...(result.stage?.events || [])]);
      setRoundResults((prev) => [...prev, result]);

      const decisions: Record<string, DecisionLogData | null> = {};
      result.decisions?.forEach((d) => {
        decisions[d.character_id] = d.log;
      });
      setCurrentDecisions(decisions);

      if (result.characters) {
        setCharacters(
          Object.entries(result.characters).map(([id, c]: [string, any]) => ({
            id, position: c.position, stamina: c.stamina,
            emotion: c.emotion, urgency: c.urgency,
            knowledge: c.knowledge || [],
          }))
        );
      }
    } catch (e: any) {
      console.error("Round failed:", e);
    } finally {
      setLoading(false);
    }
  }, [deductionId]);

  // Rewind
  const handleRewind = useCallback(async () => {
    if (!deductionId || round < 1) return;
    const target = Math.max(0, round - 1);
    setLoading(true);
    try {
      await Story.rewind(deductionId, target);
      setRound(target);
      setRoundResults((prev) => prev.slice(0, target + 1));
      setCurrentDecisions({});
    } catch (e: any) {
      console.error("Rewind failed:", e);
    } finally {
      setLoading(false);
    }
  }, [deductionId, round]);

  // Stop
  const handleStop = useCallback(async () => {
    if (!deductionId) return;
    setLoading(true);
    try {
      // Reload the page or navigate back
      window.location.reload();
    } catch (e: any) {
      console.error("Stop failed:", e);
    } finally {
      setLoading(false);
    }
  }, [deductionId]);

  // Not initialized yet
  if (!deductionId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Sparkles className="w-8 h-8 text-primary/40" />
        <p className="text-sm text-base-content/40">准备开始剧情推演</p>
        {missing.length > 0 && (
          <div className="text-xs text-warning/70 max-w-md text-center">
            {missing.map((m, i) => <p key={i}>{m}</p>)}
          </div>
        )}
        <button
          onClick={handleInit}
          disabled={loading}
          className="btn btn-primary btn-sm gap-1.5"
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : <Sparkles className="w-4 h-4" />}
          初始化推演
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Round navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-base-content/50">
          <span>回合 {round}</span>
          {loading && <span className="loading loading-spinner loading-xs text-primary" />}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRewind} disabled={round < 1 || loading}
            className="btn btn-ghost btn-xs gap-1 text-base-content/50">
            <Rewind className="w-3.5 h-3.5" />回退
          </button>
          <button onClick={handleRunRound} disabled={loading}
            className="btn btn-primary btn-xs gap-1">
            {loading ? <span className="loading loading-spinner loading-xs" /> : <StepForward className="w-3.5 h-3.5" />}
            下一回合
          </button>
          <button onClick={handleStop} disabled={loading}
            className="btn btn-ghost btn-xs gap-1 text-base-content/50">
            <Square className="w-3.5 h-3.5" />结束
          </button>
        </div>
      </div>

      {/* Stage */}
      {stage && <StageMap terrain={stage.terrain} characters={characters} />}

      {/* Character cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            id={c.id}
            stamina={c.stamina}
            emotion={c.emotion}
            urgency={c.urgency}
            position={c.position}
            knowledge={c.knowledge}
            decision={currentDecisions[c.id] || null}
          />
        ))}
      </div>

      {/* Event wall */}
      <EventWall events={events} currentRound={round} />

      {/* Seed input modal */}
      <SeedInputModal open={showSeed} onSubmit={handleSeed} onClose={() => setShowSeed(false)} />
    </div>
  );
}
