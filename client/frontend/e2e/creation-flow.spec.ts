import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page } from "@playwright/test";

// =========================================================================
// 核心创作流程 E2E — 创建小说（书名即创建）→ 设定完成判定（PRD 3.4）→ 大纲 → CRUD
// =========================================================================
// 不 mock：token 由 S端 真实签发（register + login）；设定/门控/文件走真实 C端 后端。
// 鉴权按「C端 靠 S端 OAuth」——把 S端 签发会话写入 docker 容器的 config.json
// （.docker-data/client/config.json，C端 后端 bind mount 的 DATA_ROOT）。
//
// 会话恢复：每个测试独立注册用户 + 独立写会话，测试体用 try/finally 无条件恢复
// 原始 config.json。即使断言失败（finally 仍执行）也不会污染真实登录态。
// 前置条件：docker 4 服务已启动（S端 19000 + C端 前端 5174）。

const S_API = "http://127.0.0.1:19000/api/web";
const ORIGIN = process.env.E2E_BASE_URL || "http://localhost:5174";
// docker C端 后端的 config.json（bind mount .docker-data/client → /app/data）
const CONFIG_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  ".docker-data",
  "client",
  "config.json",
);

/** 在 S端 注册并登录，返回 S端 签发的 JWT。 */
async function sRegisterAndLogin() {
  const name = `e2e_flow_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const password = "TestPass789!";
  const reg = await fetch(`${S_API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: name,
      password,
      security_question: "最喜欢的颜色",
      security_answer: "蓝色",
    }),
  });
  const regBody = await reg.json();
  if (regBody.code !== 0) {
    throw new Error(`S端 register 失败: ${JSON.stringify(regBody)}`);
  }
  const login = await fetch(`${S_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name, password }),
  });
  const loginBody = await login.json();
  if (loginBody.code !== 0) {
    throw new Error(`S端 login 失败: ${JSON.stringify(loginBody)}`);
  }
  return { token: loginBody.data.token as string, username: name };
}

/** 把 S端 会话写入 docker 容器的 config.json，返回恢复函数。 */
function writeOAuthSession(t: string, u: string) {
  const original = fs.readFileSync(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(original);
  cfg.token = t;
  cfg.username = u;
  cfg.tier = "trial"; // trial 无 project_limit，测试内可建多本
  cfg.last_login_at = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return () => fs.writeFileSync(CONFIG_PATH, original);
}

/**
 * 每测试独立会话：S端 注册登录 → 写 config.json → 注入 localStorage。
 * 返回 restore 与 token；调用方须在 try/finally 中恢复 config.json。
 */
async function setupSession(page: Page): Promise<{ restore: () => void; token: string }> {
  const { token, username } = await sRegisterAndLogin();
  const restore = writeOAuthSession(token, username);
  await page.addInitScript((t) => localStorage.setItem("auth_token", t), token);
  return { restore, token };
}

/** 通过真实 UI 创建小说（书名即创建），返回 project id。 */
async function createNovel(page: Page, name: string): Promise<string> {
  await page.goto(`${ORIGIN}/#/novels`);
  await page.getByRole("button", { name: "开始新小说" }).click();
  await page.locator("input#novel-name").fill(name);
  await page.getByRole("button", { name: "创建小说" }).click();
  await page.waitForURL(/#\/novel\/[0-9a-fA-F-]+/);
  const m = page.url().match(/\/novel\/([0-9a-fA-F-]+)/);
  if (!m) throw new Error(`无法解析 novel id: ${page.url()}`);
  return m[1];
}

// -------------------------------------------------------------------------
// 创建小说（PRD 3.1：书名即创建）
// -------------------------------------------------------------------------

test("创建小说：仅书名即可创建并进入小说页", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    await page.goto(`${ORIGIN}/#/novels`);
    await expect(page.getByRole("button", { name: "开始新小说" })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "开始新小说" }).click();
    // AC-1.4：空书名创建按钮不可用
    await expect(page.getByRole("button", { name: "创建小说" })).toBeDisabled();

    const bookName = `穿越测试${Date.now() % 10000}`;
    await page.locator("input#novel-name").fill(bookName);
    await page.getByRole("button", { name: "创建小说" }).click();

    // AC-1.6：创建成功直接进入小说页
    await page.waitForURL(/#\/novel\/[0-9a-fA-F-]+/, { timeout: 10000 });
    // 顶栏显示书名
    await expect(page.getByText(bookName).first()).toBeVisible({ timeout: 10000 });
    // AC-1.2/1.3：弹窗只有书名输入，无简介/类型/导入入口 —— 由极简弹窗本身保证
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// PRD 3.4：简介完成判定（点「完成设定」时校验内容非空）
// -------------------------------------------------------------------------

test("简介空不可完成设定，保存后可确认（AC-4.2）", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    // 项目名唯一：跨用户同名会复用同一 root_path 目录（create_project 按 slug 建目录），
    // 残留数据会串到新项目（如旧 story.yaml）。加时间戳保证每测试独立目录。
    const pid = await createNovel(page, `简介${Date.now() % 100000}`);
    await page.goto(`${ORIGIN}/#/novel/${pid}`);

    // 简介卡全局常驻
    const synCard = page.locator("#synopsis-card");
    await expect(synCard).toBeVisible({ timeout: 10000 });

    // 空简介 → 点「完成设定」→ 后端 400 → toast 中文提示，不确认
    await synCard.getByRole("button", { name: "完成设定" }).click();
    await expect(page.getByText(/该项设定还未填写内容/)).toBeVisible({ timeout: 5000 });
    await expect(synCard.getByRole("button", { name: "已设定" })).not.toBeVisible();

    // 保存简介后 → 点「完成设定」→ 确认成功（已设定）
    await synCard.locator('textarea[aria-label="故事简介"]').fill("一个穿越到明朝当海盗的故事");
    await synCard.getByRole("button", { name: "保存简介" }).click();
    await expect(page.getByText("简介已保存")).toBeVisible({ timeout: 5000 });

    await synCard.getByRole("button", { name: "完成设定" }).click();
    await expect(synCard.getByRole("button", { name: "已设定" })).toBeVisible({
      timeout: 5000,
    });
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// PRD 3.4 AC-4.3：EmptyState 软门控双选项 + 「仍然继续」旁路
// -------------------------------------------------------------------------

test("EmptyState 旁路：设定未完成可继续创作（AC-4.3）", async ({ page, request }) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `旁路${Date.now() % 100000}`);

    // 用 API 预建一卷（isNew=false），设定仍未确认 → 正文 tab 出现软门控 EmptyState
    const r = await request.post(`${ORIGIN}/api/novels/${pid}/volumes`, {
      data: { vol_num: 1, title: "第一卷" },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.ok()).toBeTruthy();

    await page.reload();
    await page.getByRole("button", { name: "正文" }).click();

    // 设定未完成 → 提示 + 双选项
    await expect(page.getByText("设定尚未全部完成")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "先去设定" })).toBeVisible();
    await expect(page.getByRole("button", { name: "直接写第一章" })).toBeVisible();

    // 「先去设定」→ 回到设定 tab
    await page.getByRole("button", { name: "先去设定" }).click();
    await expect(page.locator("#synopsis-card")).toBeVisible({ timeout: 5000 });

    // 再切正文 → 点「直接写第一章」（=「仍然继续」）→ 旁路生效，不再提示
    await page.getByRole("button", { name: "正文" }).click();
    await page.getByRole("button", { name: "直接写第一章" }).click();
    await expect(page.getByText("设定尚未全部完成")).not.toBeVisible({ timeout: 5000 });
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// CRUD：改名（顶栏就地编辑）
// -------------------------------------------------------------------------

test("改名：顶栏就地改名即时生效（AC-2.x）", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    const origName = `原始${Date.now() % 100000}`;
    await createNovel(page, origName);
    const nextName = `新名字${Date.now() % 100000}`;

    // 顶栏书名按钮（aria-label="点击修改书名"）→ 进入就地编辑
    await page.getByRole("button", { name: "点击修改书名" }).click();
    await page.locator('input[aria-label="小说书名"]').fill(nextName);
    await page.keyboard.press("Enter");

    // 页面即时反映新名
    await expect(page.getByText(nextName).first()).toBeVisible({ timeout: 5000 });
    // 旧名不再显示
    await expect(page.getByText(origName).first()).not.toBeVisible();
  } finally {
    restore();
  }
});
