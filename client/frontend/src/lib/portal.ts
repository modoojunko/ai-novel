/**
 * S 端门户地址（购买 / 续费 / 开通试用入口）。
 * 公开营销地址（非密钥）；运行时以后端 /auth/config 的 portal_url 为准
 * （config.json 可覆盖），此处为未登录页（Landing 等）的兜底值。
 */
export const PORTAL_URL =
  (import.meta.env.VITE_PORTAL_URL as string | undefined) ||
  "https://novel-s-web-ai-novel-test-d1ghsr86ra814c12c.webapps.tcloudbase.com";
