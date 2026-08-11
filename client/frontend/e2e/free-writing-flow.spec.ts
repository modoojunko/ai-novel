import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page } from "@playwright/test";

// =========================================================================
// 免费主流程 E2E（FE-34 / TE-17，change 004）—— P0 断点 1 第 8 条纵切
//   免费 = 完整手动写作（限 1 部作品）；PRO = 同一界面 + AI 解锁。
//   覆盖：① 建书直达正文工作台可写 ② 树常驻「+新建卷/章」→ 新建第一章即达编辑器
//   ③ 树 CRUD + hover 重命名/删除 + 空章「未写」弱化 ⑤ 自动保存 + 实时字数
//   ⑥ 归档只读 + 树 📦 同步 + 免费归档不 500 ⑦ 3 label 导航（编辑设定/编辑正文/预览小说）
//   ⑧ 全程无阶段催促 UI、无 AI 字段、免费零 phase-status 请求
// =========================================================================
// 与 creation-flow.spec.ts 共享鉴权手法：S端 真实注册登录 → 写 docker 容器的
// config.json（tier="none"）→ localStorage 注入 auth_token。docker 4 服务需已启动。

const S_API = "http://127.0.0.1:19000/api/web";
const ORIGIN = process.env.E2E_BASE_URL || "http://localhost:5174";
const CONFIG_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  ".docker-data",
  "client",
  "config.json",
);

/** S端 注册并登录，返回 JWT（免费用户，套餐 none）。 */
async function sRegisterAndLogin() {
  const name = `e2e_free_${Date.now()}_${randomUUID().slice(0, 8)}`;
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

/** 免费会话：tier="none" 写入 docker config.json，返回恢复函数。 */
function writeFreeSession(t: string, u: string) {
  const original = fs.readFileSync(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(original);
  cfg.token = t;
  cfg.username = u;
  cfg.tier = "none"; // 免费：限 1 部作品，无 AI
  cfg.last_login_at = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return () => fs.writeFileSync(CONFIG_PATH, original);
}

async function setupFreeSession(page: Page): Promise<{ restore: () => void }> {
  const { token, username } = await sRegisterAndLogin();
  const restore = writeFreeSession(token, username);
  await page.addInitScript((t) => localStorage.setItem("auth_token", t), token);
  return { restore };
}

/** 通过真实 UI 创建小说（免费限 1 部，测试内仅建一本）。 */
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

/** 直接写第一章 → 编辑器就绪。 */
async function writeFirstChapter(page: Page) {
  await page.getByRole("button", { name: /直接写第一章/ }).click();
  const editor = page.getByPlaceholder("正文（在此撰写小说内容）");
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

// -------------------------------------------------------------------------
// ①⑦⑧ 免费建书直达正文工作台：无阶段催促、无 AI 字段、3 label 导航
// -------------------------------------------------------------------------

test("免费建书直达正文工作台：零 phase-status，无阶段催促，3 label 导航", async ({
  page,
}) => {
  const { restore } = await setupFreeSession(page);
  try {
    // 记录整个流程中是否出现 phase-status 请求（⑧：免费直呼 AI 端点 403 / 零阶段请求）
    const phaseReqs: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/workflow/phase-status")) phaseReqs.push(r.url());
    });

    await createNovel(page, `免费${Date.now() % 100000}`);

    // ① 落点即正文工作台（而非设定页），EmptyState 三入口
    await expect(page.getByText("开始写你的第一部小说")).toBeVisible({
      timeout: 10000,
    });
    // 免费标识
    await expect(
      page.getByText("免费 · 完整人工写作（限 1 部作品）"),
    ).toBeVisible();
    // ⑦ 3 label 纯导航（两态共用）：编辑设定 / 编辑正文 / 预览小说，无「高级配置」按钮
    await expect(page.getByRole("button", { name: "编辑设定" })).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑正文" })).toBeVisible();
    await expect(page.getByRole("button", { name: "预览小说" })).toBeVisible();
    await expect(page.getByTitle("高级配置（设定/大纲）")).toHaveCount(0);
    // ⑧ 无 PRO 阶段 tab；空项目无章 → 无章子 label「正文」
    await expect(page.getByRole("button", { name: "正文" })).toHaveCount(0);
    // ⑧ 无阶段催促 UI（GateBanner/软门控文案）
    await expect(page.getByText(/尚未完成设定/)).toHaveCount(0);
    await expect(page.getByText("设定尚未全部完成")).toHaveCount(0);
    // ⑧ 全程零 phase-status 请求
    expect(phaseReqs.length).toBe(0);

    // ⑦ 3 label 免费可进设定视图 → 经顶栏「编辑正文」返回（012：设定头部行已删）
    await page.getByRole("button", { name: "编辑设定" }).click();
    await expect(page.getByText("世界设定").first()).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("button", { name: "编辑正文" }).click();
    await expect(page.getByText("开始写你的第一部小说")).toBeVisible();
    // 全程仍零 phase-status（设定确认 refetch 免费态为 no-op）
    expect(phaseReqs.length).toBe(0);
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ①②⑤ 直接写第一章即达编辑器：实时字数 + 自动保存 + 空章「未写」弱化
// -------------------------------------------------------------------------

test("直接写第一章：即达编辑器，实时字数 + 自动保存，空章「未写」弱化", async ({
  page,
}) => {
  const { restore } = await setupFreeSession(page);
  try {
    await createNovel(page, `直写${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // ② 树常驻「+新建卷/章」；新章在树上可见（exact：避开「在卷下新建章节」）
    await expect(page.getByTitle("新建卷", { exact: true })).toBeVisible();
    await expect(page.getByTitle("新建章", { exact: true })).toBeVisible();
    const tree = page.locator("aside");
    await expect(tree.getByText("第一卷")).toBeVisible();
    await expect(tree.getByText("第一章")).toBeVisible();

    // ③ 空章「未写」弱化徽标可见（N1 不硬过滤）——点卷节点取消章选中并弹卷抽屉（011）
    await tree.getByText("第一卷").click();
    await expect(tree.getByText("未写")).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭" })).toBeVisible();

    // 关闭抽屉（Esc）→ 点回第一章 → 编辑器恢复 → ⑤ 输入实时字数 + 自动保存
    await page.keyboard.press("Escape");
    await tree.getByText("第一章").click();
    const editor = page.getByPlaceholder("正文（在此撰写小说内容）");
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.fill("你好 世界");
    await expect(page.getByText("4 字").first()).toBeVisible({ timeout: 5000 });
    // 自动保存（1.5s 防抖）→ 已保存
    await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 8000 });
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ③ 树 CRUD：双击重命名 + hover 删除（N2）
// -------------------------------------------------------------------------

test("树 CRUD：双击重命名 + 删除（N2）", async ({ page }) => {
  const { restore } = await setupFreeSession(page);
  try {
    await createNovel(page, `树${Date.now() % 100000}`);
    await writeFirstChapter(page);
    const tree = page.locator("aside");

    // 双击章名 → 行内重命名 → Enter
    await tree.getByText("第一章").dblclick();
    const renameInput = tree.locator("input");
    await renameInput.fill("改名第一章");
    await renameInput.press("Enter");
    await expect(tree.getByText("改名第一章")).toBeVisible({ timeout: 5000 });

    // hover 章节点 → 删除 → 行内确认 → 树清空回 EmptyState
    await tree.getByText("改名第一章").hover();
    await tree.getByTitle("删除").click();
    await tree.getByText("确认删除?").click();
    await expect(page.getByText("开始写你的第一部小说")).toBeVisible({
      timeout: 5000,
    });
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ⑥ 免费归档不 500 + 树 📦 即时同步（N9）
// -------------------------------------------------------------------------

test("免费归档：不 500，正文只读，树 📦 即时同步", async ({ page }) => {
  const { restore } = await setupFreeSession(page);
  try {
    await createNovel(page, `归档${Date.now() % 100000}`);
    const editor = await writeFirstChapter(page);

    await editor.fill(
      "归档的正文内容，这是一个完整的故事段落，用来验证免费归档流程不会返回 500 错误。" +
        "这个段落需要足够长，因为后端归档接口要求至少一百个字符的内容才会接受归档请求。" +
        "所以这里再补充一些叙述，确保总量超过一百字符，从而能够正常进入归档流程验证。",
    );
    await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 8000 });

    // 触发归档（window.confirm 需 accept）
    page.once("dialog", (d) => d.accept());
    await page.locator("main").getByRole("button", { name: "归档" }).click();

    // 归档成功 → 只读提示条（免费归档不 500）
    await expect(
      page.getByText("本章已归档，正文为只读状态").first(),
    ).toBeVisible({ timeout: 10000 });
    // 树 📦 即时同步（useChapterData dispatch → useWorkbench 刷新）
    await expect(page.locator("aside").getByText("📦")).toBeVisible({
      timeout: 5000,
    });
  } finally {
    restore();
  }
});
