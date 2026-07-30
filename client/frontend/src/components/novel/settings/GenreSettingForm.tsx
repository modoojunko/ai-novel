// ── GenreSettingForm ──────────────────────────────────────────────────────
// Settings tree node for genre/trope configuration.
// Follows the same pattern as WorldSettingForm / StyleSettingForm.
// Collapsible sections for: narrator role, tone blueprint, taboos,
// prompt injection, genre config, and story arc templates.

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import GenrePickerModal from "./GenrePickerModal";
import { getGenreById, DEFAULT_GENRE_ID, type GenreDefinition, type StoryArcTemplate } from "@/data/genres";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookOpen,
  Palette,
  Ban,
  Terminal,
  Settings2,
  LayoutList,
  PenLine,
} from "lucide-react";

// ── Props ────────────────────────────────────────────────────────────────

interface GenreSettingFormProps {
  projectId: string;
  settingKey: string;
}

// ── Data shape from API ──────────────────────────────────────────────────

interface GenreConfigData {
  genre_id: string;
  tone_overrides?: {
    atmosphere?: string;
    pov?: string;
    techniques?: string[];
  };
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

// ── CollapsibleSection ───────────────────────────────────────────────────

function CollapsibleSection({
  icon,
  title,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-base-300/50 rounded-lg overflow-hidden bg-base-100/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-base-200/30"
      >
        <span className="shrink-0 w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </span>
        <span className="text-sm font-medium text-base-content/80 flex-1">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-base-content/30" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/30" />
        )}
      </button>
      <div
        className={`transition-all duration-200 overflow-hidden ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 pt-1">{children}</div>
      </div>
    </div>
  );
}

// ── ReadonlyField ────────────────────────────────────────────────────────

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
        {label}
      </label>
      <p className="text-sm text-base-content/70 leading-relaxed bg-base-200/30 rounded-lg px-3.5 py-2.5 border border-base-300/30">
        {value}
      </p>
    </div>
  );
}

// ── TagList ──────────────────────────────────────────────────────────────

function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="px-2 py-0.5 text-xs bg-base-200/50 border border-base-300/50 rounded-full text-base-content/60"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// ── ListInput ────────────────────────────────────────────────────────────

function ListInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <span className="text-xs text-base-content/20 w-5 text-right tabular-nums">{i + 1}.</span>
          <input
            className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-base-200/60 placeholder:text-base-content/20"
            value={item}
            onChange={(e) => {
              const n = [...items];
              n[i] = e.target.value;
              onChange(n);
            }}
            placeholder={placeholder}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1"
          >
            X
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="text-xs text-primary/60 hover:text-primary transition-colors inline-flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span> 添加一项
      </button>
    </div>
  );
}

// ── SelectableArcCard ────────────────────────────────────────────────────

function SelectableArcCard({
  template,
  selected,
  onSelect,
}: {
  template: StoryArcTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-all ${
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-base-300/50 hover:border-base-300/80 bg-base-200/20"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-xs font-medium ${
            selected ? "text-primary" : "text-base-content/70"
          }`}
        >
          {template.name}
        </span>
        {selected && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary/80">
            已选
          </span>
        )}
      </div>
      <p className="text-xs text-base-content/40 leading-relaxed">
        {template.description}
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        {template.beats.map((beat, i) => (
          <span
            key={i}
            className="text-[10px] px-1.5 py-0.5 rounded bg-base-300/40 text-base-content/50"
          >
            {beat}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Atmosphere / POV selector (pill buttons) ─────────────────────────────

function PillSelector<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
            value === opt
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-base-300/50 text-base-content/50 hover:border-base-300/80 hover:text-base-content/70"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function GenreSettingForm({ projectId, settingKey }: GenreSettingFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Loaded genre data
  const [genre, setGenre] = useState<GenreDefinition | null>(null);
  const [genreId, setGenreId] = useState(DEFAULT_GENRE_ID);

  // Editable fields
  const [atmosphere, setAtmosphere] = useState("");
  const [pov, setPov] = useState("");
  const [techniques, setTechniques] = useState<string[]>([""]);
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
    setAtmosphere(g.toneBlueprint.atmosphereOptions[0] ?? "");
    setPov(g.toneBlueprint.povOptions[0] ?? "");
    setTechniques([...g.toneBlueprint.techniqueTags]);
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
      tone_overrides: {
        atmosphere,
        pov,
        techniques: techniques.filter(Boolean),
      },
      prompt_injection_enabled: promptInjectionEnabled,
      config_overrides: {
        fulfillment_types: fulfillmentTypes.filter(Boolean),
        chapter_types: chapterTypes.filter(Boolean),
        pacing_rules: pacingRules.filter(Boolean),
        fatigue_words: fatigueWords.filter(Boolean),
      },
      selected_arc_id: selectedArcId,
    }),
    [atmosphere, pov, techniques, promptInjectionEnabled, fulfillmentTypes, chapterTypes, pacingRules, fatigueWords, selectedArcId],
  );

  // ── Load from API ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api
      .get(`/novels/${projectId}/settings/${settingKey}`)
      .then((d: GenreConfigData | null) => {
        if (!d?.genre_id) {
          // No genre set yet — leave empty, component shows prompt
          setGenre(null);
          return;
        }
        const g = getGenreById(d.genre_id);
        if (!g) {
          // Genre id from API not found in local data
          setGenre(null);
          return;
        }
        setGenreId(d.genre_id);
        setGenre(g);

        // Apply overrides or defaults
        setAtmosphere(d.tone_overrides?.atmosphere ?? g.toneBlueprint.atmosphereOptions[0] ?? "");
        setPov(d.tone_overrides?.pov ?? g.toneBlueprint.povOptions[0] ?? "");
        setTechniques(d.tone_overrides?.techniques?.length
          ? d.tone_overrides.techniques
          : [...g.toneBlueprint.techniqueTags],
        );
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
      .finally(() => setLoading(false));
  }, [projectId, settingKey]);

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!genre) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/novels/${projectId}/settings/${settingKey}`, buildPayload(genre));
    } catch (e: any) {
      setError(e.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }, [projectId, settingKey, genre, buildPayload]);

  // ── Handle genre change from picker ───────────────────────────────
  const handleGenreChange = useCallback(
    async (newId: string) => {
      const g = getGenreById(newId);
      if (!g) return;
      applyGenre(g);
      // Auto-save immediately
      setSaving(true);
      try {
        await api.put(`/novels/${projectId}/settings/${settingKey}`, buildPayload(g));
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
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  // ── Empty state (no genre selected) ───────────────────────────────
  if (!genre) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-4">
        <BookOpen className="w-12 h-12 mx-auto text-base-content/20" />
        <h3 className="text-base font-medium text-base-content/60">尚未选择题材</h3>
        <p className="text-sm text-base-content/40 max-w-md mx-auto leading-relaxed">
          选择题材可以帮助 AI 更准确地把握你的小说类型特征，生成贴合类型的文风和内容。
        </p>
        <button
          onClick={() => setShowPicker(true)}
          className="btn btn-primary btn-sm"
        >
          选择题材
        </button>

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
    <div className="max-w-3xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-serif font-semibold text-base-content">
              {genre.name}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
              {categoryLabel}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success/80 border border-success/20">
              已设定
            </span>
          </div>
          <p className="text-xs text-base-content/40 mt-1 max-w-lg leading-relaxed">
            {genre.description}
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm bg-base-200/60 border border-base-300/60 rounded-lg text-base-content/70 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          更换题材
        </button>
      </div>

      {/* ── Collapsible sections ─────────────────────────────────── */}
      <div className="space-y-3">
        {/* 1. 叙事者角色 (read-only preview) */}
        <CollapsibleSection icon={<BookOpen className="w-3.5 h-3.5" />} title="叙事者角色">
          <ReadonlyField label="叙事者角色" value={genre.narratorRole} />
          <div className="mt-3">
            <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
              典型故事弧
            </label>
            <p className="text-sm text-base-content/70 leading-relaxed bg-base-200/30 rounded-lg px-3.5 py-2.5 border border-base-300/30">
              {genre.typicalArc}
            </p>
          </div>
        </CollapsibleSection>

        {/* 2. 文风蓝图 */}
        <CollapsibleSection icon={<Palette className="w-3.5 h-3.5" />} title="文风蓝图" defaultOpen={false}>
          <div className="space-y-3">
            <ReadonlyField label="基调" value={genre.toneBlueprint.defaultTone} />

            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                氛围选项
              </label>
              <PillSelector
                options={genre.toneBlueprint.atmosphereOptions}
                value={atmosphere}
                onChange={setAtmosphere}
              />
            </div>

            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                叙事视角（POV）
              </label>
              <PillSelector
                options={genre.toneBlueprint.povOptions}
                value={pov}
                onChange={setPov}
              />
            </div>

            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                描写技法
              </label>
              <ListInput items={techniques} onChange={setTechniques} placeholder="添加描写技法" />
            </div>
          </div>
        </CollapsibleSection>

        {/* 3. 类型禁忌 */}
        {genre.taboos.length > 0 && (
          <CollapsibleSection icon={<Ban className="w-3.5 h-3.5" />} title="类型禁忌" defaultOpen={false}>
            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                避免以下内容
              </label>
              <TagList tags={genre.taboos} />
              <p className="text-xs text-base-content/30 mt-2 leading-relaxed">
                这些禁忌由题材自动派生，不可编辑。如需调整，请在写作风格中自定义规则。
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* 4. 提示词注入段 */}
        <CollapsibleSection icon={<Terminal className="w-3.5 h-3.5" />} title="提示词注入段" defaultOpen={false}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-base-content/70">AI 行为引导注入</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={promptInjectionEnabled}
                  onChange={(e) => setPromptInjectionEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-base-300 rounded-full peer peer-checked:bg-primary/70 peer-focus:ring-2 peer-focus:ring-primary/20 transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
            <div
              className={`bg-base-200/40 border rounded-lg p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap transition-colors ${
                promptInjectionEnabled
                  ? "border-primary/20 text-primary/80"
                  : "border-base-300/30 text-base-content/30 line-through"
              }`}
            >
              {genre.promptInjection}
            </div>
            <p className="text-xs text-base-content/30 mt-2">
              注入段会自动嵌入到发送给 AI 的系统提示词中，影响写作风格和行为。
            </p>
          </div>
        </CollapsibleSection>

        {/* 5. 题材配置 (editable) */}
        <CollapsibleSection icon={<Settings2 className="w-3.5 h-3.5" />} title="题材配置">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                满足类型
              </label>
              <ListInput items={fulfillmentTypes} onChange={setFulfillmentTypes} placeholder="例如：人物成长" />
            </div>
            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                章节类型
              </label>
              <ListInput items={chapterTypes} onChange={setChapterTypes} placeholder="例如：日常" />
            </div>
            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                节奏规则
              </label>
              <ListInput items={pacingRules} onChange={setPacingRules} placeholder="例如：每章至少 1 次情感刻画" />
            </div>
            <div>
              <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">
                疲劳词
              </label>
              <ListInput items={fatigueWords} onChange={setFatigueWords} placeholder="例如：突然" />
            </div>
          </div>
        </CollapsibleSection>

        {/* 6. 故事弧模板 */}
        <CollapsibleSection icon={<LayoutList className="w-3.5 h-3.5" />} title="故事弧模板" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-xs text-base-content/40 mb-2 leading-relaxed">
              选择最适合你这篇小说的故事弧模板。选中的模板会影响 AI 对章节结构的规划。
            </p>
            {genre.storyArcTemplates.map((tpl) => (
              <SelectableArcCard
                key={tpl.id}
                template={tpl}
                selected={selectedArcId === tpl.id}
                onSelect={() => setSelectedArcId(tpl.id)}
              />
            ))}
          </div>
        </CollapsibleSection>
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && <p className="text-sm text-error/80 mt-4">{error}</p>}

      {/* ── Save bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-end mt-6 pt-4 border-t border-base-300/50">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium bg-primary text-primary-content rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              保存中...
            </>
          ) : (
            <>
              <PenLine className="w-3.5 h-3.5" />
              保存设定
            </>
          )}
        </button>
      </div>

      {/* ── Genre picker modal ────────────────────────────────────── */}
      <GenrePickerModal
        open={showPicker}
        currentGenreId={genreId}
        onConfirm={handleGenreChange}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
}
