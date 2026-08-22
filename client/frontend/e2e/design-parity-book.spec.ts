// 设计一致性视觉比对 —— 书工作台屏（/#/novel/:id vs book.html）。
// 口径与 design-parity.spec.ts（书架）/ design-parity-config.spec.ts（模型配置）一致：
// 原型 file:// 注入 localStorage ainovel.book.v2 控状态（free=清除默认 / pro={pro:true}）；
// 应用侧打桩全量 API，数据与原型 buildBook() 种子逐字段对齐。
//
// 种子对齐要点（原型 → 应用 stub）：
//   卷/章标题：原型存整串「第一卷 · 星海初航」；应用 title 只存名称（nodeLabel 派生序号）
//   → stub title='星海初航'/'锚点'，渲染结果一致（novel-entity-name 口径）。
//   三态点：原型按 chGaps（未确认且有缺口=warn）；应用按章 status 派生
//   → c3/c4 stub status='in_progress' 落 dot-warn，与原型缺口的 warn 一致。
//   字数：正文段落数组 join 后去空白长度（countWords 同口径），运行时从 book.html
//   源码提取 PROSE_C1/C2，避免手抄漂移（C1=793 / C2=578 / 全书 1,371）。
//   免费态零 phase-status 请求；PRO 态 phase-status 非 all-pending（不弹 OnboardingCard）。
import fs from "fs";
import path from "path";
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const PROTO_FILE = path.resolve(process.cwd(), "../../docs/design-c/prototypes/book.html");
const BASELINE_DIR = path.resolve(process.cwd(), "../../docs/design-c/baselines");
const RUN_PARITY = process.env.DESIGN_PARITY === "1";
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 } as const;
const MAX_DIFF_RATIO = 0.002;
const PID = "p1";

/** 从 book.html 源码提取 PROSE_C1/C2 段落数组（原型正文种子，唯一事实源）。 */
function extractProse(): { c1: string[]; c2: string[] } {
  const src = fs.readFileSync(PROTO_FILE, "utf-8");
  const grab = (name: string): string[] => {
    const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
    if (!m) throw new Error(`book.html 中未找到 ${name}`);
    return JSON.parse(`[${m[1]}]`);
  };
  return { c1: grab("PROSE_C1"), c2: grab("PROSE_C2") };
}

// 与原型 countWords 同口径：去空白字符数
const words = (paras: string[]) => paras.join("\n").replace(/\s/g, "").length;

// ── 种子（与 buildBook() 逐字段对齐）──────────────────────────────────────
const SEED = (() => {
  const prose = extractProse();
  const w1 = words(prose.c1);
  const w2 = words(prose.c2);

  const project = {
    id: PID,
    name: "星海拾遗",
    type: "科幻",
    genre: "科幻",
    source: "manual",
  };

  // GET /volumes（workbench 树：结构 + 字数 + 归档位）
  const volumes = [
    {
      ref: "vol-1",
      title: "星海初航",
      chapters: [
        { chapter: 1, title: "锚点", word_count: w1, status: "confirmed", has_prose: true, archived: false },
        { chapter: 2, title: "跃迁", word_count: w2, status: "confirmed", has_prose: true, archived: true },
        { chapter: 3, title: "回声", word_count: 0, status: "in_progress", has_prose: false, archived: false },
      ],
    },
    {
      ref: "vol-2",
      title: "星群之间",
      chapters: [
        { chapter: 4, title: "熄灭", word_count: 0, status: "in_progress", has_prose: false, archived: false },
      ],
    },
  ];

  // GET /tree（useOutline：三态点 + modnav 2/4 章纲）
  const tree = {
    volumes: volumes.map((v, vi) => ({
      ref: v.ref,
      title: v.title,
      summary: vi === 0 ? "废弃星港上，导航员沉舟捡到一枚不属于人类纪元的导航信标。" : "（摘要待补充）",
      chapter_count: v.chapters.length,
      has_prose: v.chapters.some((c) => c.has_prose),
      chapters: v.chapters.map((c) => ({
        ref: `${v.ref}-ch-${c.chapter}`,
        volume: vi + 1,
        chapter: c.chapter,
        title: c.title,
        status: c.status,
        word_count: c.word_count,
        has_prose: c.has_prose,
        archived: c.archived,
      })),
    })),
  };

  // GET /chapters/vol-1-ch-1（默认选中章：章纲已确认 + 正文 793 字）
  const chapter = {
    volume: 1,
    chapter: 1,
    title: "锚点",
    status: "confirmed",
    outline: {
      summary: "信标点亮，沉舟决定沿着信号追踪它的来处。",
      key_points: ["信标亮起，节奏像呼吸", "通讯指示灯跟着信号明灭", "「拾荒者」旧船的关联"],
      characters: ["沉舟"],
      location: "废弃星港 · 观测舱",
      time: "第七年最后一天",
      narrative_pov: "第三人称有限",
      perspective_guidance: "",
    },
    memo: {
      current_task: "建立「回声」悬念：让读者与沉舟一起看见信标，并想知道信号的源头。",
      reader_expectation: {
        state: "被精准的信号节奏勾起好奇，尚不知信标与旧船的关联。",
        strategy: "感官先行 + 克制揭示：只给现象，不给解释。",
        detail: "",
      },
      payoff_plan: {
        must_resolve: ["舷窗裂纹的意象成立"],
        must_hold: ["信标来源成谜"],
        partial_advance: ["修船过程可部分推进"],
      },
      required_changes: ["沉舟从旁观者变成行动者（决定修船出发）。"],
      prohibitions: ["不揭示信标制造者身份"],
    },
    emotional_design: { primary_mood: "压抑" },
    segments: [
      { summary: "港区之夜：信标亮起", target_words: 1200 },
      { summary: "修船与出发决定", target_words: 800 },
    ],
    prose: prose.c1.join("\n"),
    word_count: w1,
    archived: false,
  };

  // GET /readiness：仅题材 done → modnav 设定 1/7
  const readiness = {
    missing: ["synopsis", "world", "style", "anti-ai", "hooks", "characters"].map((key) => ({ key })),
  };

  return { project, volumes, tree, chapter, readiness };
})();

// parity 只取免费态：PRO 态右栏续写/润色/扩写为产品真实工具行（换皮不减功能），
// 原型标「规划中」——已登记 ADJUSTMENTS.md（PR 3「未动原型」清单，parity 态取免费版）。
const CASES = [{ state: "free", pro: false }] as const;

test.describe("design-parity 书工作台屏（book.html）", () => {
  test.skip(
    !RUN_PARITY || !fs.existsSync(PROTO_FILE),
    !RUN_PARITY ? "仅 design:check 运行（DESIGN_PARITY=1）" : "原型缺失：docs/design-c/ 为本地资产"
  );

  for (const c of CASES) {
    test(c.state, async ({ browser }) => {
      // ── 原型侧（设计真值；free=默认种子，pro=LS 覆写）──────────
      const protoCtx = await browser.newContext({ viewport: VIEWPORT });
      await protoCtx.addInitScript((pro) => {
        if (pro) localStorage.setItem("ainovel.book.v2", JSON.stringify({ pro: true }));
        else localStorage.removeItem("ainovel.book.v2");
      }, c.pro);
      const protoPage = await protoCtx.newPage();
      await protoPage.goto(`file://${PROTO_FILE}`);
      await protoPage.evaluate(() => document.fonts.ready);
      await protoPage.waitForTimeout(700);
      const protoShot = await protoPage.screenshot();
      await protoCtx.close();

      // ── 应用侧（打桩固定数据；默认写作视图 + 初次自动选中第一章·章纲）──
      const appCtx = await browser.newContext({ viewport: VIEWPORT });
      await appCtx.addInitScript(() => {
        localStorage.setItem("auth_token", "parity-stub-token");
        localStorage.setItem("auth_username", "parity");
      });
      const appPage = await appCtx.newPage();
      stubBookAPI(appPage, c.pro);
      await appPage.goto(`/#/novel/${PID}`);
      await appPage.waitForSelector(".chtab", { timeout: 10000 });
      await appPage.waitForLoadState("networkidle");
      await appPage.evaluate(() => document.fonts.ready);
      await appPage.waitForTimeout(700); // page-enter 0.4s 收敛
      const appShot = await appPage.screenshot();
      await appCtx.close();

      // ── 比对 ────────────────────────────────────────────────
      const a = PNG.sync.read(protoShot);
      const b = PNG.sync.read(appShot);
      if (a.width !== b.width || a.height !== b.height) {
        throw new Error(
          `截图尺寸不一致（结构差异）：原型 ${a.width}x${a.height} vs 应用 ${b.width}x${b.height}`
        );
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const diffCount = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: 0.1,
      });
      fs.mkdirSync(BASELINE_DIR, { recursive: true });
      const base = `book.${c.state}`;
      fs.writeFileSync(path.join(BASELINE_DIR, `${base}.proto.png`), protoShot);
      fs.writeFileSync(path.join(BASELINE_DIR, `${base}.app.png`), appShot);
      fs.writeFileSync(path.join(BASELINE_DIR, `${base}.diff.png`), PNG.sync.write(diff));
      const ratio = diffCount / (a.width * a.height);
      expect(
        ratio,
        `像素差异率 ${(ratio * 100).toFixed(3)}%（阈值 0.2%）— 三张对比图见 docs/design-c/baselines/${base}.*`
      ).toBeLessThan(MAX_DIFF_RATIO);
    });
  }
});

/** 打桩书工作台全量 API（先注册兜底，后注册具体 → 具体优先）。 */
function stubBookAPI(page: Page, pro: boolean) {
  page.route("**/api/**", (r) => r.fulfill({ json: {} })); // 兜底：未预期请求静默空对象
  page.route(
    "**/api/auth/verify",
    (r) =>
      r.fulfill({
        json: pro
          ? { tier: "monthly", is_member: true, expired: false, trial_remaining_days: 0 }
          : { tier: "none", is_member: false, expired: false, trial_remaining_days: 0 },
      }),
  );
  page.route("**/api/auth/check-auth", (r) => r.fulfill({ json: { code: 1 } }));
  page.route(`**/api/novels/${PID}`, (r) => r.fulfill({ json: SEED.project }));
  page.route(`**/api/novels/${PID}/volumes`, (r) => r.fulfill({ json: SEED.volumes }));
  page.route(`**/api/novels/${PID}/tree`, (r) => r.fulfill({ json: SEED.tree }));
  page.route(`**/api/novels/${PID}/readiness`, (r) => r.fulfill({ json: SEED.readiness }));
  page.route(`**/api/novels/${PID}/chapters/vol-1-ch-1`, (r) => r.fulfill({ json: SEED.chapter }));
  // PRO 态：非 all-pending（不弹 OnboardingCard；原型 pro 态无催促卡）
  page.route(`**/api/novels/${PID}/workflow/phase-status`, (r) =>
    r.fulfill({
      json: {
        phases: {
          settings: "in_progress",
          outline: "in_progress",
          prompt: "pending",
          write: "pending",
          archive: "pending",
        },
      },
    })
  );
}
