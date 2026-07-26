import { test as base } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const C_ORIGIN = "http://localhost:8000";
export const C_API = `${C_ORIGIN}/api`;
export const S_ORIGIN = "http://127.0.0.1:19000";
export const S_API = `${S_ORIGIN}/api`;
export const ADMIN_TOKEN = "admin123";

// ---------------------------------------------------------------------------
// API helpers — S端
// ---------------------------------------------------------------------------

export async function sRegister(username: string) {
  const r = await fetch(`${S_API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password: "TestPass789!",
      security_question: "最喜欢的颜色",
      security_answer: "蓝色",
    }),
  });
  const body = await r.json();
  if (body.code !== 0) throw new Error(`S端 register failed: ${JSON.stringify(body)}`);
  return body.data.token as string;
}

export async function sLogin(username: string) {
  const r = await fetch(`${S_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "TestPass789!" }),
  });
  const body = await r.json();
  if (body.code !== 0) throw new Error(`S端 login failed: ${JSON.stringify(body)}`);
  return body.data.token as string;
}

export async function sGenerateCodes(count = 1, tier = "monthly") {
  const r = await fetch(`${S_API}/generate_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_token: ADMIN_TOKEN, tier, count }),
  });
  const body = await r.json();
  if (body.code !== 0) throw new Error(`Generate codes failed: ${JSON.stringify(body)}`);
  return body.data.codes as string[];
}

export async function sActivateCode(token: string, code: string) {
  // Need to resolve username from token
  const r = await fetch(`${S_API}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, code }),
  });
  const body = await r.json();
  if (body.code !== 0) throw new Error(`Activate code failed: ${JSON.stringify(body)}`);
  return body;
}

// ---------------------------------------------------------------------------
// API helpers — C端
// ---------------------------------------------------------------------------

export async function cRegister() {
  const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `fulljourney_${uid}@test.local`;
  const r = await fetch(`${C_API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "TestPass789!", display_name: "JourneyTester" }),
  });
  if (!r.ok) throw new Error(`C端 register failed: ${await r.text()}`);
  const body = await r.json();
  return { email, token: body.access_token || body.token };
}

// ---------------------------------------------------------------------------
// Extended test fixture — reusable auth state per worker
// ---------------------------------------------------------------------------

type ApiClients = {
  sToken: string;
  cToken: string;
  sUsername: string;
  cEmail: string;
};

export const test = base.extend<{ ctx: ApiClients }>({
  ctx: [
    async ({}, use, workerInfo) => {
      const uid = `w${workerInfo.workerIndex}_${Date.now().toString(36)}`;

      // S端: register + login
      const sUsername = `s_user_${uid}`;
      const sToken = await sRegister(sUsername);

      // C端: register (DEV_MODE must be enabled on server)
      const { email: cEmail, token: cToken } = await cRegister();

      await use({ sToken, cToken, sUsername, cEmail });
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
