import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// =========================================================================
// 设定真实表单 + 归档阅读器 E2E（补测非 AI 功能：真实表单而非 API 注入）
//   ① 题材：GenreSettingForm 真实题材选择器（空态 → 选 都市日常 → 应用题材 → 自动保存）
//   ② 写作风格：StyleSettingForm 真实表单（叙事身份 Field + 核心原则 tab ListEditor）
//   ③ AI痕迹：AntiAiSettingForm 真实表单（疲劳词分类 ListEditor）
//   ④ 角色：CharacterManager 真实创建角色（创建弹窗 → 基本信息 → 保存）
//   ⑤ 归档阅读器：正文归档 → 预览小说 → 标题搜索命中/未命中 → 阅读器内容 → 编辑回工作台
// =========================================================================
// 与 creation-flow.spec.ts 共享鉴权与设定确认手法；与 free-writing-flow.spec.ts
// 共享归档/正文工作台手法。前置条件：docker 4 服务已启动。

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
  const name = `e2e_sf_${Date.now()}_${randomUUID().slice(0, 8)}`;
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

/** 直接写第一章 → 编辑器就绪。 */
async function writeFirstChapter(page: Page) {
  await page.getByRole("button", { name: /直接写第一章/ }).click();
  const editor = page.getByPlaceholder("正文（在此撰写小说内容）");
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

/** 带 Bearer token 的 API GET 并解析 JSON。 */
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

/** 填一个表单 Field：label 文本 → 其 wrapper div 内的 textarea。 */
async function fillSettingField(page: Page, label: string, value: string) {
  const wrapper = page
    .locator("label", { hasText: label })
    .locator("xpath=ancestor::div[2]");
  await wrapper.locator("textarea").fill(value);
}

/** 点标准设定面板的「完成设定」并等待变为「已设定」。 */
async function confirmPanel(page: Page, panelTitle: string) {
  const header = page
    .locator("main h2", { hasText: panelTitle })
    .locator("xpath=ancestor::div[2]");
  const btn = header.getByRole("button", { name: "完成设定" });
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
  await expect(header.getByRole("button", { name: "已设定" })).toBeVisible({
    timeout: 5000,
  });
}

/** 点角色面板的「完成设定」（CharacterManager 底部 footer，独立实例）。 */
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

// -------------------------------------------------------------------------
// ① 题材：真实题材选择器（空态 → 都市日常 → 应用题材 → 自动保存 → 完成设定）
// -------------------------------------------------------------------------

test("题材：真实题材选择器（空态 → 选 都市日常 → 应用题材 → 自动保存）", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `题材${Date.now() % 100000}`);
    await page.getByRole("button", { name: "编辑设定" }).click();
    await openSetting(page, "题材设定");

    // 空态（未选题材）
    await expect(page.getByText("尚未选择题材")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "选择题材" }).click();

    // 选择器：默认都市系分类下点「都市日常」→ 底部出现预览 + 应用题材
    const modal = page.locator(".modal-box");
    await expect(modal.getByRole("heading", { name: "选择题材" })).toBeVisible({
      timeout: 5000,
    });
    await modal.getByText("都市日常", { exact: true }).click();
    await expect(
      modal.getByRole("button", { name: "应用题材" }),
    ).toBeVisible();

    // 应用题材 → GenreSettingForm 自动保存 PUT /settings/genre
    const genreSave = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" && r.url().includes("/settings/genre"),
    );
    await modal.getByRole("button", { name: "应用题材" }).click();
    await genreSave;

    // 题材已应用：头部显示题材名 + 已设定徽标
    await expect(page.getByText("都市日常").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("已设定").first()).toBeVisible();
    await expect(page.getByText("尚未选择题材")).toHaveCount(0);

    // 完成设定（readiness: genre_id 非空）
    await confirmPanel(page, "题材设定");

    // 后端直查
    const genre = await apiGetJSON(request, token, `/novels/${pid}/settings/genre`);
    expect(genre.genre_id).toBe("urban-daily");
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ② 写作风格：真实表单（叙事身份 Field + 核心原则 tab）→ 保存 → 完成设定
// -------------------------------------------------------------------------

test("写作风格：真实表单（叙事身份 + 核心原则 tab）→ 保存 → 完成设定", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `风格${Date.now() % 100000}`);
    await page.getByRole("button", { name: "编辑设定" }).click();
    await openSetting(page, "写作风格");

    // 叙事身份 tab（默认）：Field 文本
    await fillSettingField(page, "叙事身份", "冷静克制的第三人称叙事，短句为主");

    // 核心原则 tab：ListEditor 添加原则
    await page.getByRole("button", { name: "核心原则", exact: true }).click();
    await page.getByPlaceholder(/突然/).first().fill("动词驱动叙事，动作外化情绪");

    // 保存 → PUT /settings/style
    const styleSave = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" && r.url().includes("/settings/style"),
    );
    await page.getByRole("button", { name: "💾 保存" }).click();
    await styleSave;

    // 完成设定（readiness: role 非空）
    await confirmPanel(page, "写作风格");

    // 后端直查（merge-on-save 后 role / core_principles 落盘）
    const style = await apiGetJSON(request, token, `/novels/${pid}/settings/style`);
    expect(style.role).toContain("克制");
    // ListEditor 模板默认项 append 在 element[0] 之后 → 不能用 toContain 精确匹配元素
    expect(
      style.core_principles.some(
        (p: string) => typeof p === "string" && p.includes("动词驱动叙事"),
      ),
    ).toBe(true);
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ③ AI痕迹：真实表单（疲劳词分类 ListEditor）→ 保存 → 完成设定
// -------------------------------------------------------------------------

test("AI痕迹：真实表单（疲劳词分类列表）→ 保存 → 完成设定", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `痕迹${Date.now() % 100000}`);
    await page.getByRole("button", { name: "编辑设定" }).click();
    await openSetting(page, "AI痕迹控制");

    // 疲劳词 tab（默认）：第一个分类（总结叙事）ListEditor 填词
    await page
      .getByPlaceholder(/添加该分类下的疲劳词/)
      .first()
      .fill("似乎");

    // 保存 → PUT /settings/anti-ai
    const antiSave = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" && r.url().includes("/settings/anti-ai"),
    );
    await page.getByRole("button", { name: "💾 保存" }).click();
    await antiSave;

    // 完成设定（readiness: anti_ai 任一非空）
    await confirmPanel(page, "AI痕迹控制");

    // 后端直查：summary_narrative 分类含「似乎」
    const anti = await apiGetJSON(request, token, `/novels/${pid}/settings/anti-ai`);
    expect(anti.fatigue_words_zh.summary_narrative).toContain("似乎");
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ④ 角色：真实创建角色（创建弹窗 → 反派 → 基本信息 → 保存 → 完成设定）
// -------------------------------------------------------------------------

test("角色：真实创建角色（创建弹窗 → 基本信息 → 保存 → 完成设定）", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `角色${Date.now() % 100000}`);
    await page.getByRole("button", { name: "编辑设定" }).click();
    await openSetting(page, "角色管理");

    // 空列表
    await expect(page.getByText("暂无角色")).toBeVisible({ timeout: 10000 });

    // 创建弹窗：角色名 + 反派 role + ✦ 创建
    await page.locator("main").getByRole("button", { name: /新建/ }).click();
    await page.getByPlaceholder("角色名").fill("林晚");
    await page.getByRole("button", { name: "角色：反派" }).click();
    await page.getByRole("button", { name: "✦ 创建" }).click();

    // 基本信息 tab（默认）：外貌 + 背景
    await fillSettingField(page, "外貌", "眉眼清冷，总穿青色长衫");
    await fillSettingField(page, "背景", "边境城邦出身的孤儿，被老药师收养");

    // 保存 → PUT /settings/character/林晚（create 后的第二次 PUT）
    const charSave = page.waitForResponse(
      (r) =>
        r.request().method() === "PUT" &&
        r.url().includes("/settings/character/"),
    );
    await page.getByRole("button", { name: "💾 保存" }).click();
    await charSave;

    // 完成设定（readiness: character 文件存在）
    await confirmCharacters(page);

    // 后端直查
    const char = await apiGetJSON(
      request,
      token,
      `/novels/${pid}/settings/character/林晚`,
    );
    expect(char.name).toBe("林晚");
    expect(char.role).toBe("antagonist");
    expect(char.appearance).toContain("眉眼清冷");
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ⑤ 归档阅读器：正文归档 → 预览小说 → 搜索命中/未命中 → 阅读器 → 编辑回工作台
// -------------------------------------------------------------------------

test("归档阅读器：预览小说 → 搜索命中/未命中 → 阅读内容 → 编辑回工作台", async ({
  page,
}) => {
  // PRO(trial) 真实用户路径：直接写第一章（phase 停在 outline）→ 归档。
  // archive 端点为内容驱动（≥100 字已校验），phase 仅记账 force 置 archive，不 500。
  const { restore } = await setupSession(page, "trial");
  try {
    const pid = await createNovel(page, `归档读${Date.now() % 100000}`);
    const editor = await writeFirstChapter(page);

    await editor.fill(
      "旧城墙头的风沙穿过坍塌的垛口，林晚攥着那封匿名信，指尖发白。" +
        "信上只有一行字：她在城外的荒庙里等你。这座边境城邦与世隔绝已二十年，" +
        "谁都不愿提起城外的事。但妹妹失踪的第七天，他不能再等了。" +
        "这段内容足够长，以通过归档接口对正文长度的校验要求。",
    );
    await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 8000 });

    // 归档（window.confirm 需 accept）→ 只读 + 树 📦 同步
    page.once("dialog", (d) => d.accept());
    await page.locator("main").getByRole("button", { name: "归档" }).click();
    await expect(
      page.getByText("本章已归档，正文为只读状态").first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("aside").getByText("📦")).toBeVisible({
      timeout: 5000,
    });

    // 预览小说 → 归档页：标题 + 卷分组 + 归档章数
    await page.getByRole("button", { name: "预览小说" }).click();
    await expect(page.getByRole("heading", { name: "归档", exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("第1卷")).toBeVisible();

    // 标题搜索命中
    const search = page.getByPlaceholder("搜索章节标题...");
    await search.fill("第一章");
    await expect(page.getByRole("button", { name: "阅读" })).toBeVisible();

    // 标题搜索未命中
    await search.fill("zzz不存在的章节");
    await expect(page.getByText(/没有找到匹配/)).toBeVisible();
    await expect(page.getByRole("button", { name: "阅读" })).toHaveCount(0);

    // 清空恢复 → 阅读 → 阅读器：标题 + 正文内容 + 编辑按钮
    await search.fill("");
    await expect(page.getByRole("button", { name: "阅读" })).toBeVisible();
    await page.getByRole("button", { name: "阅读" }).click();
    await expect(page.getByRole("heading", { name: "第一章", exact: true })).toBeVisible({
      timeout: 10000,
    });
    // 阅读器正文：工作台（含只读 textarea）经 hidden 属性常驻挂载 → 页级 getByText
    // 必命中两处。reader 滚动区 className="flex-1 overflow-y-auto"，同类的编辑器/工作台
    // 容器内是 <textarea> 非 <p> → 该组合 p 唯一命中阅读器正文。
    await expect(
      page.locator(".flex-1.overflow-y-auto p", { hasText: "旧城墙头" }),
    ).toBeVisible();
    // 3 label 顶栏含「编辑设定/编辑正文」→ exact 命中阅读器「编辑」
    await expect(
      page.getByRole("button", { name: "编辑", exact: true }),
    ).toBeVisible();

    // 编辑 → 回工作台（树 + 编辑器恢复）
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await expect(page.locator("aside").getByText("第一卷")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByPlaceholder("正文（在此撰写小说内容）")).toBeVisible();
  } finally {
    restore();
  }
});

// -------------------------------------------------------------------------
// ⑧ P2-1：设定面板切换脏守卫（未保存修改 → confirm 弹窗；取消保留输入，确认才切换）
// -------------------------------------------------------------------------

test("P2-1 面板切换守卫：脏表单切换需确认，取消保留输入", async ({ page, request }) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `守卫${Date.now() % 100000}`);
    await page.getByRole("button", { name: "编辑设定" }).click();

    // 默认面板=世界设定（地理 tab），等表单加载完成
    const scene = page
      .locator("label", { hasText: "主要场景" })
      .locator("xpath=ancestor::div[2]")
      .locator("textarea");
    await expect(scene).toBeVisible({ timeout: 10000 });

    // 输入 → 脏状态
    await scene.fill("边境城邦：临海要塞，北接荒漠");

    // 取消分支：dismiss 确认框 → 面板不切换、输入保留
    let dialogShown = false;
    page.once("dialog", (d) => {
      dialogShown = true;
      void d.dismiss();
    });
    await openSetting(page, "写作风格");
    expect(dialogShown).toBe(true);
    await expect(scene).toBeVisible();
    await expect(scene).toHaveValue("边境城邦：临海要塞，北接荒漠");

    // 确认分支：接受确认框 → 面板切换
    page.once("dialog", (d) => void d.accept());
    await openSetting(page, "写作风格");
    await expect(
      page.locator("main h2", { hasText: "写作风格" }),
    ).toBeVisible({ timeout: 5000 });

    // 后端未写入任何世界设定（脏输入未保存）
    const world = await apiGetJSON(request, token, `/novels/${pid}/settings/world`);
    expect(world?.geography?.scenes ?? "").toBe("");
  } finally {
    restore();
  }
});
