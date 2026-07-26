import { api } from "./api";

export interface StageData {
  terrain: string;
  time: string;
  weather: string;
  events?: any[];
}

export interface DecisionLogData {
  see: string;
  hear: string;
  sense: string;
  understanding: string;
  values_checked: string;
  ability_assessment: string;
  emotion: string;
  urgency: string;
  decision_process: string;
  action_type: string;
  action_description: string;
  inner_monologue: string;
  action_impact: string;
}

export interface CharacterStateData {
  id: string;
  position: string;
  stamina: number;
  emotion: string;
  urgency: string;
  knowledge: string[];
}

export interface RoundResultData {
  round: number;
  stage: StageData;
  decisions: { character_id: string; log: DecisionLogData }[];
  characters: Record<string, CharacterStateData>;
}

export interface DeductionState {
  deduction_id: string;
  round: number;
  stage: StageData;
  characters: Record<string, CharacterStateData>;
  seed: string;
}

export async function initDeduction(projectId: string, chapterRef?: string): Promise<any> {
  return api.post("/story/init", { project_id: projectId, chapter_ref: chapterRef });
}

export async function setSeed(deductionId: string, seed: string): Promise<any> {
  return api.post(`/story/${deductionId}/seed`, { seed });
}

export async function runRound(deductionId: string): Promise<RoundResultData> {
  return api.post(`/story/${deductionId}/round`);
}

export async function rewind(deductionId: string, roundNum: number): Promise<any> {
  return api.post(`/story/${deductionId}/rewind/${roundNum}`);
}

export async function adjustState(deductionId: string, adjustments: any[]): Promise<any> {
  return api.post(`/story/${deductionId}/adjust`, { adjustments });
}

export async function stopDeduction(deductionId: string): Promise<any> {
  return api.post(`/story/${deductionId}/stop`);
}

export async function getDeduction(deductionId: string): Promise<DeductionState> {
  return api.get(`/story/${deductionId}`);
}
