import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { test, expect, type Page, type APIRequestContext, type Dialog } from "@playwright/test";

// =========================================================================
// 设定真实表单 + 归档阅读器 E2E（补测非 AI 功能：真实表单而非 API 注入）
//   ① 题材：GenreSettingForm 真实题材选择器（空态 → 选 都市日常 → 应用题材 → 自动保存）
//   ② 写作风格：StyleSettingForm 真实表单（叙事身份 Field + 核心原则 tab ListEditor）
//   ③ AI痕迹：AntiAiSettingForm 真实表单（疲劳词分类 ListEditor）
//   ④ 角色：CharacterManager 真实创建角色（创建弹窗 → 基本信息 → 保存）
//   ⑤ 归档阅读器（纯阅读布局）：正文归档 → 预览小说左树卷章结构 → 默认定档/
//      最近阅读恢复 → 搜索 → 前后章 → 编辑正文回工作台 → 恢复编辑（归档管理迁至正文编辑页）
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

/** 带 Bearer token 的 API GET 并解析 JSON。 */
async function apiGetJSON(request: APIRequestContext, token: string, path: string) {
  const r = await request.get(`${ORIGIN}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

/** 带 Bearer token 的 API POST 并解析 JSON。 */
async function apiPostJSON(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
) {
  const r = await request.post(`${ORIGIN}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(
    r.ok(),
    `${path} → ${r.status()}: ${r.status() >= 400 ? await r.text() : ""}`,
  ).toBeTruthy();
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
    await page.getByRole("button", { name: /^设定/ }).click();
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
    await page.getByRole("button", { name: /^设定/ }).click();
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
    await page.getByRole("button", { name: /^设定/ }).click();
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
    await page.getByRole("button", { name: /^设定/ }).click();
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
// ⑤ 归档阅读器（纯阅读布局）：左树卷章结构 + 阅读区 + 恢复编辑迁至正文编辑页
// -------------------------------------------------------------------------

test("归档阅读器：左树卷章 → 默认/最近阅读定档 → 搜索 → 恢复编辑回工作台", async ({
  page,
  request,
}) => {
  // PRO(trial) 真实用户路径：直接写第一章（phase 停在 outline）→ 归档。
  // archive 端点为内容驱动（≥100 字已校验），phase 仅记账 force 置 archive，不 500。
  const { restore, token } = await setupSession(page, "trial");
  try {
    const pid = await createNovel(page, `归档读${Date.now() % 100000}`);
    const editor = await writeFirstChapter(page);

    await editor.fill(
      "旧城墙头的风沙穿过坍塌的垛口，林晚攥着那封匿名信，指尖发白。" +
        "信上只有一行字：她在城外的荒庙里等你。这座边境城邦与世隔绝已二十年，" +
        "谁都不愿提起城外的事。但妹妹失踪的第七天，他不能再等了。" +
        "这段内容足够长，以通过归档接口对正文长度的校验要求。",
    );
    await expect(page.getByText("已自动保存").first()).toBeVisible({ timeout: 8000 });

    // API 备料：第二章直接 API 归档（阅读顺序/最近阅读用，ai_summary=false 不烧 AI），
    // 第三章仅建章不归档（左树「未归档」灰显用）。须先于 UI 归档——归档事件会
    // 触发 wb.refresh，卷章列表一次拉全三章。
    await apiPostJSON(request, token, `/novels/${pid}/volumes/vol-1/chapters`, {
      title: "风起渡口",
    });
    await apiPostJSON(
      request,
      token,
      `/novels/${pid}/chapters/vol-1-ch-2/archive`,
      {
        full_text:
          "渡口的雾还没散尽，船家已经解开了缆绳。林晚把那封匿名信折好收进怀里，" +
            "回头望了一眼雾中的城墙。船身随浪晃动，她攥紧了船舷的木栏。" +
            "这一去便再无退路，荒庙里的答案，值得她赌上一切去换。" +
            "这段内容同样足够长，以满足归档接口对正文长度的校验要求，避免四百错误。",
        ai_summary: false,
      },
    );
    await apiPostJSON(request, token, `/novels/${pid}/volumes/vol-1/chapters`, {
      title: "雾中城",
    });

    // 归档第一章 → 只读 + 树「已归档」同步。trial 会员首次归档连弹两个 confirm
    // （#152：AI 摘要额度提示 + 确认归档），免费档只有后者——接受步骤内全部 dialog
    const onDlg = (d: Dialog) => d.accept();
    page.on("dialog", onDlg);
    await page.getByRole("button", { name: "归档本章" }).click();
    try {
      await expect(page.getByText(/本章已归档 · 只读/).first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      page.off("dialog", onDlg);
    }
    // 树「已归档」即时同步：第一章（UI 归档）+ 第二章（API 备料归档）共 2 枚
    await expect(page.locator(".col-tree .arch-tag")).toHaveCount(2, {
      timeout: 5000,
    });

    // 预览小说 → 纯阅读布局：默认定档第一个已归档章（首次进入，无 localStorage）
    await page.getByRole("button", { name: "预览", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "第一章", exact: true }),
    ).toBeVisible({ timeout: 10000 });
    // 阅读器正文：工作台在预览态常驻挂载（hidden），PR2 归档章只读渲染同为
    // p + flex-1.overflow-y-auto 容器 → 加 :visible 限定当前展示的阅读器正文
    await expect(
      page.locator(".flex-1.overflow-y-auto p:visible", { hasText: "旧城墙头" }),
    ).toBeVisible();

    // 左树：全部卷章结构（2/3 已归档）；未归档章灰显「未归档」
    const tree = page.getByTestId("preview-tree");
    await expect(tree.getByText("2/3")).toBeVisible({ timeout: 10000 });
    await expect(tree.getByText("未归档")).toBeVisible();

    // 点第二章 → 阅读区切换（前后章走已归档章全书顺序，未归档不可点）
    await tree.getByRole("button", { name: /第2章 风起渡口/ }).click();
    await expect(page.getByRole("heading", { name: "风起渡口" })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator(".flex-1.overflow-y-auto p:visible", { hasText: "渡口的雾" }),
    ).toBeVisible();

    // 最近阅读恢复（localStorage 持久化）：离开预览 → 重进（懒挂载重挂）→ 仍停在第二章
    await page.getByRole("button", { name: /^写作/ }).click();
    await page.getByRole("button", { name: "预览", exact: true }).click();
    await expect(page.getByRole("heading", { name: "风起渡口" })).toBeVisible({
      timeout: 10000,
    });

    // 前后章导航：上一章回第一章；首章上一章禁用
    await page.getByRole("button", { name: "◀ 上一章" }).click();
    await expect(
      page.getByRole("heading", { name: "第一章", exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "◀ 上一章" })).toBeDisabled();

    // 标题搜索：命中未归档章（仍灰显不可读）；未命中空态
    const search = page.getByPlaceholder("搜索章节标题...");
    await search.fill("雾中城");
    await expect(tree.getByText(/第3章 雾中城/)).toBeVisible();
    await expect(tree.getByRole("button", { name: /第1章/ })).toHaveCount(0);
    await search.fill("zzz不存在的章节");
    await expect(tree.getByText("没有找到匹配的章节")).toBeVisible();
    await search.fill("");

    // 编辑正文（modnav「写作」）→ 回工作台（预览页无编辑入口；工作台常驻挂载保选中）
    await page.getByRole("button", { name: /^写作/ }).click();
    await expect(page.locator(".col-tree").getByText("第一卷")).toBeVisible({
      timeout: 10000,
    });
    // PR2 查看/编辑门：归档章正文只读（contenteditable=false）+ 只读横幅
    await expect(page.getByText(/本章已归档 · 只读/).first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("旧城墙头").first()).toBeVisible();
    // not.toBeEditable() 对 div[contenteditable="false"] 会直接抛「无法判定」——
    // 断言属性与 isContentEditable 语义等价且可判定
    await expect(page.locator(".editor")).toHaveAttribute("contenteditable", "false");

    // 恢复编辑（readonly-banner 内入口，换皮不减功能）：confirm → 可编辑 + 树标记撤下
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "恢复编辑" }).click();
    // toBeEditable() 对 div[contenteditable="false"] 立即抛「无法判定」（不可重试）——
    // 恢复是异步 POST + 重拉，属性翻转有窗口期，须用可重试的属性断言等它变 "true"
    await expect(page.locator(".editor")).toHaveAttribute("contenteditable", "true", {
      timeout: 10000,
    });
    await expect(page.getByText(/本章已归档 · 只读/)).toHaveCount(0);
    // 树「已归档」只剩 API 归档的第二章（第一章恢复后撤下）
    await expect(page.locator(".col-tree .arch-tag")).toHaveCount(1);

    // 再次进入预览（懒挂载重挂）→ 恢复最近阅读章（localStorage 持久化）
    await page.getByRole("button", { name: "预览", exact: true }).click();
    await expect(page.getByRole("heading", { name: "风起渡口" })).toBeVisible({
      timeout: 10000,
    });
    // 第一章恢复后灰显：已归档 1/3
    await expect(tree.getByText("1/3")).toBeVisible({ timeout: 10000 });
    await expect(tree.getByText("未归档")).toHaveCount(2);
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
    await page.getByRole("button", { name: /^设定/ }).click();

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

// -------------------------------------------------------------------------
// P2-1b/1c/1d：三个「脏意识」缺口（角色切换 / 离开设定视图 / 完成设定自动保存）
// -------------------------------------------------------------------------

test("P2-1b 角色切换守卫：脏表单切换需确认，取消保留输入", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    const pid = await createNovel(page, `守卫角色${Date.now() % 100000}`);
    await page.getByRole("button", { name: /^设定/ }).click();
    await openSetting(page, "角色管理");

    // 创建两个角色（走真实创建弹窗）
    for (const name of ["阿甲", "阿乙"]) {
      await page.locator("main").getByRole("button", { name: /新建/ }).click();
      await page.getByPlaceholder("角色名").fill(name);
      await page.getByRole("button", { name: "角色：配角" }).click();
      await page.getByRole("button", { name: "✦ 创建" }).click();
      await expect(
        page.locator("main .w-48").getByText(name, { exact: true }),
      ).toBeVisible({ timeout: 5000 });
    }
    // 创建第二个角色后自动选中「阿乙」；先切回「阿甲」（干净，无弹窗）。
    // 阿甲数据为异步加载（GET /settings/character/阿甲），须等表单角色名=阿甲
    // （快照已就绪）再输入，否则加载完成会覆盖输入并重置脏标记 → 守卫不触发。
    await page.locator("main .w-48").getByText("阿甲", { exact: true }).click();
    await expect(
      page
        .locator("label", { hasText: "角色名" })
        .locator("xpath=ancestor::div[1]")
        .locator("input"),
    ).toHaveValue("阿甲", { timeout: 5000 });

    // 编辑阿甲的外貌 → 脏
    await fillSettingField(page, "外貌", "阿甲的外貌描述");
    const appearance = page
      .locator("label", { hasText: "外貌" })
      .locator("xpath=ancestor::div[2]")
      .locator("textarea");

    // 取消分支：dismiss → 仍选中阿甲、输入保留
    let dialogShown = false;
    page.once("dialog", (d) => {
      dialogShown = true;
      void d.dismiss();
    });
    await page.locator("main .w-48").getByText("阿乙", { exact: true }).click();
    expect(dialogShown).toBe(true);
    await expect(appearance).toHaveValue("阿甲的外貌描述");

    // 确认分支：accept → 切换为阿乙（表单角色名=阿乙）
    page.once("dialog", (d) => void d.accept());
    await page.locator("main .w-48").getByText("阿乙", { exact: true }).click();
    await expect(
      page
        .locator("label", { hasText: "角色名" })
        .locator("xpath=ancestor::div[1]")
        .locator("input"),
    ).toHaveValue("阿乙");
  } finally {
    restore();
  }
});

test("P2-1c 离开设定视图守卫：脏表单离开需确认，取消保留", async ({ page }) => {
  const { restore } = await setupSession(page);
  try {
    await createNovel(page, `守卫离开${Date.now() % 100000}`);
    await page.getByRole("button", { name: /^设定/ }).click();

    const scene = page
      .locator("label", { hasText: "主要场景" })
      .locator("xpath=ancestor::div[2]")
      .locator("textarea");
    await expect(scene).toBeVisible({ timeout: 10000 });
    await scene.fill("边境城邦：临海要塞，北接荒漠");

    // 取消分支：dismiss → 仍在设定视图、输入保留
    let dialogShown = false;
    page.once("dialog", (d) => {
      dialogShown = true;
      void d.dismiss();
    });
    await page.getByRole("button", { name: /^写作/ }).click();
    expect(dialogShown).toBe(true);
    await expect(scene).toBeVisible();
    await expect(scene).toHaveValue("边境城邦：临海要塞，北接荒漠");

    // 确认分支：accept → 离开设定视图（世界设定面板卸载）
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: /^写作/ }).click();
    await expect(scene).toHaveCount(0);
  } finally {
    restore();
  }
});

test("P2-1d 脏表单完成设定：自动保存再确认（内容落库 + 已设定）", async ({
  page,
  request,
}) => {
  const { restore, token } = await setupSession(page);
  try {
    const pid = await createNovel(page, `守卫完成${Date.now() % 100000}`);
    await page.getByRole("button", { name: /^设定/ }).click();

    // 填 ≥4 个子字段（3 地理 + 1 政治，readiness 阈值=4），不点保存（脏表单）
    const scene = page
      .locator("label", { hasText: "主要场景" })
      .locator("xpath=ancestor::div[2]")
      .locator("textarea");
    await expect(scene).toBeVisible({ timeout: 10000 });
    await fillSettingField(page, "主要场景", "一座被沙漠包围的边境城邦");
    await fillSettingField(page, "气候", "昼夜温差极大，夜晚滴水成冰");
    await fillSettingField(page, "地理限制", "北临黑海，西侧是断崖");
    await page.getByRole("button", { name: "政治" }).click();
    await fillSettingField(page, "统治形式", "城主议会制，元老席位世袭");

    // 完成设定 → 应先自动保存（PUT /settings/world）再确认（PUT /settings/status/world）
    const autoSave = page.waitForResponse(
      (r) => r.request().method() === "PUT" && r.url().includes("/settings/world"),
    );
    await confirmPanel(page, "世界设定");
    await autoSave;

    // 后端直查：内容已落库（自动保存生效）
    const world = await apiGetJSON(request, token, `/novels/${pid}/settings/world`);
    expect(world.geography.scenes).toContain("边境城邦");
    expect(world.politics.rule).toContain("城主议会制");
  } finally {
    restore();
  }
});
