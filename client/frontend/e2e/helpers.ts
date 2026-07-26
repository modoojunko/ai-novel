import { Page } from "@playwright/test";

export const BASE_URL = "http://localhost:8000";
export const API_URL = `${BASE_URL}/api`;

let _uidCounter = 0;

export function url(hashPath: string) {
  return `${BASE_URL}/#${hashPath}`;
}

// ---------------------------------------------------------------------------
// Create a test user via API and return the auth token.
// Does NOT touch localStorage. Call navigateToPage() first.
// ---------------------------------------------------------------------------

export async function createTestUser(page: Page) {
  _uidCounter++;
  const ts = Date.now();
  const email = `e2e_${ts}_${_uidCounter}@example.com`;
  const password = "TestPass789!";
  const display_name = `E2EUser_${_uidCounter}`;

  const resp = await page.request.post(`${API_URL}/auth/register`, {
    data: { email, password, display_name },
  });
  if (!resp.ok()) {
    throw new Error(
      `Auth setup failed (${resp.status()}): ${await resp.text()}`
    );
  }

  const body = await resp.json();
  const token = body.access_token || body.token;
  return { email, password, token, display_name };
}

// ---------------------------------------------------------------------------
// Set auth token in browser localStorage (page must have an origin first)
// ---------------------------------------------------------------------------

export async function setToken(page: Page, token: string) {
  await page.evaluate((t) => {
    localStorage.setItem("auth_token", t);
    localStorage.setItem("auth_username", "E2EUser");
  }, token);
}

// ---------------------------------------------------------------------------
// Convenience: navigate to a page, then set auth token
// ---------------------------------------------------------------------------

export async function setupAuthAndNavigate(page: Page, hashPath: string) {
  // 1. Navigate first so localStorage origin is established
  await page.goto(url(hashPath));
  // 2. Create user
  const { token } = await createTestUser(page);
  // 3. Set token
  await setToken(page, token);
  // 4. Reload so SPA picks up the token
  await page.goto(url(hashPath));
  await page.waitForLoadState("networkidle");
  return token;
}

// ---------------------------------------------------------------------------
// Full setup — navigate to project page with auth + project
// ---------------------------------------------------------------------------

export async function setupProjectPage(page: Page) {
  const token = await setupAuthAndNavigate(page, "/dashboard");
  // Create a project via API
  const name = `E2EProject_${Date.now()}`;
  const resp = await page.request.post(`${API_URL}/projects`, {
    data: { name },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok()) {
    throw new Error(
      `Project creation failed (${resp.status()}): ${await resp.text()}`
    );
  }
  const body = await resp.json();
  const slug = body.slug;

  // Navigate to project page
  await page.goto(url(`/project/${slug}`));
  await page.waitForLoadState("networkidle");

  return { token, projectName: name, slug };
}

// ---------------------------------------------------------------------------
// Setup with a chapter created in the project
// ---------------------------------------------------------------------------

export async function setupChapterPage(page: Page) {
  const { token, slug } = await setupProjectPage(page);

  // Get project ID from slug
  const slugResp = await page.request.get(
    `${API_URL}/projects/by-slug/${slug}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const project = await slugResp.json();
  const projectId = project.id;

  // Create a volume
  await page.request.post(
    `${API_URL}/projects/${projectId}/volumes`,
    {
      data: { title: "第一卷", vol_num: 1 },
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  // Create a chapter
  const chResp = await page.request.post(
    `${API_URL}/projects/${projectId}/chapters`,
    {
      data: { volume: 1, chapter: 1, title: "第一章" },
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const ch = await chResp.json();
  const chapterRef = ch.chapter_ref || "vol-1-ch-1";

  // Reload project page to see the new content
  await page.goto(url(`/project/${slug}`));
  await page.waitForLoadState("networkidle");

  return { projectId, slug, chapterRef, token };
}
