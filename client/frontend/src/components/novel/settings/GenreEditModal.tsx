// ── GenreEditModal ────────────────────────────────────────────────────────
// Create/edit a custom genre in the global library. 创建/编辑双模式：
// genre 为 null → 创建；否则编辑。storyArcTemplates v1 不开放编辑。

import { useState } from "react";
import { Ico, P } from "@/components/icons";
import Modal from "@/components/design/Modal";
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

/** 表单小标签：题材表单统一口径（11px 上下、muted、必填星标 err） */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-medium block mb-1 tracking-wide" style={{ color: "var(--muted)" }}>
      {children}
      {required && <span style={{ color: "var(--err)" }}> *</span>}
    </label>
  );
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
            className="input flex-1"
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
            className="icon-btn"
            style={{ width: 24, height: 24 }}
            title="移除"
          >
            <Ico d={P.close} size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="lnk text-xs inline-flex items-center gap-1"
      >
        <Ico d={P.plus} size={11} /> 添加一项
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
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "编辑题材" : "新建题材"}
      width={520}
      wbStyle
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving && <Ico d={P.spinner} className="spin" size={12} />}
            {isEdit ? "保存修改" : "创建"}
          </button>
        </>
      }
    >
      {error && (
        <p className="text-sm" style={{ color: "var(--err)" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel required>题材名称</FieldLabel>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="例如：末日种田"
            className="input w-full"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel required>题材 ID（英文 slug）</FieldLabel>
          {isEdit ? (
            <div
              className="px-3 py-2 text-sm rounded-lg"
              style={{
                background: "var(--fg-soft)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
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
              className="input w-full"
            />
          )}
          {!isEdit && (
            <p
              className="text-xs mt-1"
              style={{ color: "color-mix(in oklch, var(--fg) 30%, transparent)" }}
            >
              仅小写字母、数字、连字符，以小写字母开头
            </p>
          )}
        </div>
      </div>

      <div>
        <FieldLabel>分类</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {GENRE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className="px-2.5 py-1 text-xs rounded-lg border transition-colors"
              style={
                category === c.id
                  ? {
                      borderColor: "color-mix(in oklch, var(--accent) 40%, transparent)",
                      background: "var(--accent-soft)",
                      color: "var(--accent-strong)",
                    }
                  : { borderColor: "var(--border)", color: "var(--muted)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>题材说明</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="一句话描述这个题材的特征……"
          rows={2}
          className="input w-full resize-none"
        />
      </div>

      <div>
        <FieldLabel>叙事者角色</FieldLabel>
        <input
          value={narratorRole}
          onChange={(e) => setNarratorRole(e.target.value)}
          placeholder="例如：贴近主角内心的全知第三人称"
          className="input w-full"
        />
      </div>

      <div>
        <FieldLabel>提示词注入段</FieldLabel>
        <textarea
          value={promptInjection}
          onChange={(e) => setPromptInjection(e.target.value)}
          placeholder="会嵌入发送给 AI 的系统提示词，影响写作风格与行为"
          rows={2}
          className="input w-full resize-none font-mono text-xs"
        />
      </div>

      {/* ── Optional advanced block ─────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm"
          style={{ color: "color-mix(in oklch, var(--fg) 75%, transparent)" }}
        >
          <span>可选：禁忌与文风蓝图</span>
          <Ico
            d={advancedOpen ? P.up : P.chevronDown}
            size={14}
            style={{ color: "var(--muted)" }}
          />
        </button>
        {advancedOpen && (
          <div className="px-4 pb-4 space-y-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <FieldLabel>类型禁忌</FieldLabel>
              <StringList items={taboos} onChange={setTaboos} placeholder="例如：超自然元素" />
            </div>
            <div>
              <FieldLabel>氛围选项</FieldLabel>
              <StringList items={atmosphereOptions} onChange={setAtmosphereOptions} placeholder="例如：温馨治愈" />
            </div>
            <div>
              <FieldLabel>叙事视角（POV）</FieldLabel>
              <StringList items={povOptions} onChange={setPovOptions} placeholder="例如：第三人称有限视角" />
            </div>
            <div>
              <FieldLabel>描写技法</FieldLabel>
              <StringList items={techniqueTags} onChange={setTechniqueTags} placeholder="例如：场景细节描写" />
            </div>
            <div>
              <FieldLabel>满足类型</FieldLabel>
              <StringList items={fulfillmentTypes} onChange={setFulfillmentTypes} placeholder="例如：人物成长" />
            </div>
            <div>
              <FieldLabel>章节类型</FieldLabel>
              <StringList items={chapterTypes} onChange={setChapterTypes} placeholder="例如：日常" />
            </div>
            <div>
              <FieldLabel>节奏规则</FieldLabel>
              <StringList items={pacingRules} onChange={setPacingRules} placeholder="例如：每章至少 1 次情感刻画" />
            </div>
            <div>
              <FieldLabel>疲劳词</FieldLabel>
              <StringList items={fatigueWords} onChange={setFatigueWords} placeholder="例如：突然" />
            </div>
          </div>
        )}
      </div>

      {isEdit && (
        <p
          className="text-xs leading-relaxed"
          style={{ color: "color-mix(in oklch, var(--fg) 30%, transparent)" }}
        >
          改动会影响所有使用该题材的作品（各项目的覆盖项仍单独生效）。
        </p>
      )}
    </Modal>
  );
}
