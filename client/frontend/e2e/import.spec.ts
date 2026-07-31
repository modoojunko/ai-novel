import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";

// =========================================================================
// 导入已有稿子 — 真实链路 E2E
// =========================================================================
// 不 mock：token 由 S端 真实签发（register + login），文件解析与入库走
// 真实 C端 后端。鉴权按「C端 靠 S端 OAuth」——把 S端 签发会话写入 config.json
// （OAuth 授权落盘处），跑完恢复原会话，不破坏用户登录态。
// 前置条件：S端 :19000 与 C端 :8000 均已启动。

const S_API = "http://127.0.0.1:19000/api/web";
const C_ORIGIN = "http://localhost:8000";
const CONFIG_PATH = path.join(
  process.cwd(),
  "..",
  "backend",
  "data",
  "config.json",
);

let uidCounter = 0;

/** 在 S端 注册并登录，返回 S端 签发的 JWT 与用户名。 */
async function sRegisterAndLogin() {
  uidCounter++;
  const username = `e2e_import_${Date.now()}_${uidCounter}`;
  const password = "TestPass789!";

  const reg = await fetch(`${S_API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
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
    body: JSON.stringify({ username, password }),
  });
  const loginBody = await login.json();
  if (loginBody.code !== 0) {
    throw new Error(`S端 login 失败: ${JSON.stringify(loginBody)}`);
  }
  return { token: loginBody.data.token as string, username };
}

/** 把 S端 会话写入 config.json（OAuth 授权落盘处），返回恢复函数。 */
function writeOAuthSession(token: string, username: string) {
  const original = fs.readFileSync(CONFIG_PATH, "utf-8");
  const cfg = JSON.parse(original);
  cfg.token = token;
  cfg.username = username;
  cfg.tier = "trial";
  cfg.last_login_at = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  return () => fs.writeFileSync(CONFIG_PATH, original);
}

/** 通过真实 C端 API 为该用户创建 active 的 API Key 配置（解锁 AI 门控）。 */
async function setupAiConfig(token: string) {
  const r = await fetch(`${C_ORIGIN}/api/v1/api-configs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: `e2e-config-${Date.now()}`,
      vendor_id: "deepseek",
      base_url: "https://api.deepseek.com/anthropic",
      api_key: "sk-e2e-test-placeholder",
    }),
  });
  if (!r.ok) {
    throw new Error(`C端 api-configs 创建失败 (${r.status}): ${await r.text()}`);
  }
}

test("导入已有稿子：真实解析 → 预览 → 入库 → 小说页展示", async ({ page }) => {
  // 1. S端 真实注册登录 → 写入 OAuth 会话
  const { token, username } = await sRegisterAndLogin();
  const restoreSession = writeOAuthSession(token, username);
  try {
    await setupAiConfig(token);
    await page.addInitScript((t) => {
      localStorage.setItem("auth_token", t);
    }, token);

    // 2. 进入作品列表（真实数据）
    await page.goto(`${C_ORIGIN}/#/novels`);
    await expect(page.getByRole("button", { name: "开始新小说" })).toBeVisible({
      timeout: 10000,
    });

    // 3. 打开创建弹窗 → 选「导入已有稿子」
    await page.getByRole("button", { name: "开始新小说" }).click();
    await page.getByRole("button", { name: "导入已有稿子" }).click();

    // 4. 上传真实 md 文件（真实后端解析）
    await page.locator('input[type="file"]').setInputFiles({
      name: "manuscript.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# 第一卷 风云际会\n\n## 第一章 初来乍到\n\n正文内容一。\n\n# 第二卷 暗流涌动\n\n## 第一章 风波乍起\n\n正文内容二。",
      ),
    });

    // 5. 解析成功 → 预览树显示卷/章（真实 importer 输出）
    await expect(page.getByText("第一卷 风云际会").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("第二卷 暗流涌动").first()).toBeVisible();
    await expect(page.getByText("初来乍到").first()).toBeVisible();

    // 6. 确认入库 → 真实 persist → 跳转小说页
    await page.getByRole("button", { name: "确认入库" }).click();
    await expect(page).toHaveURL(/#\/novel\/[0-9a-fA-F-]+/, { timeout: 10000 });

    // 7. 小说页展示导入内容（真实数据落库；章节可读性由后端往返测试保证）
    await expect(page.getByText("第一卷 风云际会").first()).toBeVisible({
      timeout: 10000,
    });
  } finally {
    // 恢复用户原有 OAuth 会话，不破坏登录态
    restoreSession();
  }
});
