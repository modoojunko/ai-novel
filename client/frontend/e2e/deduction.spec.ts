import { test, expect } from "@playwright/test";
import { url, API_URL, setToken } from "./helpers";

let sharedSlug = "";
let sharedToken = "";

test.describe("Story Deduction", () => {
  test.beforeAll(async ({ browser }) => {
    // Setup: create user + project + confirm settings
    // DEV_MODE backend returns devuser for all requests, no register needed
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(url("/books"));
    const token = "dev-token";
    sharedToken = token;
    await setToken(page, token);

    // Note: config.json at DATA_ROOT/config.json must have "token": "dev-token"
    // created manually (e.g. via backend/data/config.json) so the middleware
    // accepts the dev-token Authorization header.

    const pResp = await page.request.post(`${API_URL}/projects`, {
      data: { name: `DeductionE2E_${Date.now()}` },
      headers: { Authorization: `Bearer ${token}` },
    });
    const project = await pResp.json();
    sharedSlug = project.slug;

    const bySlug = await page.request.get(`${API_URL}/projects/by-slug/${sharedSlug}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { id: projectId } = await bySlug.json();

    // Write settings to pass gate
    await page.request.put(`${API_URL}/projects/${projectId}/settings/world`, {
      data: { a: "1", b: "2", c: "3", d: "4", e: "5" },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/style`, {
      data: { role: "writer" },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.request.put(`${API_URL}/projects/${projectId}/settings/hooks`, {
      data: { active: [{ x: "1" }, { x: "2" }, { x: "3" }] },
      headers: { Authorization: `Bearer ${token}` },
    });
    await page.waitForTimeout(2000);
    for (const st of ["world", "style", "anti-ai", "hooks", "characters"]) {
      await page.request.put(`${API_URL}/projects/${projectId}/settings/status/${st}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(url("/books"));
    await setToken(page, sharedToken);
    await page.goto(url(`/project/${sharedSlug}`));
    for (let i = 0; i < 3; i++) {
      const ok = await page.locator("h1").isVisible().catch(() => false);
      if (ok) break;
      await page.waitForTimeout(2000);
    }
  });

  // ==================================================================
  // EXISTING TESTS — kept exactly as-is (with minor wait improvements)
  // ==================================================================

  test("deduction tab is visible in top bar", async ({ page }) => {
    await expect(page.getByText("推演")).toBeVisible();
  });

  test("clicking deduction tab shows init button", async ({ page }) => {
    await page.getByText("推演").click();
    await expect(page.getByText("初始化推演")).toBeVisible();
  });

  test("clicking init shows seed modal when no missing items", async ({ page }) => {
    // Mock the init API
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "test-123",
          stage: { terrain: "测试场景", time: "白天", weather: "晴" },
          characters: ["角色A", "角色B"],
          missing: [],
        }),
      });
    });
    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    // Should show seed input modal
    await expect(page.getByText("输入触发种子")).toBeVisible({ timeout: 10000 });
  });

  test("round controls appear after setting seed", async ({ page }) => {
    // Mock init
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "test-456",
          stage: { terrain: "测试场景", time: "白天" },
          characters: ["A"],
          missing: [],
        }),
      });
    });
    // Mock seed
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    // Mock round
    await page.route("**/api/story/*/round", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: 1,
          stage: { terrain: "测试", events: [{ actor: "A", action: "移动", result: "走了两步", round: 1, visibility: "公开" }] },
          decisions: [{ character_id: "A", log: { action_type: "动作", action_description: "A向前走了两步", inner_monologue: "继续走" } }],
          characters: { A: { position: "前方", stamina: 90, emotion: "平静", urgency: "", knowledge: [] } },
        }),
      });
    });

    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await page.locator(".modal-box").waitFor({ state: "visible", timeout: 5000 });

    // Fill and submit seed
    await page.getByPlaceholder("输入触发种子…").fill("测试开始");
    await page.getByText("开始推演").click();

    // Should show round controls
    await expect(page.getByText("下一回合")).toBeVisible({ timeout: 5000 });
  });

  // ==================================================================
  // D.4 — 回溯推演 (Backtrack / Rewind)
  // ==================================================================

  test("backtrack button appears after multiple deduction rounds", async ({ page }) => {
    // Mock init API
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "rewind-appear",
          stage: { terrain: "测试场景", time: "白天", weather: "晴" },
          characters: ["A"],
          missing: [],
        }),
      });
    });
    // Mock seed API
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    // Mock round — increment round number on each call
    let roundNum = 0;
    await page.route("**/api/story/*/round", async (route) => {
      roundNum++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: roundNum,
          stage: {
            terrain: "测试",
            events: [{ actor: "A", action: "移动", result: `第${roundNum}步`, round: roundNum, visibility: "公开" }],
          },
          decisions: [
            {
              character_id: "A",
              log: {
                action_type: "动作",
                action_description: `A第${roundNum}步`,
                inner_monologue: "",
              },
            },
          ],
          characters: {
            A: {
              position: roundNum === 1 ? "前方" : "更前方",
              stamina: 100 - roundNum * 10,
              emotion: "平静",
              urgency: "",
              knowledge: [],
            },
          },
        }),
      });
    });

    // Navigate to deduction tab and init
    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await expect(page.getByPlaceholder("输入触发种子…")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("输入触发种子…").fill("回溯测试");
    await page.getByText("开始推演").click();

    // Wait for first round to complete (auto-runs after seed)
    await expect(page.getByText("回合 1")).toBeVisible({ timeout: 10000 });

    // Run second round
    await page.getByText("下一回合").click();
    await expect(page.getByText("回合 2")).toBeVisible();

    // Backtrack button (回退) should now be visible and enabled (round >= 1)
    await expect(page.getByText("回退")).toBeVisible();
    await expect(page.getByText("回退")).not.toBeDisabled();
  });

  test("clicking backtrack returns to previous round and updates indicator", async ({ page }) => {
    // Mock init
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "rewind-action",
          stage: { terrain: "场景", time: "白天", weather: "晴" },
          characters: ["A"],
          missing: [],
        }),
      });
    });
    // Mock seed
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    // Mock round with counter
    let callIdx = 0;
    await page.route("**/api/story/*/round", async (route) => {
      callIdx++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: callIdx,
          stage: {
            terrain: "场景",
            events: [{ actor: "A", action: "移动", result: `步${callIdx}`, round: callIdx, visibility: "公开" }],
          },
          decisions: [
            {
              character_id: "A",
              log: { action_type: "动作", action_description: `A步${callIdx}`, inner_monologue: "" },
            },
          ],
          characters: {
            A: {
              position: callIdx === 1 ? "起点" : "中途",
              stamina: 100 - callIdx * 10,
              emotion: "平静",
              urgency: "",
              knowledge: [],
            },
          },
        }),
      });
    });
    // Mock rewind API
    await page.route("**/api/story/*/rewind/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: 1,
          stage: { terrain: "场景", time: "白天" },
          characters: { A: { position: "起点", stamina: 90, emotion: "平静" } },
        }),
      });
    });

    // Run deduction to round 2
    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await expect(page.getByPlaceholder("输入触发种子…")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("输入触发种子…").fill("回溯测试2");
    await page.getByText("开始推演").click();
    await expect(page.getByText("回合 1")).toBeVisible({ timeout: 10000 });

    await page.getByText("下一回合").click();
    await expect(page.getByText("回合 2")).toBeVisible();

    // Register wait for rewind response before clicking
    const rewindResponse = page.waitForResponse(
      (r) => r.url().includes("/rewind/") && r.status() === 200
    );
    // Click backtrack
    await page.getByText("回退").click();
    await rewindResponse;

    // Round indicator should show round 1
    await expect(page.getByText("回合 1")).toBeVisible();
    // Round 2 text should no longer appear in the round indicator
    await expect(page.getByText("回合 2")).toHaveCount(0);
  });

  // ==================================================================
  // D.5 — 角色状态与场景展示（调整参数的基础视图）
  // ==================================================================

  test("character state and stage terrain display after deduction round", async ({ page }) => {
    // Mock init with two characters
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "state-display",
          stage: { terrain: "古老森林", time: "黄昏", weather: "雾" },
          characters: ["亚瑟", "梅林"],
          missing: [],
        }),
      });
    });
    // Mock seed
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    // Mock round with rich character and stage data
    await page.route("**/api/story/*/round", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: 1,
          stage: {
            terrain: "古老森林",
            time: "黄昏",
            weather: "雾",
            events: [
              {
                actor: "亚瑟", action: "探索", target: "林间小道", result: "发现足迹",
                round: 1, visibility: "公开",
              },
            ],
          },
          decisions: [
            {
              character_id: "亚瑟",
              log: {
                action_type: "探索",
                action_description: "亚瑟沿着林间小道前进",
                inner_monologue: "有动静",
              },
            },
            {
              character_id: "梅林",
              log: {
                action_type: "观察",
                action_description: "梅林在后方警戒",
                inner_monologue: "小心为上",
              },
            },
          ],
          characters: {
            亚瑟: {
              position: "林间小道",
              stamina: 85,
              emotion: "警惕",
              urgency: "低",
              knowledge: ["发现足迹"],
            },
            梅林: {
              position: "后方",
              stamina: 95,
              emotion: "冷静",
              urgency: "",
              knowledge: [],
            },
          },
        }),
      });
    });

    // Run deduction
    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await expect(page.getByPlaceholder("输入触发种子…")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("输入触发种子…").fill("森林探索");
    await page.getByText("开始推演").click();
    await expect(page.getByText("回合 1")).toBeVisible({ timeout: 10000 });

    // === Character state display ===

    // Character names visible in cards (appears in both StageMap and CharacterCard)
    await expect(page.getByText("亚瑟").first()).toBeVisible();
    await expect(page.getByText("梅林").first()).toBeVisible();

    // Position labels and values (labels appear per character card, positions appear in both StageMap and CharacterCard)
    await expect(page.getByText("林间小道").first()).toBeVisible();
    await expect(page.getByText("后方").first()).toBeVisible();
    await expect(page.getByText("位置").first()).toBeVisible();

    // Stamina percentage badges
    await expect(page.getByText("85%")).toBeVisible();
    await expect(page.getByText("95%")).toBeVisible();

    // Emotion values and label (appears per character card)
    await expect(page.getByText("警惕").first()).toBeVisible();
    await expect(page.getByText("冷静").first()).toBeVisible();
    await expect(page.getByText("情绪").first()).toBeVisible();

    // Urgency (only for character that has it)
    await expect(page.getByText("低").first()).toBeVisible();

    // === Stage terrain display ===
    await expect(page.getByText("古老森林")).toBeVisible();
    await expect(page.getByText("舞台")).toBeVisible();

    // === Event wall display ===
    await expect(page.getByText("第 1 回合 · 事件")).toBeVisible();
    await expect(page.getByText("发现足迹")).toBeVisible();
  });

  // ==================================================================
  // D.6 — 结束推演
  // ==================================================================

  test("end deduction button is visible after running rounds", async ({ page }) => {
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "end-btn",
          stage: { terrain: "测试", time: "白天", weather: "晴" },
          characters: ["A"],
          missing: [],
        }),
      });
    });
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/api/story/*/round", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: 1,
          stage: {
            terrain: "测试",
            events: [{ actor: "A", action: "测试", result: "完成", round: 1, visibility: "公开" }],
          },
          decisions: [
            {
              character_id: "A",
              log: { action_type: "测试", action_description: "测试动作", inner_monologue: "" },
            },
          ],
          characters: {
            A: { position: "起点", stamina: 100, emotion: "平静", urgency: "", knowledge: [] },
          },
        }),
      });
    });

    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await expect(page.getByPlaceholder("输入触发种子…")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("输入触发种子…").fill("结束测试");
    await page.getByText("开始推演").click();
    await expect(page.getByText("回合 1")).toBeVisible({ timeout: 10000 });

    // End button should be visible alongside round controls
    await expect(page.getByText("结束")).toBeVisible();
  });

  test("clicking end deduction resets to initial state", async ({ page }) => {
    await page.route("**/api/story/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deduction_id: "end-reset",
          stage: { terrain: "测试", time: "白天", weather: "晴" },
          characters: ["A"],
          missing: [],
        }),
      });
    });
    await page.route("**/api/story/*/seed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/api/story/*/round", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          round: 1,
          stage: {
            terrain: "测试",
            events: [{ actor: "A", action: "结束", result: "完成", round: 1, visibility: "公开" }],
          },
          decisions: [
            {
              character_id: "A",
              log: { action_type: "结束", action_description: "结束动作", inner_monologue: "" },
            },
          ],
          characters: {
            A: { position: "终点", stamina: 50, emotion: "疲惫", urgency: "", knowledge: [] },
          },
        }),
      });
    });

    await page.getByText("推演").click();
    await page.getByText("初始化推演").click();
    await expect(page.getByPlaceholder("输入触发种子…")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("输入触发种子…").fill("结束测试");
    await page.getByText("开始推演").click();
    await expect(page.getByText("回合 1")).toBeVisible({ timeout: 10000 });

    // Click end button — component calls window.location.reload()
    // Use button role to avoid matching event text "A 结束 · 完成"
    await page.getByRole("button", { name: "结束" }).click();

    // Page reloads, default tab is settings; navigate back to deduction tab
    await page.getByText("推演").click();
    // The deduction panel should show its initial state (no deduction running)
    await expect(page.getByText("准备开始剧情推演")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("初始化推演")).toBeVisible();
  });
});
