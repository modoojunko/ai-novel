import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

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
//
// 设定完成判定（PRD 3.4）：7 项全确认 → /settings/status 全 true（013：断言机制
// 由 GateBanner 消失改为后端状态直查）。world/hooks 走真实表单（回归 world/hooks
// readiness checker 与前端保存结构不一致的 bug），其余 5 项 API 注入内容 + UI 点「完成设定」。

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

/**
 * 把 S端 会话写入 docker 容器的 config.json，返回恢复函数。
 * tier：trial（PRO，无 project_limit）/ none（免费，限 1 部作品）。
 */
function writeOAuthSession(t: string, u: string, tier = "trial") {
  const original = fs.readFileSync(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(original);
  cfg.token = t;
  cfg.username = u;
  cfg.tier = tier;
  cfg.last_login_at = new Date().toISOString();
  // 关键：随机 pc_hash 使 S端 check-auth 无该设备 grant（返回 code 1），useAuthHeal 不覆盖
  // config.json，注入 token 保持有效。保留真实 pc_hash 会命中 modoojunko 已授权设备 → 401。
  cfg.pc_hash = randomUUID().replace(/-/g, "");
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return () => fs.writeFileSync(CONFIG_PATH, original);
}

/**
 * 每测试独立会话：S端 注册登录 → 写 config.json → 注入 localStorage。
 * 返回 restore 与 token；调用方须在 try/finally 中恢复 config.json。
 */
async function setupSession(
  page: Page,
  tier = "trial",
): Promise<{ restore: () => void; token: string }> {
  const { token, username } = await sRegisterAndLogin();
  const restore = writeOAuthSession(token, username, tier);
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

/** 带 Bearer token 的 API PUT（docker 生产后端，走 nginx /api 前缀）。 */
async function apiPutJSON(request: APIRequestContext, token: string, path: string, data: unknown) {
  const r = await request.put(`${ORIGIN}/api${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
}

/** 带 Bearer token 的 API GET 并解析 JSON（013：settings/status 直查）。 */
async function apiGetJSON(request: APIRequestContext, token: string, path: string) {
  const r = await request.get(`${ORIGIN}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

/** 在设定左侧树点一个设定项（aside 内精确匹配，避开右侧面板标题/横幅文案）。 */
async function openSetting(page: Page, label: string) {
  await page.locator("aside").getByText(label, { exact: true }).click();
}

/**
 * 填一个设定 Field：label 文本 → 其 wrapper div 内的 textarea。
 * Field 组件结构：wrapper div > [flex div > label] + hint <p> + <textarea>。
 */
async function fillSettingField(page: Page, label: string, value: string) {
  const wrapper = page
    .locator("label", { hasText: label })
    .locator("xpath=ancestor::div[2]");
  await wrapper.locator("textarea").fill(value);
}

/**
 * 点标准设定面板（世界/伏笔/题材/风格/痕迹）的「完成设定」并等待变为「已设定」。
 * 关键：这些面板的 ConfirmToggle 是同一 React 实例（切换面板不卸载），上一次点击的
 * animating 动画（500ms「保存中…」）会残留到切换后——若直接 .last() 可能误点到 synopsis
 * 卡的按钮。因此通过面板标题 h2 定位其容器（h2 与 ConfirmToggle 同属 div.flex.justify-between），
 * 并先等目标按钮回到「完成设定」态（动画结束）再点击。
 */
async function confirmPanel(page: Page, panelTitle: string) {
  const header = page
    .locator("main h2", { hasText: panelTitle })
    .locator("xpath=ancestor::div[2]");
  const btn = header.getByRole("button", { name: "完成设定" });
  await expect(btn).toBeVisible({ timeout: 5000 }); // 等共享实例 animating 动画结束
  await btn.click();
  await expect(header.getByRole("button", { name: "已设定" })).toBeVisible({
    timeout: 5000,
  });
}

/**
 * 点角色面板的「完成设定」（CharacterManager 底部 footer，独立实例，无动画残留）。
 * 角色面板无 h2+ConfirmToggle 的标准头部，用「N 个角色」文案定位 footer。
 */
async function confirmCharacters(page: Page) {
  const footer = page
    .locator("main")
    .locator("div.flex", { hasText: /个角色/ })
    .last();
  const btn = footer.getByRole("button", { name: "完成设定" });
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await expect(footer.getByRole("button", { name: "已设定" })).toBeVisible({
    timeout: 5000,
  });
}

/** 点 synopsis 补录卡的「完成设定」并等待变为「已设定」。 */
async function confirmSynopsisCard(page: Page) {
  const card = page.locator("#synopsis-card");
  await card.getByRole("button", { name: "完成设定" }).click();
  await expect(card.getByRole("button", { name: "已设定" })).toBeVisible({
    timeout: 5000,
  });
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

    // 新落点：默认正文工作台。简介卡在设定视图内，经顶部「编辑设定」label 进入（两态共用，011）。
    await page.getByRole("button", { name: "编辑设定" }).click();

    // 简介卡全局常驻（设定视图内每面板可见）
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
// change 004：EmptyState 无门控（AC-4.3 替代）——建书即写，直接写第一章，
// 全程无「设定未完成」阶段催促（P0 断点 1 第 8 条）
// -------------------------------------------------------------------------

test("EmptyState 无门控：建书即写，直接写第一章即达编辑器", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    const pid = await createNovel(page, `直接写${Date.now() % 100000}`);

    // 落点即正文工作台（非设定页），EmptyState 三入口无门控
    await expect(page.getByText("开始写你的第一部小说")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /创建第一卷/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /直接写第一章/ })).toBeVisible();

    // 全程无阶段催促 UI（软门控已移除）
    await expect(page.getByText("设定尚未全部完成")).toHaveCount(0);
    await expect(page.getByText(/尚未完成设定/)).toHaveCount(0);

    // 「直接写第一章」→ 即达编辑器
    await page.getByRole("button", { name: /直接写第一章/ }).click();
    await expect(
      page.getByPlaceholder("正文（在此撰写小说内容）"),
    ).toBeVisible({ timeout: 10000 });
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// PRD 3.4：设定 7 项全确认 → settings-status 全 true（013：GateBanner 已移除）
// world/hooks 走真实表单（回归 checker 与前端保存结构不一致 bug）；其余 5 项
// API 注入内容 + UI 完成设定。断言每项「已设定」+ 最终 status 7 键全绿。
// -------------------------------------------------------------------------

test("设定 7 项全确认（settings-status 全绿）", async ({ page, request }) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `全确认${Date.now() % 100000}`);
    await page.goto(`${ORIGIN}/#/novel/${pid}`);

    // 013：设定未确认也不渲染「以下阶段尚未就绪」门控横幅（GateBanner 已移除）
    await expect(page.getByText(/尚未完成设定/)).toHaveCount(0);

    // 新落点：默认正文工作台。设定面板经顶部「编辑设定」label 进入（两态共用，011）。
    await page.getByRole("button", { name: "编辑设定" }).click();

    // ── world：真实表单填 ≥4 个子字段（3 地理 + 1 政治）→ 保存 → 完成设定
    await openSetting(page, "世界设定");
    await fillSettingField(page, "主要场景", "一座被沙漠包围的边境城邦");
    await fillSettingField(page, "气候", "昼夜温差极大，夜晚滴水成冰");
    await fillSettingField(page, "地理限制", "北临黑海，西侧是断崖");
    await page.getByRole("button", { name: "政治" }).click();
    await fillSettingField(page, "统治形式", "城主议会制，元老席位世袭");
    // 保存 PUT 需先落盘，完成设定的内容判定才能读到——等待响应消除竞态
    const worldSave = page.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("/settings/world"),
    );
    await page.getByRole("button", { name: "💾 保存" }).click();
    await worldSave;
    await confirmPanel(page, "世界设定");

    // ── hooks：真实表单添加伏笔 → 填描述 → 保存 → 完成设定
    // 模板自带 1 个空伏笔行 + 点「添加伏笔」新增 1 行 → 取 .first() 填默认行（readiness 只要任一非空）
    await openSetting(page, "伏笔管理");
    await page.getByRole("button", { name: /添加伏笔/ }).click();
    await page.locator('input[placeholder="伏笔描述"]').first().fill("主角妹妹失踪的真相");
    const hooksSave = page.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("/settings/hooks"),
    );
    await page.getByRole("button", { name: "💾 保存" }).click();
    await hooksSave;
    await confirmPanel(page, "伏笔管理");

    // ── synopsis：API 注入内容 + 补录卡完成设定
    await apiPutJSON(request, token, `/novels/${pid}/story`, {
      synopsis: "一个少年在边境城邦寻找妹妹失踪真相的故事",
    });
    await confirmSynopsisCard(page);

    // ── genre：API 注入 + 面板完成设定
    await apiPutJSON(request, token, `/novels/${pid}/settings/genre`, {
      genre_id: "urban-romance",
    });
    await openSetting(page, "题材设定");
    await confirmPanel(page, "题材设定");

    // ── style：API 注入 + 面板完成设定
    await apiPutJSON(request, token, `/novels/${pid}/settings/style`, {
      role: "克制冷静的第三人称叙事，短句为主",
    });
    await openSetting(page, "写作风格");
    await confirmPanel(page, "写作风格");

    // ── anti-ai：API 注入 + 面板完成设定
    await apiPutJSON(request, token, `/novels/${pid}/settings/anti-ai`, {
      blocklists: ["过度修辞", "翻译腔"],
    });
    await openSetting(page, "AI痕迹控制");
    await confirmPanel(page, "AI痕迹控制");

    // ── characters：API 注入角色文件 + 面板完成设定
    await apiPutJSON(request, token, `/novels/${pid}/settings/character/张三`, {
      name: "张三",
    });
    await openSetting(page, "角色管理");
    await confirmCharacters(page);

    // 7 项全确认 → /settings/status 全 true（PRD 3.4；013：观察点从 GateBanner 消失改为后端直查）
    const status = await apiGetJSON(request, token, `/novels/${pid}/settings/status`);
    for (const k of ["synopsis", "genre", "world", "style", "anti-ai", "hooks", "characters"]) {
      expect(status[k]).toBe(true);
    }
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
