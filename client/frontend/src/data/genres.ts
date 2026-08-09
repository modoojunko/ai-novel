// ── Genre data model ──────────────────────────────────────────────────────
// 题材定义已改为后端数据库存储（全局题材库，预置 24 条启动时 seed），
// 本文件只保留：类型定义 + 分类 taxonomy + 分类图标 + 异步访问函数。
// 预置题材的 icon 字段已删除 —— 列表/卡片统一按分类取图标（genreIcon）。

import type { LucideIcon } from "lucide-react";
import {
  Building,
  Scroll,
  Sparkles,
  Search,
  Rocket,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";

// ── Category slugs ────────────────────────────────────────────────────────

export type GenreCategory =
  | "urban"
  | "historical"
  | "xianhuan"
  | "suspense"
  | "scifi"
  | "independent";

export interface GenreCategoryInfo {
  id: GenreCategory;
  label: string;
}

export const GENRE_CATEGORIES: GenreCategoryInfo[] = [
  { id: "urban",      label: "都市系" },
  { id: "historical", label: "历史系" },
  { id: "xianhuan",   label: "玄幻系" },
  { id: "suspense",   label: "悬疑系" },
  { id: "scifi",      label: "科幻系" },
  { id: "independent",label: "独立类型" },
];

// ── Category icons ────────────────────────────────────────────────────────

/** 分类默认图标；未知 category 兜底 Sparkles */
export const CATEGORY_ICONS: Record<GenreCategory, LucideIcon> = {
  urban: Building,
  historical: Scroll,
  xianhuan: Sparkles,
  suspense: Search,
  scifi: Rocket,
  independent: BookOpen,
};

export function genreIcon(genre: { category: GenreCategory }): LucideIcon {
  return CATEGORY_ICONS[genre.category] ?? Sparkles;
}

// ── Genre definition ──────────────────────────────────────────────────────

export interface GenreDefinition {
  id: string;
  name: string;
  description: string;
  category: GenreCategory;

  /** Brief narrator role description */
  narratorRole: string;
  /** Typical story arc summary */
  typicalArc: string;

  /** Tone blueprint defaults */
  toneBlueprint: ToneBlueprint;
  /** Taboo labels */
  taboos: string[];
  /** Prompt injection snippet */
  promptInjection: string;
  /** Genre-level config defaults */
  genreConfig: GenreConfig;
  /** Available story arc templates */
  storyArcTemplates: StoryArcTemplate[];
  /** True for the 24 built-in presets (read-only, 不可编辑/删除) */
  isPreset?: boolean;
}

export interface ToneBlueprint {
  defaultTone: string;
  atmosphereOptions: string[];
  povOptions: string[];
  techniqueTags: string[];
}

export interface GenreConfig {
  fulfillmentTypes: string[];
  chapterTypes: string[];
  pacingRules: string[];
  fatigueWords: string[];
}

export interface StoryArcTemplate {
  id: string;
  name: string;
  description: string;
  beats: string[];
}

/** 创建/更新题材请求体（不含 isPreset —— 后端强制） */
export type GenreCreateInput = Omit<GenreDefinition, "isPreset">;

// ── Async API access ──────────────────────────────────────────────────────

/** 全量题材（含自定义），后端按分类+名称排序 */
export async function fetchGenres(): Promise<GenreDefinition[]> {
  return api.get("/genres");
}

/** 单个题材；不存在或请求失败 → null（供表单优雅降级，不再整块空态） */
export async function fetchGenre(id: string): Promise<GenreDefinition | null> {
  try {
    return await api.get(`/genres/${id}`);
  } catch {
    return null;
  }
}

export async function createGenre(body: GenreCreateInput): Promise<GenreDefinition> {
  return api.post("/genres", body);
}

export async function updateGenre(
  id: string,
  body: GenreCreateInput,
): Promise<GenreDefinition> {
  return api.put(`/genres/${id}`, body);
}

export async function deleteGenre(id: string): Promise<{ ok: boolean }> {
  return api.delete(`/genres/${id}`);
}

// ── Normalization ─────────────────────────────────────────────────────────

const EMPTY_TONE_BLUEPRINT: ToneBlueprint = {
  defaultTone: "",
  atmosphereOptions: [],
  povOptions: [],
  techniqueTags: [],
};

const EMPTY_GENRE_CONFIG: GenreConfig = {
  fulfillmentTypes: [],
  chapterTypes: [],
  pacingRules: [],
  fatigueWords: [],
};

/** 用默认结构补齐缺失字段，保证「简化必填」创建不产生 undefined 型崩溃 */
export function normalizeGenreDefinition(
  raw: Partial<GenreDefinition> & {
    id: string;
    name: string;
    category: GenreCategory;
  },
): GenreDefinition {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    category: raw.category,
    narratorRole: raw.narratorRole ?? "",
    typicalArc: raw.typicalArc ?? "",
    toneBlueprint: { ...EMPTY_TONE_BLUEPRINT, ...raw.toneBlueprint },
    taboos: raw.taboos ?? [],
    promptInjection: raw.promptInjection ?? "",
    genreConfig: { ...EMPTY_GENRE_CONFIG, ...raw.genreConfig },
    storyArcTemplates: raw.storyArcTemplates ?? [],
    isPreset: raw.isPreset,
  };
}

/** Default genre when nothing is selected */
export const DEFAULT_GENRE_ID = "urban-daily";
