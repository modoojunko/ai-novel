// 设计一致性视觉比对（design:check 第 1 层）—— 原型即基线。
// 同一次 run 内截「原型 file:// 页」与「应用页（打桩固定数据）」，
// pixelmatch 逐像素比对，双主题 × 全状态；差异图落 docs/design-c/baselines/。
// 仅 design:check（DESIGN_PARITY=1）运行；常规 `playwright test` 跳过，
// 且 docs/design-c/ 本地资产缺失时自动跳过（不入 git，fresh clone 无此目录）。
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

// process.cwd() = client/frontend（playwright 运行目录，与既有 spec 一致；type:module 下无 __dirname）
const PROTO_FILE = path.resolve(process.cwd(), "../../docs/design-c/prototypes/01-novel-list.html");
const BASELINE_DIR = path.resolve(process.cwd(), "../../docs/design-c/baselines");
const RUN_PARITY = process.env.DESIGN_PARITY === "1";
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 } as const;
const MAX_DIFF_RATIO = 0.002; // 0.2% 像素阈值（抗锯齿容差）

// 与原型 data-state=books 完全一致的固定数据（日期取 UTC 午间，任何时区同日）
const FIXED_NOVELS = [
  {
    id: "parity-1",
    name: "剑起苍澜",
    slug: "parity-1",
    current_phase: "write",
    total_volumes: 2,
    total_chapters: 12,
    updated_at: "2026-08-20T10:30:00.000Z",
  },
];

const CASES = [
  {
    state: "books",
    novels: FIXED_NOVELS,
    verify: { tier: "monthly", is_member: true, expired: false, trial_remaining_days: 0 },
  },
  {
    state: "empty",
    novels: [],
    verify: { tier: "none", is_member: false, expired: false, trial_remaining_days: 0 },
  },
] as const;

const THEMES = ["novelforge", "parchment"] as const;

test.describe("design-parity 书列表屏", () => {
  test.skip(
    !RUN_PARITY || !fs.existsSync(PROTO_FILE),
    !RUN_PARITY ? "仅 design:check 运行（DESIGN_PARITY=1）" : "原型缺失：docs/design-c/ 为本地资产"
  );

  for (const theme of THEMES) {
    for (const c of CASES) {
      test(`${theme} · ${c.state}`, async ({ browser }) => {
        // ── 原型侧（设计真值）──────────────────────────────────
        const protoCtx = await browser.newContext({ viewport: VIEWPORT });
        const protoPage = await protoCtx.newPage();
        await protoPage.goto(`file://${PROTO_FILE}?theme=${theme}&state=${c.state}`);
        await protoPage.evaluate(() => document.fonts.ready);
        await protoPage.waitForTimeout(700); // page-enter 0.4s + 全局过渡 0.2s 收敛
        const protoShot = await protoPage.screenshot();
        await protoCtx.close();

        // ── 应用侧（打桩固定数据）──────────────────────────────
        const appCtx = await browser.newContext({ viewport: VIEWPORT });
        await appCtx.addInitScript((t) => {
          localStorage.setItem("auth_token", "parity-stub-token");
          localStorage.setItem("auth_username", "parity");
          localStorage.setItem("ai-novel-theme", t);
        }, theme);
        const appPage = await appCtx.newPage();
        await appPage.route("**/api/novels", (r) => r.fulfill({ json: c.novels }));
        await appPage.route("**/api/auth/verify", (r) => r.fulfill({ json: c.verify }));
        await appPage.route("**/api/auth/config", (r) =>
          r.fulfill({ json: { has_api_key: true, portal_url: "" } })
        );
        await appPage.route("**/api/auth/check-auth", (r) => r.fulfill({ json: { code: 1 } }));
        await appPage.goto("/#/novels");
        await appPage.waitForLoadState("networkidle");
        await appPage.evaluate(() => document.fonts.ready);
        await appPage.waitForTimeout(700);
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
        const base = `01-novel-list.${theme}.${c.state}`;
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
  }
});
