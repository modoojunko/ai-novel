import { test, expect } from "@playwright/test";
import { url, createTestUser } from "./helpers";

// ── Helpers ──────────────────────────────────────────────────────────────

async function mockEmpty(page: any) {
  await page.route("**/api/v1/api-configs", async (r: any) => {
    if (r.request().method() === "GET") {
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    } else { await r.fulfill({ status: 405 }); }
  });
}

async function mockOne(page: any, overrides: Record<string, any> = {}) {
  const cfg = {
    id: "cfg-1", name: "my OpenAI", vendor: "openai",
    vendor_display_name: "OpenAI", base_url: "https://api.openai.com",
    api_key_masked: "sk-test****abcd", status: "active",
    last_test_status: "ok", last_test_error: null, last_tested_at: null,
    models: ["gpt-4o", "gpt-4o-mini"],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
  await page.route("**/api/v1/api-configs", async (r: any) => {
    if (r.request().method() === "GET") {
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([cfg]) });
    } else if (r.request().method() === "DELETE") {
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, affected_projects: 0, affected_names: [] }) });
    } else if (r.request().method() === "PUT") {
      const bd = JSON.parse(r.request().postData() || "{}");
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...cfg, ...bd }) });
    } else { await r.fulfill({ status: 405 }); }
  });
}

async function mockProfile(page: any, o: Record<string, any> = {}) {
  await page.route("**/api/v1/user/profile", async (r: any) => {
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "u", email: "t@t.com", display_name: "T", ...o }) });
  });
}

async function mockModel(page: any, pid: string, data: any = {}) {
  await page.route(`**/api/v1/projects/${pid}/ai-model`, async (r: any) => {
    if (r.request().method() === "GET") {
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ api_config_id: null, model: null, config_name: null, ...data }) });
    } else {
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...data }) });
    }
  });
}

async function mockHistory(page: any, pid: string, h: any[] = []) {
  await page.route(`**/api/v1/projects/${pid}/model-history`, async (r: any) => {
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ history: h }) });
  });
}

test.describe("API Key Configuration", () => {

  test.describe("Empty State", () => {
    test("shows empty state when no keys", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: "API Key 配置" })).toBeVisible();
      await expect(page.getByText("还没有 API Key 配置")).toBeVisible();
    });
  });

  test.describe("Add Key", () => {
    test("add button opens form with all 8 vendors", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "添加 API Key" }).click();
      await expect(page.getByText("供应商")).toBeVisible();
      for (const v of ["OpenAI","Anthropic","DeepSeek","GLM","Kimi","Qwen","Ollama","OpenAI 兼容"]) {
        await expect(page.getByText(v)).toBeVisible();
      }
    });

    test("selecting vendor auto-fills base URL", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "添加 API Key" }).click();
      await page.getByText("DeepSeek").first().click();
      await expect(page.locator('input[placeholder="https://api.openai.com"]')).toHaveValue("https://api.deepseek.com");
    });

    test("Ollama has no API Key field", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "添加 API Key" }).click();
      await page.getByText("Ollama").first().click();
      await expect(page.locator('input[placeholder="Ollama 不需要 API Key"]')).toBeVisible();
    });

    test("form validation with empty name", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "添加 API Key" }).click();
      await page.getByRole("button", { name: "保存并测试连接" }).click();
      await expect(page.getByText("请输入配置名称")).toBeVisible();
    });

    test("duplicate name returns 409", async ({ page }) => {
      await createTestUser(page);
      await page.route("**/api/v1/api-configs", async (r: any) => {
        r.request().method() === "GET"
          ? await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
          : await r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ detail: "名称已被使用" }) });
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "添加 API Key" }).click();
      await page.fill('input[placeholder="例如：我的 OpenAI"]', "重复");
      await page.getByText("DeepSeek").first().click();
      await page.fill('input[type="password"]', "sk-k");
      await page.getByRole("button", { name: "保存并测试连接" }).click();
      await expect(page.getByText("名称已被使用")).toBeVisible({ timeout: 5000 });
    });

    test("create config then card visible", async ({ page }) => {
      await createTestUser(page);
      let gc = 0;
      await page.route("**/api/v1/api-configs", async (r: any) => {
        if (r.request().method() === "GET") {
          gc++;
          await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gc === 1 ? [] : [{
            id:"n1", name:"my test", vendor:"deepseek", vendor_display_name:"DeepSeek",
            base_url:"https://api.deepseek.com", api_key_masked:"sk-t****8", status:"active",
            models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
          }]) });
        } else {
          await r.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
            id:"n1", name:"my test", vendor:"deepseek", vendor_display_name:"DeepSeek",
            base_url:"https://api.deepseek.com", api_key_masked:"sk-t****8", status:"active",
            models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
          }) });
        }
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "添加 API Key" }).click();
      await page.fill('input[placeholder="例如：我的 OpenAI"]', "my test");
      await page.getByText("DeepSeek").first().click();
      await page.fill('input[type="password"]', "sk-test-key");
      await page.getByRole("button", { name: "保存并测试连接" }).click();
      await expect(page.getByText("my test")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("sk-t****8")).toBeVisible();
    });
  });

  test.describe("Card Display", () => {
    test("shows masked key model tags and status", async ({ page }) => {
      await createTestUser(page); await mockOne(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByText("my OpenAI")).toBeVisible();
      await expect(page.getByText("sk-test****abcd")).toBeVisible();
      await expect(page.getByText("gpt-4o")).toBeVisible();
      await expect(page.getByText("连接正常")).toBeVisible();
    });

    test("auth_error rate_limited untested statuses", async ({ page }) => {
      await createTestUser(page);
      for (const s of [{st:"auth_error",lb:"认证失败"},{st:"rate_limited",lb:"频率限制"},{st:null,lb:"未测试"}]) {
        await page.route("**/api/v1/api-configs", async (r: any) => {
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
            id:"ck", name:"card", vendor:"openai", vendor_display_name:"OpenAI",
            base_url:"https://api.openai.com", api_key_masked:"sk-c****k", status:"active",
            last_test_status:s.st, models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
          }]) });
        });
        await page.goto(url("/config")); await page.waitForLoadState("networkidle");
        await expect(page.getByText(s.lb)).toBeVisible();
      }
    });

    test("multiple configs render as grid", async ({ page }) => {
      await createTestUser(page);
      await page.route("**/api/v1/api-configs", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([
          { id:"a", name:"Key A", vendor:"openai", vendor_display_name:"OpenAI", base_url:"https://api.openai.com", api_key_masked:"sk-a****1", status:"active", models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
          { id:"b", name:"Key B", vendor:"deepseek", vendor_display_name:"DeepSeek", base_url:"https://api.deepseek.com", api_key_masked:"sk-b****2", status:"active", models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
        ]) });
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByText("Key A")).toBeVisible();
      await expect(page.getByText("Key B")).toBeVisible();
    });
  });

  test.describe("Edit Config", () => {
    test("edit opens form prefilled vendor grid hidden", async ({ page }) => {
      await createTestUser(page); await mockOne(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "编辑" }).click();
      await expect(page.locator('input[value="my OpenAI"]')).toBeVisible();
      await expect(page.locator("text=Anthropic")).toHaveCount(0);
    });

    test("edit name and save calls PUT", async ({ page }) => {
      await createTestUser(page);
      let pb: any = null;
      await page.route("**/api/v1/api-configs", async (r: any) => {
        if (r.request().method() === "GET") {
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
            id:"ce1", name:"old name", vendor:"openai", vendor_display_name:"OpenAI",
            base_url:"https://api.openai.com", api_key_masked:"sk-o****8", status:"active",
            models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
          }]) });
        } else if (r.request().method() === "PUT") {
          pb = JSON.parse(r.request().postData() || "{}");
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({
            id:"ce1", name:"new name", vendor:"openai", vendor_display_name:"OpenAI",
            base_url:"https://api.openai.com", api_key_masked:"sk-o****8", status:"active",
            models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
          }) });
        }
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "编辑" }).click();
      await page.locator('input[value="old name"]').fill("new name");
      await page.getByRole("button", { name: "保存" }).click();
      await expect(page.getByText("new name")).toBeVisible({ timeout: 5000 });
      expect(pb?.name).toBe("new name");
    });
  });

  test.describe("Delete + UndoToast", () => {
    test("delete shows confirmation dialog", async ({ page }) => {
      await createTestUser(page); await mockOne(page);
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "删除" }).first().click();
      await expect(page.getByText("确认删除")).toBeVisible();
    });

    test("affected projects count displayed", async ({ page }) => {
      await createTestUser(page);
      await page.route("**/api/v1/api-configs", async (r: any) => {
        r.request().method() === "GET"
          ? await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
              id:"cd2", name:"delete key", vendor:"openai", vendor_display_name:"OpenAI",
              base_url:"https://api.openai.com", api_key_masked:"sk-d****9", status:"active",
              models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
            }]) })
          : await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ ok:true, affected_projects:3, affected_names:["A","B","C"] }) });
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "删除" }).first().click();
      await expect(page.getByTestId("affected-novels-count")).toHaveText("3");
    });

    test("confirm delete calls DELETE API", async ({ page }) => {
      await createTestUser(page);
      let dc = false;
      await page.route("**/api/v1/api-configs", async (r: any) => {
        if (r.request().method() === "GET") {
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
            id:"cd3", name:"to delete", vendor:"openai", vendor_display_name:"OpenAI",
            base_url:"https://api.openai.com", api_key_masked:"sk-d****7", status:"active",
            models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
          }]) });
        } else if (r.request().method() === "DELETE") {
          dc = true;
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ ok:true, affected_projects:0, affected_names:[] }) });
        }
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "删除" }).first().click();
      await page.getByRole("button", { name: "确认删除" }).click();
      expect(dc).toBe(true);
    });

    test("undo toast appears after delete", async ({ page }) => {
      await createTestUser(page);
      await page.route("**/api/v1/api-configs", async (r: any) => {
        r.request().method() === "GET"
          ? await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
              id:"cu1", name:"undo test", vendor:"openai", vendor_display_name:"OpenAI",
              base_url:"https://api.openai.com", api_key_masked:"sk-u****1", status:"active",
              models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
            }]) })
          : await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ ok:true, affected_projects:0, affected_names:[] }) });
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "删除" }).first().click();
      await page.getByRole("button", { name: "确认删除" }).click();
      await expect(page.getByText("撤销测试")).toBeVisible();
      await expect(page.getByRole("button", { name: "撤销" })).toBeVisible();
    });
  });

  test.describe("MigrationBanner", () => {
    test("shows dismiss persists hidden when migration true", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await mockProfile(page, { migration_completed: false });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByText("API Key 管理已升级")).toBeVisible();
      await page.getByRole("button", { name: "知道了" }).click();
      await expect(page.getByText("API Key 管理已升级")).not.toBeVisible();
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByText("API Key 管理已升级")).not.toBeVisible();
      await mockProfile(page, { migration_completed: true });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByText("API Key 管理已升级")).not.toBeVisible();
    });
  });

  test.describe("StatusBadge in Settings", () => {
    test("configured shows config/model name", async ({ page }) => {
      await createTestUser(page); const p1 = "ps1";
      await mockOne(page); await mockModel(page, p1, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await page.goto(url(`/novel/${p1}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("my OpenAI / gpt-4o")).toBeVisible();
    });

    test("no_key links to /config", async ({ page }) => {
      await createTestUser(page); const p2 = "ps2";
      await mockEmpty(page); await mockModel(page, p2);
      await page.goto(url(`/novel/${p2}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("未配置 API Key")).toBeVisible();
    });

    test("invalid when config deleted", async ({ page }) => {
      await createTestUser(page); const p3 = "ps3";
      await page.route("**/api/v1/api-configs", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
          id:"oc", name:"other", vendor:"openai", vendor_display_name:"OpenAI",
          base_url:"https://api.openai.com", api_key_masked:"sk-o****9", status:"active",
          models:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
        }]) });
      });
      await page.route(`**/api/v1/projects/${p3}/ai-model`, async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ api_config_id:"deleted-cfg", model:"gpt-4o", config_name:null }) });
      });
      await page.goto(url(`/novel/${p3}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("模型已失效")).toBeVisible();
    });
  });

  test.describe("ModelSelector", () => {
    test("models grouped by config", async ({ page }) => {
      await createTestUser(page); const pm1 = "pm1";
      await page.route("**/api/v1/api-configs", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([
          { id:"a", name:"OpenAI Key", vendor:"openai", vendor_display_name:"OpenAI", base_url:"https://api.openai.com", api_key_masked:"sk-a****1", status:"active", models:["gpt-4o","gpt-4o-mini"], created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
          { id:"b", name:"DS Key", vendor:"deepseek", vendor_display_name:"DeepSeek", base_url:"https://api.deepseek.com", api_key_masked:"sk-b****2", status:"active", models:["deepseek-v4-flash"], created_at:new Date().toISOString(), updated_at:new Date().toISOString() },
        ]) });
      });
      await mockModel(page, pm1);
      await page.goto(url(`/novel/${pm1}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("OpenAI Key")).toBeVisible();
      await expect(page.getByText("gpt-4o")).toBeVisible();
      await expect(page.getByText("deepseek-v4-flash")).toBeVisible();
    });

    test("selecting model calls PUT", async ({ page }) => {
      await createTestUser(page); const pm2 = "pm2";
      let pc = false; let pb: any = null;
      await page.route("**/api/v1/api-configs", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify([{
          id:"c", name:"Key A", vendor:"openai", vendor_display_name:"OpenAI",
          base_url:"https://api.openai.com", api_key_masked:"sk-c****3", status:"active",
          models:["gpt-4o"], created_at:new Date().toISOString(), updated_at:new Date().toISOString(),
        }]) });
      });
      await page.route(`**/api/v1/projects/${pm2}/ai-model`, async (r: any) => {
        if (r.request().method() === "GET") {
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ api_config_id:null, model:null, config_name:null }) });
        } else {
          pc = true; pb = JSON.parse(r.request().postData() || "{}");
          await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ api_config_id:"c", model:"gpt-4o" }) });
        }
      });
      await page.goto(url(`/novel/${pm2}/settings`)); await page.waitForLoadState("networkidle");
      await page.getByText("gpt-4o").first().click();
      expect(pc).toBe(true);
      expect(pb.api_config_id).toBe("c");
      expect(pb.model).toBe("gpt-4o");
    });

    test("empty state when no models", async ({ page }) => {
      await createTestUser(page); const pm3 = "pm3";
      await mockEmpty(page); await mockModel(page, pm3);
      await page.goto(url(`/novel/${pm3}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("暂无可用模型")).toBeVisible();
    });
  });

  test.describe("ChangeTimeline", () => {
    test("empty placeholder", async ({ page }) => {
      await createTestUser(page); const ph1 = "ph1";
      await mockOne(page); await mockModel(page, ph1, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await mockHistory(page, ph1, []);
      await page.goto(url(`/novel/${ph1}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("暂无变更记录")).toBeVisible();
    });

    test("entries with restore button", async ({ page }) => {
      await createTestUser(page); const ph2 = "ph2";
      await mockOne(page); await mockModel(page, ph2, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await mockHistory(page, ph2, [
        { id:"h1", changed_at:new Date().toISOString(), old_config_name:null, new_config_name:"my OpenAI", old_model:null, new_model:"gpt-4o", change_type:"initial" },
        { id:"h2", changed_at:new Date(Date.now()-86400000).toISOString(), old_config_name:"old", new_config_name:"my OpenAI", old_model:"gpt-3.5", new_model:"gpt-4o", change_type:"switch" },
      ]);
      await page.goto(url(`/novel/${ph2}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("初始")).toBeVisible();
      await expect(page.getByRole("button", { name: "恢复此版本" }).first()).toBeVisible();
    });
  });

  test.describe("Apply to All", () => {
    test("click confirm sends request", async ({ page }) => {
      await createTestUser(page); const pa1 = "pa1";
      await mockOne(page); await mockModel(page, pa1, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await page.route("**/api/v1/projects/apply-model-to-all", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ succeeded:["p1","p2","p3"], failed:[] }) });
      });
      await page.goto(url(`/novel/${pa1}/settings`)); await page.waitForLoadState("networkidle");
      await page.getByText("应用到所有小说").click();
      await page.getByRole("button", { name: "确认应用" }).click();
      await expect(page.getByText("成功：3")).toBeVisible();
    });

    test("partial failure", async ({ page }) => {
      await createTestUser(page); const pa2 = "pa2";
      await mockOne(page); await mockModel(page, pa2, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await page.route("**/api/v1/projects/apply-model-to-all", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ succeeded:["p1"], failed:[{ id:"p2", reason:"archived" }] }) });
      });
      await page.goto(url(`/novel/${pa2}/settings`)); await page.waitForLoadState("networkidle");
      await page.getByText("应用到所有小说").click();
      await page.getByRole("button", { name: "确认应用" }).click();
      await expect(page.getByText("失败：1")).toBeVisible();
    });
  });

  test.describe("Usage", () => {
    test("global summary stat cards", async ({ page }) => {
      await createTestUser(page); await mockEmpty(page);
      await page.route("**/api/v1/api-configs/usage-summary", async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ total_all_time:150000, total_this_month:50000, total_today:3000, by_config:[], queried_at:new Date().toISOString() }) });
      });
      await page.goto(url("/config")); await page.waitForLoadState("networkidle");
      await expect(page.getByText("150,000")).toBeVisible();
    });

    test("per-novel usage breakdown", async ({ page }) => {
      await createTestUser(page); const pu1 = "pu1";
      await mockOne(page); await mockModel(page, pu1, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await page.route(`**/api/v1/projects/${pu1}/usage`, async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ total_tokens:80000, by_model:[{ model:"gpt-4o", tokens:50000 }], by_operation:[{ operation:"writing", tokens:80000 }] }) });
      });
      await page.goto(url(`/novel/${pu1}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("用量统计")).toBeVisible();
      await expect(page.getByText("80,000")).toBeVisible();
    });

    test("no usage empty state", async ({ page }) => {
      await createTestUser(page); const pu2 = "pu2";
      await mockOne(page); await mockModel(page, pu2, { api_config_id:"cfg-1", model:"gpt-4o", config_name:"my OpenAI" });
      await page.route(`**/api/v1/projects/${pu2}/usage`, async (r: any) => {
        await r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ total_tokens:0, by_model:[], by_operation:[] }) });
      });
      await page.goto(url(`/novel/${pu2}/settings`)); await page.waitForLoadState("networkidle");
      await expect(page.getByText("暂无用量数据")).toBeVisible();
    });
  });

});
