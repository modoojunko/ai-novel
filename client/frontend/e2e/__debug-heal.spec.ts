import { test } from "@playwright/test";

test("debug: heal signal", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`[console] ${m.text()}`));
  page.on("response", async (r) => {
    if (r.url().includes("check-auth")) {
      let b = "";
      try { b = await r.text(); } catch { b = "<err>"; }
      logs.push(`[api] ${r.request().method()} ${new URL(r.url()).pathname} => ${b.slice(0, 100)}`);
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("auth_token", "stale-token");
    localStorage.setItem("auth_username", "gone-user");
  });
  await page.route("**/api/auth/check-auth", (r) =>
    r.fulfill({
      json: {
        code: 1,
        data: {
          session_invalid: true,
          deleted: true,
          message: "登录状态已失效（账号可能已注销）。你设备上的作品仍完好保留。",
        },
      },
    }),
  );
  await page.route("**/api/novels", (r) => r.fulfill({ json: [] }));
  await page.goto("/#/novels");
  await page.waitForTimeout(5000);
  console.log("URL_NOW:", page.url());
  console.log("TOKEN:", await page.evaluate(() => localStorage.getItem("auth_token")));
  console.log("NOTICE_SS:", await page.evaluate(() => sessionStorage.getItem("auth_notice")));
  console.log("LOGS:", JSON.stringify(logs, null, 1).slice(0, 1500));
  const html = await page.content();
  console.log("HAS_AUTHCARD:", html.includes("auth-card"));
  console.log("HAS_LOGIN_H1:", html.includes(">登录<"));
  console.log("HTML_SNIPPET:", html.slice(html.indexOf("main") - 50, html.indexOf("main") + 400));
  const heads = await page.getByRole("heading").allTextContents();
  const btns = await page.getByRole("button").allTextContents();
  const links = await page.getByRole("link").allTextContents();
  console.log("HEADINGS:", JSON.stringify(heads));
  console.log("BUTTONS:", JSON.stringify(btns));
  console.log("LINKS:", JSON.stringify(links));
});
