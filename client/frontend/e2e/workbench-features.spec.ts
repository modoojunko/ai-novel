import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// =========================================================================
// 工作台非 AI 功能 E2E（补测 011，PR1/PR2 改版后适配：章页页级 tab / 卷工作台 / 聚焦 / 提示词）
//   ① 章纲：选中章 → 章页「章纲」tab → OutlineEditor 真实表单编辑 + 保存
//   ② 卷工作台（PR1 去抽屉）：点卷节点 → 主区内联卷页查看/编辑 + 保存
//   ③ 聚焦模式：专注隐藏左树 + Esc 退出
//   ④ 提示词面板：章页「提示词」tab；当前章过滤 + 空态 + API 种子后查看/编辑（非 AI 链路）
//   ⑤ 免费态三 tab 入口均可见（#152 口径：入口可见、使用需会员）
//   ⑥ PR2 默认 tab 矩阵：新章→章纲；确认·免费→正文；确认·付费→提示词；有正文→正文
//      （付费信号 /auth/devices/current 路由打桩）+ 右栏章信息/前后章导航
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
  await page.getByRole("button", { name: "开始新小说" }).click();
  await page.locator("input#novel-name").fill(name);
  await page.getByRole("button", { name: "创建小说" }).click();
  await page.waitForURL(/#\/novel\/[0-9a-fA-F-]+/);
  const m = page.url().match(/\/novel\/([0-9a-fA-F-]+)/);
  if (!m) throw new Error(`无法解析 novel id: ${page.url()}`);
  return m[1];
}

/** 直接写第一章（弹窗版）→ 编辑器就绪（选中章 → 章页页级 tab 章纲/提示词/正文，PR2）。
 *  无卷先弹「新建卷」（链式）再弹「新建章」，名称必填即标题。
 *  填默认形态名称（第一卷/第一章）→ 树上显示与旧默认标题一致，下游断言不动。
 *  PR2：新章默认落「章纲」tab（按进度推进）→ 点「正文」tab 进编辑器。 */
async function writeFirstChapter(page: Page) {
  await page.getByRole("button", { name: /直接写第一章/ }).click();
  const volName = page.getByLabel("卷名");
  await expect(volName).toBeVisible({ timeout: 5000 });
  await volName.fill("第一卷");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  const chName = page.getByLabel("章名");
  await expect(chName).toBeVisible({ timeout: 5000 });
  await chName.fill("第一章");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await page.getByRole("button", { name: "正文", exact: true }).click();
  const editor = page.getByPlaceholder("正文（在此撰写小说内容）");
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

/** 填一个表单 Field：label 文本 → 其 wrapper div 内的 textarea。 */
async function fillSettingField(page: Page, label: string, value: string) {
  const wrapper = page
    .locator("label", { hasText: label })
    .locator("xpath=ancestor::div[2]");
  await wrapper.locator("textarea").fill(value);
}

// -------------------------------------------------------------------------
// ① 章纲：OutlineEditor 真实表单（tab 切换 + 关键事件 + 主情绪）→ 保存
// -------------------------------------------------------------------------

test("章纲：OutlineEditor 真实表单编辑 + 保存（tab 切换 + 列表项 + 主情绪）", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `章纲${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 进入章页「章纲」tab
    await page.getByRole("button", { name: "章纲" }).click();
    await expect(page.getByText(/细化章节细纲/)).toBeVisible({ timeout: 10000 });

    // 章纲概要 tab（默认）：填概要 + 关键事件列表
    await fillSettingField(page, "章纲概要", "主角在边境城邦发现妹妹失踪的线索");
    // 新章 key_points 为空数组 → ListEditor 渲染零输入行 → 先「添加一项」
    const keyEvents = page
      .locator("label", { hasText: "关键事件" })
      .locator("xpath=ancestor::div[1]");
    await keyEvents.getByRole("button", { name: "添加一项" }).click();
    await keyEvents.getByPlaceholder("一个关键事件").first().fill("收到匿名信");

    // 核心任务 tab：填核心任务
    await page.getByRole("button", { name: "核心任务", exact: true }).click();
    await fillSettingField(page, "核心任务", "查明妹妹失踪的真相");

    // 情绪设计 tab：选主情绪（作用域到含「悬疑」option 的 select）
    await page.getByRole("button", { name: "情绪设计", exact: true }).click();
    await page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "悬疑" }) })
      .selectOption({ label: "悬疑" });

    // 手动保存 → PUT /chapters/vol-1-ch-1 落盘
    const save = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().includes(`/chapters/vol-1-ch-1`),
    );
    await page.getByRole("button", { name: "💾 保存" }).click();
    await save;
    await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 5000 });

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
// ② 卷工作台（PR1 去抽屉）：点卷节点 → 主区内联卷页查看/编辑 + 保存
// -------------------------------------------------------------------------

test("卷工作台：点卷节点 → 内联卷页查看态 → 编辑卷名/简述 → 保存", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `卷页${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 点卷节点 → 主区变卷工作台页（无抽屉弹层）；默认查看态 + [✎ 编辑] 入口
    await page.locator("aside").getByText("第一卷").click();
    await expect(page.getByText("卷故事简述")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("本卷章节")).toBeVisible();
    await expect(page.locator('aside[class*="w-[400px]"]')).toHaveCount(0);
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
    await expect(
      page.getByRole("heading", { name: "第一卷·风起" }),
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
// ③ 聚焦模式：专注隐藏左树 + Esc 退出
// -------------------------------------------------------------------------

test("聚焦模式：专注隐藏左树 + Esc 退出", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    await createNovel(page, `聚焦${Date.now() % 100000}`);
    await writeFirstChapter(page);

    // 初始左树可见
    await expect(page.locator("aside").getByText("第一卷")).toBeVisible();

    // 专注 → 左树（新建卷/章）卸载，按钮变「退出专注」
    await page.getByRole("button", { name: "专注", exact: true }).click();
    await expect(page.getByTitle("新建卷")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "退出专注", exact: true })).toBeVisible();

    // Esc → 退出专注，左树恢复
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "专注", exact: true })).toBeVisible();
    await expect(page.locator("aside").getByText("第一卷")).toBeVisible();
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

    // 进入章页「提示词」tab → 当前章自动展开，显示种子段落
    await page.getByRole("button", { name: "提示词" }).click();
    await expect(page.getByText("提示词管理")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("段落 1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("1 段")).toBeVisible();

    // 查看 → 内容可见
    await page.getByText("段落 1").click();
    await expect(page.getByText("描写主角收到匿名信的场景。")).toBeVisible({
      timeout: 5000,
    });

    // 编辑 → 修改 → 保存 → 已修改
    // （3 label 顶栏含「编辑设定/编辑正文」→ 必须 exact 命中提示词编辑器「编辑」）
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

    // 点「提示词」tab：prompts 端点 503 → 就地提示（而非 503 全局跳 /config）
    await page.getByRole("button", { name: "提示词" }).click();
    await expect(page.getByText("尚未配置大模型 API Key")).toBeVisible({
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
// ⑤ 免费态三 label 入口均可见（#152 口径：入口可见、使用需会员，后端拦截）
// -------------------------------------------------------------------------

test("免费态：正文/章纲/提示词入口均可见（#152 入口可见口径）", async ({
  page,
}) => {
  const { restore } = await setupSession(page, "none");
  try {
    await createNovel(page, `免费提示词${Date.now() % 100000}`);
    await writeFirstChapter(page);

    await expect(page.getByRole("button", { name: "正文", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "章纲" })).toBeVisible();
    // 提示词不再 TierGate 隐藏——免费可见入口，点击使用时由后端 member_required 拦截
    await expect(page.getByRole("button", { name: "提示词" })).toBeVisible();
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ⑥ PR2 默认 tab 矩阵：新章→章纲；已确认·免费→正文；已确认·付费→提示词；有正文→正文
// -------------------------------------------------------------------------

test("默认tab矩阵：按进度推进 + 付费分流 + 章信息/前后章导航", async ({
  page,
  request,
}) => {
  // 付费分流读 activated（设备激活），与会员 tier 是两个信号。为避免「免费 token +
  // activated 打桩」的矛盾组合在行③落提示词 tab 时触发 member_required 弹窗（真实
  // 付费用户必是会员），本用例用 trial 会员 + 注入 ApiConfig：prompts 探测/提示词页
  // 均返回 200 空列表，弹窗与 503 跳转都不发生；免费行为由 activated=false 打桩表达。
  const { restore, token } = await setupSession(page);
  try {
    await ensurePromptAccess(request, token);

    // 付费信号打桩：默认 tab 的提示词/正文分流读 /auth/devices/current（C端 后端
    // 代理真 S端 设备态，e2e 随机 pc_hash 恒为 activated=false）→ 拦截按需返回
    let activatedStub = false;
    await page.route("**/api/auth/devices/current", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          enrolled: true,
          activated: activatedStub,
          device_count: 1,
          active_limit: 3,
        }),
      }),
    );

    const pid = await createNovel(page, `矩阵${Date.now() % 100000}`);

    // 建卷+章后停在新章默认落点（不走 writeFirstChapter——它点正文）
    await page.getByRole("button", { name: /直接写第一章/ }).click();
    const volName = page.getByLabel("卷名");
    await expect(volName).toBeVisible({ timeout: 5000 });
    await volName.fill("第一卷");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    const chName = page.getByLabel("章名");
    await expect(chName).toBeVisible({ timeout: 5000 });
    await chName.fill("第一章");
    await page.getByRole("button", { name: "创建", exact: true }).click();

    // 页级 tab 激活态 = bg-base-300（TabProgressButton active 样式）
    const tabBtn = (label: string) =>
      page.getByRole("button", { name: label, exact: true });

    // 行①：新章（未确认/无提示词/无正文）→ 章纲
    await expect(tabBtn("章纲")).toHaveClass(/bg-base-300/, { timeout: 10000 });
    await expect(page.getByText(/细化章节细纲/)).toBeVisible();

    // API 备好过 gate 的章纲（核心任务/读者状态/预期策略/必须变化/主情绪/段落规划）→ 完成设定
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

    // 章页重挂载（卷↔章切换）→ 默认 tab 重新按进度计算
    const tree = page.getByTestId("workbench-tree");
    const remount = async () => {
      await tree.getByText("第一卷").click();
      await expect(page.getByText("卷故事简述")).toBeVisible({ timeout: 5000 });
      await tree.getByText("第一章").click();
      await expect(page.getByText(/第1卷 · 本卷第1章/)).toBeVisible({
        timeout: 5000,
      });
    };

    // 行②：已确认 + 免费（activated=false）→ 正文；提示词入口仍可见
    await remount();
    await expect(tabBtn("正文")).toHaveClass(/bg-base-300/, { timeout: 10000 });
    await expect(tabBtn("提示词")).toBeVisible();

    // 行③：已确认 + 付费（activated=true）→ 提示词
    activatedStub = true;
    await remount();
    await expect(tabBtn("提示词")).toHaveClass(/bg-base-300/, {
      timeout: 10000,
    });

    // 行④：已有正文 → 正文（优先级高于确认+付费）
    const prose = await request.put(
      `${ORIGIN}/api/novels/${pid}/chapters/vol-1-ch-1/prose`,
      {
        data: { prose: "旧城墙头的风沙穿过坍塌的垛口，林晚攥着那封匿名信。" },
        headers: auth,
      },
    );
    expect(prose.ok()).toBeTruthy();
    await remount();
    await expect(tabBtn("正文")).toHaveClass(/bg-base-300/, { timeout: 10000 });

    // 右栏章信息（PR2）：状态/字数/位置 + 前后章导航（单章两者禁用）
    await expect(page.getByText("章信息", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "上一章" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "下一章" }),
    ).toBeDisabled();
  } finally {
    restore();
  }
});
