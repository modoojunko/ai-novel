// ── GenreEditModal ────────────────────────────────────────────────────────
// Create/edit a custom genre in the global library. 创建/编辑双模式：
// genre 为 null → 创建；否则编辑。storyArcTemplates v1 不开放编辑。
// Follows the fixed-overlay pattern of CharacterCreateModal.

import { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import {
  GENRE_CATEGORIES,
  createGenre,
  updateGenre,
  normalizeGenreDefinition,
  type GenreCategory,
  type GenreDefinition,
} from "@/data/genres";

interface GenreEditModalProps {
  /** 编辑对象；null = 创建模式 */
  genre: GenreDefinition | null;
  onClose: () => void;
  onSaved: (g: GenreDefinition) => void;
}

/** 按名称转英文 slug；中文名兜底用时间戳（custom-xxx），保证唯一且合法 */
function suggestSlug(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s) return s;
  return `custom-${Date.now().toString(36)}`;
}

function StringList({
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
        <div key={i} className="flex items-center gap-2">
          <input
            className="flex-1 bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary/40 placeholder:text-base-content/20"
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
            className="text-base-content/20 hover:text-error transition-colors text-sm px-1"
            title="移除"
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

export default function GenreEditModal({ genre, onClose, onSaved }: GenreEditModalProps) {
  const isEdit = Boolean(genre);

  // 组件按会话条件挂载（打开时新建实例），state 初始化即预填
  const [name, setName] = useState(genre?.name ?? "");
  const [id, setId] = useState(genre?.id ?? "");
  const [idTouched, setIdTouched] = useState(isEdit);
  const [category, setCategory] = useState<GenreCategory>(genre?.category ?? "urban");
  const [description, setDescription] = useState(genre?.description ?? "");
  const [narratorRole, setNarratorRole] = useState(genre?.narratorRole ?? "");
  const [promptInjection, setPromptInjection] = useState(genre?.promptInjection ?? "");

  // Optional blocks
  const [taboos, setTaboos] = useState<string[]>(genre?.taboos ?? []);
  const [atmosphereOptions, setAtmosphereOptions] = useState<string[]>(
    genre?.toneBlueprint?.atmosphereOptions ?? [],
  );
  const [povOptions, setPovOptions] = useState<string[]>(
    genre?.toneBlueprint?.povOptions ?? [],
  );
  const [techniqueTags, setTechniqueTags] = useState<string[]>(
    genre?.toneBlueprint?.techniqueTags ?? [],
  );
  const [fulfillmentTypes, setFulfillmentTypes] = useState<string[]>(
    genre?.genreConfig?.fulfillmentTypes ?? [],
  );
  const [chapterTypes, setChapterTypes] = useState<string[]>(
    genre?.genreConfig?.chapterTypes ?? [],
  );
  const [pacingRules, setPacingRules] = useState<string[]>(
    genre?.genreConfig?.pacingRules ?? [],
  );
  const [fatigueWords, setFatigueWords] = useState<string[]>(
    genre?.genreConfig?.fatigueWords ?? [],
  );

  const [advancedOpen, setAdvancedOpen] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(v: string) {
    setName(v);
    if (!idTouched && !isEdit) {
      setId(suggestSlug(v));
    }
  }

  function handleSubmit() {
    const slug = id.trim();
    if (!name.trim()) return setError("请填写题材名称");
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
      return setError("题材 ID 只能包含小写字母、数字和连字符（如 daily-life），且需以小写字母开头");
    }
    setSaving(true);
    setError("");
    const body = normalizeGenreDefinition({
      id: slug,
      name: name.trim(),
      description: description.trim(),
      category,
      narratorRole: narratorRole.trim(),
      typicalArc: genre?.typicalArc ?? "",
      taboos: taboos.map((t) => t.trim()).filter(Boolean),
      toneBlueprint: {
        defaultTone: genre?.toneBlueprint?.defaultTone ?? "",
        atmosphereOptions: atmosphereOptions.map((s) => s.trim()).filter(Boolean),
        povOptions: povOptions.map((s) => s.trim()).filter(Boolean),
        techniqueTags: techniqueTags.map((s) => s.trim()).filter(Boolean),
      },
      genreConfig: {
        fulfillmentTypes: fulfillmentTypes.map((s) => s.trim()).filter(Boolean),
        chapterTypes: chapterTypes.map((s) => s.trim()).filter(Boolean),
        pacingRules: pacingRules.map((s) => s.trim()).filter(Boolean),
        fatigueWords: fatigueWords.map((s) => s.trim()).filter(Boolean),
      },
    });
    (isEdit && genre ? updateGenre(genre.id, body) : createGenre(body))
      .then((saved) => onSaved(saved))
      .catch((e: any) => setError(e.message || "保存失败"))
      .finally(() => setSaving(false));
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-base-100 border border-base-300/50 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-accent/60" />

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-serif font-semibold text-base-content">
            {isEdit ? "编辑题材" : "新建题材"}
          </h3>
          <button
            onClick={onClose}
            className="text-base-content/40 hover:text-base-content transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body (scrollable) ─────────────────────────────────── */}
        <div className="px-6 pb-6 overflow-y-auto space-y-4">
          {error && <p className="text-sm text-error/80">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
                题材名称 <span className="text-error">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="例如：末日种田"
                className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 placeholder:text-base-content/20"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
                题材 ID（英文 slug）<span className="text-error">*</span>
              </label>
              {isEdit ? (
                <div className="px-3 py-2 text-sm bg-base-200/30 border border-base-300/30 rounded-lg text-base-content/40">
                  {genre?.id}
                </div>
              ) : (
                <input
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setIdTouched(true);
                  }}
                  onFocus={() => setIdTouched(true)}
                  placeholder="daily-life"
                  className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 placeholder:text-base-content/20"
                />
              )}
              {!isEdit && (
                <p className="text-[11px] text-base-content/30 mt-1">
                  仅小写字母、数字、连字符，以小写字母开头
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
              分类
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                    category === c.id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-base-300/50 text-base-content/50 hover:border-base-300/80"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
              题材说明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话描述这个题材的特征……"
              rows={2}
              className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 placeholder:text-base-content/20 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
              叙事者角色
            </label>
            <input
              value={narratorRole}
              onChange={(e) => setNarratorRole(e.target.value)}
              placeholder="例如：贴近主角内心的全知第三人称"
              className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 placeholder:text-base-content/20"
            />
          </div>

          <div>
            <label className="text-[11px] text-base-content/50 font-medium block mb-1 tracking-wide">
              提示词注入段
            </label>
            <textarea
              value={promptInjection}
              onChange={(e) => setPromptInjection(e.target.value)}
              placeholder="会嵌入发送给 AI 的系统提示词，影响写作风格与行为"
              rows={2}
              className="w-full bg-base-200/40 border border-base-300/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/40 placeholder:text-base-content/20 resize-none font-mono text-xs"
            />
          </div>

          {/* ── Optional advanced block ─────────────────────────── */}
          <div className="border border-base-300/40 rounded-xl overflow-hidden">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-base-content/70 hover:bg-base-200/30 transition-colors"
            >
              <span>可选：禁忌与文风蓝图</span>
              {advancedOpen ? (
                <ChevronUp className="w-4 h-4 text-base-content/30" />
              ) : (
                <ChevronDown className="w-4 h-4 text-base-content/30" />
              )}
            </button>
            {advancedOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-base-300/40 pt-3">
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">类型禁忌</label>
                  <StringList items={taboos} onChange={setTaboos} placeholder="例如：超自然元素" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">氛围选项</label>
                  <StringList items={atmosphereOptions} onChange={setAtmosphereOptions} placeholder="例如：温馨治愈" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">叙事视角（POV）</label>
                  <StringList items={povOptions} onChange={setPovOptions} placeholder="例如：第三人称有限视角" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">描写技法</label>
                  <StringList items={techniqueTags} onChange={setTechniqueTags} placeholder="例如：场景细节描写" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">满足类型</label>
                  <StringList items={fulfillmentTypes} onChange={setFulfillmentTypes} placeholder="例如：人物成长" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">章节类型</label>
                  <StringList items={chapterTypes} onChange={setChapterTypes} placeholder="例如：日常" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">节奏规则</label>
                  <StringList items={pacingRules} onChange={setPacingRules} placeholder="例如：每章至少 1 次情感刻画" />
                </div>
                <div>
                  <label className="text-[11px] text-base-content/50 font-medium block mb-1.5 tracking-wide">疲劳词</label>
                  <StringList items={fatigueWords} onChange={setFatigueWords} placeholder="例如：突然" />
                </div>
              </div>
            )}
          </div>

          {isEdit && (
            <p className="text-[11px] text-base-content/30 leading-relaxed">
              改动会影响所有使用该题材的作品（各项目的覆盖项仍单独生效）。
            </p>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-base-300/40 bg-base-200/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-base-content/40 hover:text-base-content/70 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm bg-primary/10 border border-primary/30 text-primary rounded-lg font-medium hover:bg-primary/20 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            {isEdit ? "保存修改" : "✦ 创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
