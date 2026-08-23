// ── GenreSettingForm ──────────────────────────────────────────────────────
// 题材设定面板（book.html v2 设定视图·题材）：
//   当前题材卡（cur-genre）+ 类型禁忌 chips（只读派生）+ 提示词注入段
//   （seg 启用/停用 + prompt-preview）+ 题材配置 4 组 ListEditor + 故事弧模板卡。
// 数据逻辑不动（ADR-007：叙事者/文风蓝图归文风表单；切题材自动落库）。
// 保存/确认语义收敛到面板脚注（gap3）：SettingsView 持 GenreHandle。

import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Ico, P } from "@/components/icons";
import GenrePickerModal from "./GenrePickerModal";
import { Cfg, ListEditor, SettingSaveHandle } from "./FormField";
import { fetchGenre, normalizeGenreDefinition, DEFAULT_GENRE_ID, type GenreDefinition, type StoryArcTemplate } from "@/data/genres";

// ── Props ────────────────────────────────────────────────────────────────

interface GenreSettingFormProps {
  projectId: string;
  settingKey: string;
}

/** 面板脚注（gap3）持有：save 落库 / hasGenre 确认前校验 / openPicker 空态引导 */
export type GenreHandle = SettingSaveHandle & {
  hasGenre: () => boolean;
  openPicker: () => void;
};

// ── Data shape from API ──────────────────────────────────────────────────

interface GenreConfigData {
  genre_id: string;
  prompt_injection_enabled?: boolean;
  config_overrides?: {
    fulfillment_types?: string[];
    chapter_types?: string[];
    pacing_rules?: string[];
    fatigue_words?: string[];
  };
  selected_arc_id?: string;
}

// ── Project-level category label (mirrors data/genres constant inline) ──

const GENRE_CATEGORIES: { id: string; label: string }[] = [
  { id: "urban",       label: "都市系" },
  { id: "historical",  label: "历史系" },
  { id: "xianhuan",    label: "玄幻系" },
  { id: "suspense",    label: "悬疑系" },
  { id: "scifi",       label: "科幻系" },
  { id: "independent", label: "独立类型" },
];

// ── Story arc card（原型 .arc-card：ac-name + 已选 pill + ac-desc + beats）──

function ArcCard({
  template,
  selected,
  onSelect,
}: {
  template: StoryArcTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`arc-card${selected ? " on" : ""}`} type="button" onClick={onSelect}>
      <span className="ac-name">
        {template.name}
        {selected && <span className="ac-sel">已选</span>}
      </span>
      <p className="ac-desc">{template.description}</p>
      <div className="ac-beats">
        {template.beats.map((beat, i) => (
          <span className="ac-beat" key={i}>{beat}</span>
        ))}
      </div>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────

const GenreSettingForm = forwardRef<GenreHandle, GenreSettingFormProps>(function GenreSettingForm(
  { projectId, settingKey },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Loaded genre data
  const [genre, setGenre] = useState<GenreDefinition | null>(null);
  const [genreId, setGenreId] = useState(DEFAULT_GENRE_ID);
  /** genre_id 已设定但定义缺失（被删/未知）→ 降级可用态，不整块空屏 */
  const [definitionMissing, setDefinitionMissing] = useState(false);

  // Editable fields（ADR-007：氛围/视角/技法归文风表单，题材只保留配置与弧线）
  const [promptInjectionEnabled, setPromptInjectionEnabled] = useState(true);
  const [fulfillmentTypes, setFulfillmentTypes] = useState<string[]>([""]);
  const [chapterTypes, setChapterTypes] = useState<string[]>([""]);
  const [pacingRules, setPacingRules] = useState<string[]>([""]);
  const [fatigueWords, setFatigueWords] = useState<string[]>([""]);
  const [selectedArcId, setSelectedArcId] = useState<string | undefined>();

  const [showPicker, setShowPicker] = useState(false);

  // ── Apply a genre definition to all editable fields ───────────────
  const applyGenre = useCallback((g: GenreDefinition) => {
    setGenre(g);
    setGenreId(g.id);
    setFulfillmentTypes([...g.genreConfig.fulfillmentTypes]);
    setChapterTypes([...g.genreConfig.chapterTypes]);
    setPacingRules([...g.genreConfig.pacingRules]);
    setFatigueWords([...g.genreConfig.fatigueWords]);
    setSelectedArcId(g.storyArcTemplates[0]?.id);
  }, []);

  // ── Build save payload ────────────────────────────────────────────
  const buildPayload = useCallback(
    (g: GenreDefinition): GenreConfigData => ({
      genre_id: g.id,
      prompt_injection_enabled: promptInjectionEnabled,
      config_overrides: {
        fulfillment_types: fulfillmentTypes.filter(Boolean),
        chapter_types: chapterTypes.filter(Boolean),
        pacing_rules: pacingRules.filter(Boolean),
        fatigue_words: fatigueWords.filter(Boolean),
      },
      selected_arc_id: selectedArcId,
    }),
    [promptInjectionEnabled, fulfillmentTypes, chapterTypes, pacingRules, fatigueWords, selectedArcId],
  );

  // ── Load from API ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/novels/${projectId}/settings/${settingKey}`)
      .then(async (d: GenreConfigData | null) => {
        if (cancelled) return;
        if (!d?.genre_id) {
          // No genre set yet — leave empty, component shows prompt
          setGenre(null);
          setDefinitionMissing(false);
          return;
        }
        setGenreId(d.genre_id);
        // 定义可能已被删除/未知 → fetchGenre 返回 null → 进入降级可用态（不整块空屏）
        const g = await fetchGenre(d.genre_id);
        if (cancelled) return;
        if (!g) {
          setGenre(
            normalizeGenreDefinition({
              id: d.genre_id,
              name: d.genre_id,
              category: "independent",
            }),
          );
          setDefinitionMissing(true);
          setPromptInjectionEnabled(d.prompt_injection_enabled ?? true);
          setFulfillmentTypes(
            d.config_overrides?.fulfillment_types?.length
              ? d.config_overrides.fulfillment_types
              : [""],
          );
          setChapterTypes(
            d.config_overrides?.chapter_types?.length
              ? d.config_overrides.chapter_types
              : [""],
          );
          setPacingRules(
            d.config_overrides?.pacing_rules?.length
              ? d.config_overrides.pacing_rules
              : [""],
          );
          setFatigueWords(
            d.config_overrides?.fatigue_words?.length
              ? d.config_overrides.fatigue_words
              : [""],
          );
          setSelectedArcId(undefined);
          return;
        }
        setGenre(g);
        setDefinitionMissing(false);

        // Apply overrides or defaults（ADR-007：氛围/视角/技法归文风表单，不在此处加载）
        setPromptInjectionEnabled(d.prompt_injection_enabled ?? true);
        setFulfillmentTypes(d.config_overrides?.fulfillment_types?.length
          ? d.config_overrides.fulfillment_types
          : [...g.genreConfig.fulfillmentTypes],
        );
        setChapterTypes(d.config_overrides?.chapter_types?.length
          ? d.config_overrides.chapter_types
          : [...g.genreConfig.chapterTypes],
        );
        setPacingRules(d.config_overrides?.pacing_rules?.length
          ? d.config_overrides.pacing_rules
          : [...g.genreConfig.pacingRules],
        );
        setFatigueWords(d.config_overrides?.fatigue_words?.length
          ? d.config_overrides.fatigue_words
          : [...g.genreConfig.fatigueWords],
        );
        setSelectedArcId(d.selected_arc_id ?? g.storyArcTemplates[0]?.id);
      })
      .catch(() => setError("加载失败"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, settingKey]);

  // ── Save（面板脚注 gap3 调用；切题材已自动落库）───────────────────
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!genre) return true;
    if (saving) return false;
    setSaving(true);
    setError("");
    try {
      await api.put(`/novels/${projectId}/settings/${settingKey}`, buildPayload(genre));
      return true;
    } catch (e: any) {
      setError(e.message || "保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  }, [projectId, settingKey, genre, saving, buildPayload]);

  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      hasGenre: () => !!genre,
      openPicker: () => setShowPicker(true),
    }),
    [handleSave, genre],
  );

  // ── Handle genre change from picker（自动落库 + 原型 toast 文案）────
  const handleGenreChange = useCallback(
    async (newId: string) => {
      const g = await fetchGenre(newId);
      if (!g) return;
      applyGenre(g);
      setDefinitionMissing(false);
      // Auto-save immediately
      setSaving(true);
      try {
        await api.put(`/novels/${projectId}/settings/${settingKey}`, buildPayload(g));
        toast.success(`已应用题材「${g.name}」· 模板已带入，已填内容保留`);
      } catch (e: any) {
        setError(e.message || "保存失败");
      } finally {
        setSaving(false);
      }
    },
    [projectId, settingKey, applyGenre, buildPayload],
  );

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return <p className="opt">加载中…</p>;
  }

  // ── Empty state (no genre selected) ───────────────────────────────
  if (!genre) {
    return (
      <div>
        <div className="field">
          <label>当前题材</label>
          <div className="cur-genre">
            <span>未选择</span>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginLeft: "auto" }}
              type="button"
              onClick={() => setShowPicker(true)}
            >
              选择题材
            </button>
          </div>
          <span className="opt" style={{ fontSize: 12, color: "var(--muted)" }}>
            选择题材可以帮助 AI 更准确地把握你的小说类型特征，生成贴合类型的文风和内容。
          </span>
        </div>

        <GenrePickerModal
          open={showPicker}
          onConfirm={handleGenreChange}
          onClose={() => setShowPicker(false)}
        />
      </div>
    );
  }

  const categoryLabel =
    GENRE_CATEGORIES.find((c) => c.id === genre.category)?.label ?? "";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── 当前题材卡 ──────────────────────────────────────────── */}
      <div className="field">
        <label>当前题材</label>
        <div className="cur-genre">
          <span>{genre.name}</span>
          {definitionMissing ? (
            <span className="tag">定义缺失</span>
          ) : (
            <>
              <span className="tag">{categoryLabel}</span>
              <span className="tag">已设定</span>
            </>
          )}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: "auto" }}
            type="button"
            onClick={() => setShowPicker(true)}
          >
            <Ico d={P.tune} sw={1.8} />
            选择 / 切换题材
          </button>
        </div>
        {definitionMissing ? (
          <span className="opt" style={{ fontSize: 12, color: "var(--muted)" }}>
            该题材定义已不存在（可能已被删除）。仍可编辑并保存下方覆盖项；切换为新题材可恢复完整设置。
          </span>
        ) : (
          genre.description && (
            <span className="opt" style={{ fontSize: 12, color: "var(--muted)" }}>
              {genre.description} 切换题材将替换题材相关的参数模板，已填内容保留。
            </span>
          )
        )}
      </div>

      {/* ── 类型禁忌（题材派生，只读）────────────────────────────── */}
      {genre.taboos.length > 0 && (
        <Cfg title="类型禁忌">
          <div className="chips">
            {genre.taboos.map((t) => (
              <span className="chip" key={t}>{t}</span>
            ))}
          </div>
          <p className="opt" style={{ margin: "8px 0 0", fontSize: 11.5 }}>
            禁忌由题材自动派生，不可编辑；如需调整请在风格设定中自定义规则。
          </p>
        </Cfg>
      )}

      {/* ── 提示词注入段 ────────────────────────────────────────── */}
      <Cfg title="提示词注入段">
        <div className="fl-row">
          <span style={{ fontSize: 13 }}>AI 行为引导注入</span>
          <span className="seg" role="group" aria-label="提示词注入">
            <button
              type="button"
              className={promptInjectionEnabled ? "on" : undefined}
              onClick={() => setPromptInjectionEnabled(true)}
            >
              启用
            </button>
            <button
              type="button"
              className={!promptInjectionEnabled ? "on" : undefined}
              onClick={() => setPromptInjectionEnabled(false)}
            >
              停用
            </button>
          </span>
        </div>
        <div className="prompt-preview" style={{ marginTop: 10, opacity: promptInjectionEnabled ? undefined : 0.45 }}>
          {genre.promptInjection}
        </div>
        <p className="opt" style={{ margin: "8px 0 0", fontSize: 11.5 }}>
          注入段会自动嵌入发送给 AI 的系统提示词，影响写作风格与行为。
        </p>
      </Cfg>

      {/* ── 题材配置（可编辑）───────────────────────────────────── */}
      <Cfg title="题材配置" open>
        <ListEditor label="满足类型（爽点）" items={fulfillmentTypes} onChange={setFulfillmentTypes} placeholder="例如：发现真相的瞬间" />
        <ListEditor label="章节类型" items={chapterTypes} onChange={setChapterTypes} placeholder="例如：场景章" />
        <ListEditor label="节奏规则" items={pacingRules} onChange={setPacingRules} placeholder="例如：每章至少 1 次情感刻画" />
        <ListEditor label="疲劳词" items={fatigueWords} onChange={setFatigueWords} placeholder="例如：突然" />
      </Cfg>

      {/* ── 故事弧模板 — 定义缺失时隐藏 ─────────────────────────── */}
      {!definitionMissing && (
        <Cfg title="故事弧模板">
          <p className="opt" style={{ margin: "0 0 10px", fontSize: 11.5 }}>
            选中的模板会影响 AI 对章节结构的规划。
          </p>
          {genre.storyArcTemplates.map((tpl) => (
            <ArcCard
              key={tpl.id}
              template={tpl}
              selected={selectedArcId === tpl.id}
              onSelect={() => setSelectedArcId(tpl.id)}
            />
          ))}
        </Cfg>
      )}

      {error && <p className="opt" style={{ color: "var(--err)" }}>{error}</p>}

      {/* ── Genre picker modal ────────────────────────────────────── */}
      <GenrePickerModal
        open={showPicker}
        currentGenreId={genreId}
        onConfirm={handleGenreChange}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
});
export default GenreSettingForm;
