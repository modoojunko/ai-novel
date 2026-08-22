import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// =========================================================================
// 工作台非 AI 功能 E2E（PR3 book.html 复刻后适配：章对象三页签 / 卷工作台 / 专注 / 提示词）
//   ① 章纲：选中章 →「章纲」页签 → OgPane 平面全字段表单编辑 + 保存草稿
//   ② 卷工作台（过渡期 VolumePage）：点卷节点 → 主区内联卷页查看/编辑 + 保存
//   ③ 专注模式：body.focus 隐藏左树右栏 + Esc 退出
//   ④ 提示词面板：「提示词」页签；当前章过滤 + 空态 + API 种子后查看/编辑（非 AI 链路）
//   ⑤ 免费态三页签入口均可见（#152 口径：入口可见、使用需会员）
//   ⑥ PR3 行为：点章恒落「章纲」页签（设计稿拍板，取代 PR2 按进度分流）+ 右栏本章进度卡
// =========================================================================
// 与 creation-flow.spec.ts 共享鉴权手法：S端 真实注册登录 → 写 docker 容器的
// config.json（tier="trial" 为 PRO）→ localStorage 注入 auth_token。
// 提示词后端接口经 require_ai_access 门控（需存在 active ApiConfig）：
// ④ 内先 POST /api/v1/api-configs 注入假配置（仅过门控，不测真实连接）。

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

/** S端 注册并登录，返回 JWT（免费用户，套餐 none）。 */
async function sRegisterAndLogin() {
  const name = `e2e_wb_${Date.now()}_${randomUUID().slice(0, 8)}`;
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

/** 把 S端 会话写入 config.json，返回恢复函数。tier：trial（PRO）/ none（免费）。 */
function writeOAuthSession(t: string, u: string, tier = "trial") {
  const original = fs.readFileSync(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(original);
  cfg.token = t;
  cfg.username = u;
  cfg.tier = tier;
  // docker config.json 可能残留已过去的会员到期日（auth middleware 见 expires_at
  // 过期即 401「登录已过期」），注入会话必须清掉，否则全部用例秒挂
  delete cfg.expires_at;
  cfg.last_login_at = new Date().toISOString();
  // 关键：随机 pc_hash 使 S端 check-auth 无该设备 grant（返回 code 1），useAuthHeal 不覆盖
  // config.json，注入 token 保持有效。保留真实 pc_hash 会命中 modoojunko 已授权设备 → 401。
  cfg.pc_hash = randomUUID().replace(/-/g, "");
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return () => fs.writeFileSync(CONFIG_PATH, original);
}

/** 每测试独立会话：S端 注册登录 → 写 config.json → 注入 localStorage。 */
async function setupSession(
  page: Page,
  tier = "trial",
): Promise<{ restore: () => void; token: string }> {
  const { token, username } = await sRegisterAndLogin();
  const restore = writeOAuthSession(token, username, tier);
  await page.addInitScript((t) => localStorage.setItem("auth_token", t), token);
  return { restore, token };
}

/** 通过真实 UI 创建小说，返回 project id。 */
async function createNovel(page: Page, name: string): Promise<string> {
  await page.goto(`${ORIGIN}/#/novels`);
  await page.getByRole("button", { name: "新建作品" }).first().click();
  await page.locator("input#bkTitle").fill(name);
  await page.getByRole("button", { name: "创建并开始写作" }).click();
  await page.waitForURL(/#\/novel\/[0-9a-fA-F-]+/);
  const m = page.url().match(/\/novel\/([0-9a-fA-F-]+)/);
  if (!m) throw new Error(`无法解析 novel id: ${page.url()}`);
  return m[1];
}

/** 加卷 + 初始 1 章 → 点章 → 切「正文」→ 编辑器就绪（PR3：添加卷弹窗 + 点章强制落章纲）。 */
async function writeFirstChapter(page: Page) {
  await page.getByTitle("添加卷").click();
  await page.getByLabel("卷名", { exact: true }).fill("第一卷");
  await page.getByLabel(/初始章数/).fill("1");
  await page.getByRole("button", { name: "创建卷" }).click();
  const chRow = page.locator(".col-tree .ch", { hasText: "第一章" });
  await expect(chRow).toBeVisible({ timeout: 10000 });
  await chRow.click();
  await expect(page.getByRole("tab", { name: /^章纲/ })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("tab", { name: /^正文/ }).click();
  const editor = page.locator(".editor");
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

/** 带 Bearer token 的 API GET。 */
async function apiGetJSON(request: APIRequestContext, token: string, path: string) {
  const r = await request.get(`${ORIGIN}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

/** 注入一条 active ApiConfig，使 require_ai_access 门控放行（不测真实连接）。 */
async function ensurePromptAccess(request: APIRequestContext, token: string) {
  const r = await request.post(`${ORIGIN}/api/v1/api-configs`, {
    data: {
      name: `e2e-prompt-${Date.now()}`,
      vendor_id: "openai-compat",
      base_url: "http://127.0.0.1:1",
      api_key: "sk-e2e-not-real",
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
}

// -------------------------------------------------------------------------
// ① 章纲：OgPane 平面全字段表单（概要/关键事件/核心任务/主情绪）→ 保存草稿
// -------------------------------------------------------------------------

test("章纲：OgPane 真实表单编辑 + 保存草稿（概要/关键事件/核心任务/主情绪）", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `章纲${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 回「章纲」页签（writeFirstChapter 停在正文）：平面全字段表单 + 必填缺口 chip
    await page.getByRole("tab", { name: /^章纲/ }).click();
    await expect(
      page.getByText(/章纲：明确「这一章写什么」/),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".gap-chip").first()).toBeVisible();

    // 填 4 个代表字段（概要 / 关键事件列表 / 核心任务 / 主情绪选择）
    await page.locator("#wf-summary").fill("主角在边境城邦发现妹妹失踪的线索");
    await page.locator("#wf-keys").fill("收到匿名信");
    await page.locator("#wf-task").fill("查明妹妹失踪的真相");
    await page.locator("#wf-mood select").selectOption({ label: "悬疑" });

    // 保存草稿 → PUT /chapters/vol-1-ch-1 落盘（仍有必填缺口 → 不自动确认）
    const save = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().includes(`/chapters/vol-1-ch-1`),
    );
    await page.getByRole("button", { name: "保存草稿" }).click();
    await save;
    await expect(page.getByText("草稿已保存")).toBeVisible({ timeout: 5000 });

    // 后端直查：outline / memo / emotional_design 均已落盘
    const ch = await apiGetJSON(request, token, `/novels/${pid}/chapters/vol-1-ch-1`);
    expect(ch.outline.summary).toContain("妹妹失踪");
    expect(ch.outline.key_points).toContain("收到匿名信");
    expect(ch.memo.current_task).toContain("真相");
    expect(ch.emotional_design.primary_mood).toBe("悬疑");
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ② 卷工作台（过渡期 VolumePage）：点卷节点 → 主区内联卷页查看/编辑 + 保存
// -------------------------------------------------------------------------

test("卷工作台：点卷节点 → 内联卷页查看态 → 编辑卷名/简述 → 保存", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `卷页${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 点卷头 → 主区变卷工作台页（内联，非弹层）；默认查看态 + [编辑] 入口
    await page.locator(".col-tree .vol-head", { hasText: "第一卷" }).click();
    await expect(page.getByText("卷故事简述")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("本卷章节")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "编辑", exact: true }),
    ).toBeVisible();

    // 点「编辑」进入编辑态：卷名 + 卷简述
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await page.getByPlaceholder("卷名").fill("第一卷·风起");
    await page
      .getByPlaceholder("一段话讲清本卷讲什么")
      .fill("第一卷铺垫主角妹妹失踪的悬念，收尾进入边城。");

    // 保存 → PUT /volumes/vol-1 → 回查看态，标题已更新
    const volSave = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().includes("/volumes/vol-1"),
    );
    await page.getByRole("button", { name: /保存/ }).click();
    await volSave;
    // 标题展示走 nodeLabel 口径（#164）：序号 · 名称
    await expect(
      page.getByRole("heading", { name: "第一卷 · 第一卷·风起" }),
    ).toBeVisible({ timeout: 5000 });

    // 后端直查
    const vol = await apiGetJSON(request, token, `/novels/${pid}/volumes/vol-1`);
    expect(vol.title).toBe("第一卷·风起");
    expect(vol.summary).toContain("妹妹失踪");
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ③ 专注模式：body.focus 隐藏左树右栏 + Esc 退出
// -------------------------------------------------------------------------

test("专注模式：隐藏左树右栏 + Esc 退出", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    await createNovel(page, `聚焦${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 初始左树/右栏均可见
    const tree = page.locator(".col-tree");
    const rail = page.locator(".col-ai");
    await expect(tree).toBeVisible();
    await expect(rail).toBeVisible();

    // 专注（工具栏 icon，title 恒为「专注模式」）→ body.focus 隐藏左树右栏
    await page.getByTitle("专注模式").click();
    await expect(tree).toBeHidden({ timeout: 5000 });
    await expect(rail).toBeHidden();

    // Esc → 退出专注，左树右栏恢复
    await page.keyboard.press("Escape");
    await expect(tree).toBeVisible();
    await expect(rail).toBeVisible();
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ④ 提示词面板：当前章过滤 + API 种子后查看/编辑/已修改徽标（非 AI 链路）
// -------------------------------------------------------------------------

test("提示词面板：当前章过滤 + 种子提示词查看/编辑/已修改徽标", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `提示词${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 提示词后端接口需过 require_ai_access 门控：先注入 active ApiConfig（不测连接）
    await ensurePromptAccess(request, token);

    // API 种子 seg-1 提示词（手动保存路径，非 AI 生成）
    const seed = await request.put(
      `${ORIGIN}/api/novels/${pid}/chapters/vol-1-ch-1/prompts/seg-1`,
      {
        data: { content: "# 段落任务\n\n描写主角收到匿名信的场景。" },
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(seed.ok()).toBeTruthy();

    // 切到章「提示词」页签 → 当前章自动展开，显示种子段落
    await page.getByRole("tab", { name: /^提示词/ }).click();
    await expect(page.getByText("提示词管理")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("段落 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("1 段")).toBeVisible();

    // 查看 → 内容可见
    await page.getByText("段落 1").click();
    await expect(page.getByText("描写主角收到匿名信的场景。")).toBeVisible({
      timeout: 5000,
    });

    // 编辑 → 修改 → 保存 → 已修改
    // （章页签含「章纲/正文」文案 → 必须 exact 命中提示词编辑器「编辑」）
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await page.locator("textarea").last().fill("# 段落任务\n\n描写主角收到匿名信后追出城门的场景。");
    const save = page.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("/prompts/seg-1"),
    );
    await page.locator("main").getByRole("button", { name: "保存", exact: true }).click();
    await save;
    await expect(page.getByText("保存成功")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "恢复原始" })).toBeVisible();

    // 返回概览 → 章节徽标「已修改」
    await page.getByRole("button", { name: "返回" }).click();
    await expect(page.getByText("已修改").first()).toBeVisible({ timeout: 5000 });
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ④b 未配 API Key（trial 会员）：点提示词 tab 就地提示去配置，不整页跳 /config
// -------------------------------------------------------------------------

test("提示词无Key：进入提示词tab就地提示去配置，不整页跳转", async ({
  page,
}) => {
  const { restore } = await setupSession(page); // trial 会员但未注入 ApiConfig
  try {
    await createNovel(page, `无Key提示词${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 点「提示词」页签：prompts 端点 503 → 就地提示（而非 503 全局跳 /config）
    await page.getByRole("tab", { name: /^提示词/ }).click();
    await expect(page.getByText("尚未配置模型 API Key")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("link", { name: "去配置" })).toBeVisible();

    // 关键回归断言：仍留在章页
    await expect(page).toHaveURL(/#\/novel\//);

    // 「去配置」为用户主动导航 → 可达配置页
    await page.getByRole("link", { name: "去配置" }).click();
    await expect(page).toHaveURL(/#\/config/);
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ⑤ 免费态三页签入口均可见（#152 口径：入口可见、使用需会员，后端拦截）
// -------------------------------------------------------------------------

test("免费态：正文/章纲/提示词入口均可见（#152 入口可见口径）", async ({
  page,
}) => {
  const { restore } = await setupSession(page, "none");
  try {
    await createNovel(page, `免费提示词${Date.now() % 100000}`);
    await writeFirstChapter(page);

    await expect(page.getByRole("tab", { name: /^正文/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^章纲/ })).toBeVisible();
    // 提示词不再 TierGate 隐藏——免费可见入口，点击使用时由后端 member_required 拦截
    await expect(page.getByRole("tab", { name: /^提示词/ })).toBeVisible();
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ⑥ PR3 行为：点章恒落「章纲」页签（设计稿拍板，取代 PR2 按进度/付费分流）
//    + 右栏 Rail 本章进度卡（大百分数 / 目标字数 / mini 统计）
// -------------------------------------------------------------------------

test("点章强制落章纲：确认/有正文后重挂载仍落章纲 + 右栏本章进度卡", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `矩阵${Date.now() % 100000}`);

    // 建卷 + 初始 1 章（停在默认落点「章纲」页签）
    await page.getByTitle("添加卷").click();
    await page.getByLabel("卷名", { exact: true }).fill("第一卷");
    await page.getByLabel(/初始章数/).fill("1");
    await page.getByRole("button", { name: "创建卷" }).click();
    const chRow = page.locator(".col-tree .ch", { hasText: "第一章" });
    await expect(chRow).toBeVisible({ timeout: 10000 });

    // 行①：新章（未确认/无提示词/无正文）→ 章纲选中
    await chRow.click();
    const ogTab = page.getByRole("tab", { name: /^章纲/ });
    await expect(ogTab).toBeVisible({ timeout: 10000 });
    await expect(ogTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/章纲：明确「这一章写什么」/)).toBeVisible();

    // API 备齐必填（核心任务/读者状态/预期策略/必须变化/主情绪/段落规划）→ 确认
    const auth = { Authorization: `Bearer ${token}` };
    const ready = (await apiGetJSON(
      request,
      token,
      `/novels/${pid}/chapters/vol-1-ch-1`,
    )) as Record<string, unknown>;
    ready.memo = {
      current_task: "查明妹妹失踪的真相",
      reader_expectation: {
        state: "担忧妹妹安危",
        strategy: "抛出线索钩子",
        detail: "",
      },
      required_changes: ["找到匿名信的来源"],
    };
    ready.emotional_design = { primary_mood: "悬疑" };
    ready.segments = [{ summary: "城门口收到匿名信", target_words: 1000 }];
    const put = await request.put(
      `${ORIGIN}/api/novels/${pid}/chapters/vol-1-ch-1`,
      { data: ready, headers: auth },
    );
    expect(put.ok()).toBeTruthy();
    const confirm = await request.post(
      `${ORIGIN}/api/novels/${pid}/chapters/vol-1-ch-1/confirm`,
      { headers: auth },
    );
    expect(confirm.ok()).toBeTruthy();

    // 章工作台重挂载（卷↔章切换）：行②已确认 → 仍落章纲；页签徽标「已确认」
    const tree = page.locator(".col-tree");
    const remount = async () => {
      await tree.locator(".vol-head", { hasText: "第一卷" }).click();
      await expect(page.getByText("卷故事简述")).toBeVisible({ timeout: 5000 });
      await tree.locator(".ch", { hasText: "第一章" }).click();
      await expect(ogTab).toBeVisible({ timeout: 10000 });
    };
    await remount();
    await expect(ogTab).toHaveAttribute("aria-selected", "true", { timeout: 5000 });
    await expect(
      page.locator(".chtab.on", { hasText: "章纲" }).getByText("已确认"),
    ).toBeVisible({ timeout: 5000 });

    // 行③：已有正文 → 重挂载仍落章纲（不再按进度跳正文）
    const prose = await request.put(
      `${ORIGIN}/api/novels/${pid}/chapters/vol-1-ch-1/prose`,
      {
        data: { prose: "旧城墙头的风沙穿过坍塌的垛口，林晚攥着那封匿名信。" },
        headers: auth,
      },
    );
    expect(prose.ok()).toBeTruthy();
    await remount();
    await expect(ogTab).toHaveAttribute("aria-selected", "true", { timeout: 5000 });

    // 右栏 Rail（PR3）：本章进度卡 + 目标字数 + mini 统计
    await expect(page.getByText("本章进度", { exact: true })).toBeVisible();
    await expect(page.getByText("目标字数", { exact: true })).toBeVisible();
    await expect(page.getByText("本书总字数")).toBeVisible();
    await expect(page.getByText("本章草稿")).toBeVisible();
  } finally {
    restore();
  }
});
