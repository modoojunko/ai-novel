// ai-prompt-crafting 6.1 — 章纲新格子（场景卡 weight/focus、读者获得、
// 章末落点、目标字数）的纯映射测试：填值保存回读 round-trip、存量空值
// 不进必填缺口、枚举非法值兜底、空行过滤与字数解析。
import { describe, expect, it } from "vitest";
import {
  EMPTY_OG_FORM,
  ogGaps,
  ogToForm,
  ogToPartial,
  type OgForm,
} from "@/components/novel/workbench/chapterForm";
import type { ChapterData } from "@/hooks/useOutline";

const FILLED: ChapterData = {
  title: "第三章",
  outline: { summary: "s", characters: ["林昭"] },
  memo: { current_task: "t" },
  emotional_design: { primary_mood: "紧张" },
  segments: [{ summary: "a", target_words: 800 }],
  scene_cards: [
    {
      scene_name: "城门",
      goal: "入城",
      obstacle: "盘查",
      hook: "通缉令",
      weight: "high",
      focus: "核心冲突",
    },
    { scene_name: "茶棚", goal: "问路", obstacle: "", hook: "", weight: "low" },
  ],
  micro_payoffs: [
    { kind: "clue", description: "通缉令上有旧印记", location: "前段" },
    { kind: "emotion", description: "妹妹的旧物" },
  ],
  ladder_exit: "他收起通缉令，转身入夜色。",
  word_target: 4000,
} as ChapterData;

describe("ogToForm/ogToPartial round-trip（章纲新格子）", () => {
  it("新格子字段完整回读并再次保存不丢失", () => {
    const form = ogToForm(FILLED);
    expect(form.scenes).toEqual([
      { n: "城门", g: "入城", o: "盘查", h: "通缉令", w: "high", f: "核心冲突" },
      { n: "茶棚", g: "问路", o: "", h: "", w: "low", f: "" },
    ]);
    expect(form.payoffs).toEqual([
      { k: "clue", d: "通缉令上有旧印记", l: "前段" },
      { k: "emotion", d: "妹妹的旧物", l: "" },
    ]);
    expect(form.ladder).toBe("他收起通缉令，转身入夜色。");
    expect(form.wt).toBe("4000");

    const saved = ogToPartial(form, FILLED);
    expect(saved.scene_cards).toEqual(FILLED.scene_cards);
    expect(saved.micro_payoffs).toEqual(FILLED.micro_payoffs);
    expect(saved.ladder_exit).toBe(FILLED.ladder_exit);
    expect(saved.word_target).toBe(4000);
  });

  it("场景名空行不保存；未选的 weight/focus/location 省略键", () => {
    const form: OgForm = {
      ...EMPTY_OG_FORM,
      scenes: [
        { n: "  ", g: "x", o: "", h: "", w: "", f: "" }, // 空场景名 → 过滤
        { n: "渡口", g: "", o: "", h: "", w: "", f: "" }, // 无枚举 → 键省略
      ],
      payoffs: [{ k: "twist", d: " ", l: "" }], // 空描述 → 过滤
    };
    const saved = ogToPartial(form);
    expect(saved.scene_cards).toEqual([{ scene_name: "渡口", goal: "", obstacle: "", hook: "" }]);
    expect(saved.micro_payoffs).toEqual([]);
  });

  it("word_target 非法/未填 → null，不改写为 0", () => {
    expect(ogToPartial({ ...EMPTY_OG_FORM, wt: "abc" }).word_target).toBeNull();
    expect(ogToPartial({ ...EMPTY_OG_FORM, wt: "" }).word_target).toBeNull();
    expect(ogToPartial({ ...EMPTY_OG_FORM, wt: "2500" }).word_target).toBe(2500);
  });

  it("存量非法枚举值回读兜底（weight/focus 清空，kind 回落 clue）", () => {
    const legacy = {
      ...FILLED,
      scene_cards: [{ scene_name: "x", weight: "超高", focus: "不知道" }],
      micro_payoffs: [{ kind: "unknown", description: "d", location: "结尾" }],
    } as ChapterData;
    const form = ogToForm(legacy);
    expect(form.scenes[0].w).toBe("");
    expect(form.scenes[0].f).toBe("");
    expect(form.payoffs[0].k).toBe("clue");
    expect(form.payoffs[0].l).toBe("");
  });
});

describe("存量章纲空值不警告", () => {
  it("新格子全空的存量章不进必填缺口（口径仍是六项）", () => {
    const form = ogToForm(FILLED);
    const gaps = ogGaps(form).map((g) => g.key);
    // 六项必填与 ai-prompt-crafting 之前口径一致，新格子不新增缺口
    expect(gaps).toEqual(["rstate", "rstrat", "changes"]);
    expect(gaps).not.toContain("scenes");
    expect(gaps).not.toContain("payoffs");
    expect(gaps).not.toContain("ladder");
    expect(gaps).not.toContain("wt");
  });

  it("无任何新格子字段的旧章 → 空数组/空串，不抛错", () => {
    const form = ogToForm({
      title: "旧章",
      outline: { summary: "s" },
      memo: {},
      segments: [],
    } as unknown as ChapterData);
    expect(form.scenes).toEqual([]);
    expect(form.payoffs).toEqual([]);
    expect(form.ladder).toBe("");
    expect(form.wt).toBe("");
  });
});
