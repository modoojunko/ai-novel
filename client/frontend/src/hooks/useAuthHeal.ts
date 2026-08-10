import { useEffect } from "react";
import { request } from "@/lib/api";
import { setToken } from "@/lib/auth";

/**
 * 应用启动时静默自愈本地登录态：
 * 后端 OAuth 会话有效（GET /auth/check-auth 返回 token）即写回 localStorage，
 * 解决「后端 config.json token 有效、前端 localStorage 副本丢失/被清」导致的重复登录。
 * 幂等：后端有效才写回；无效/失败静默，不改动现有状态，不跳转。
 */
export function useAuthHeal() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await request("/auth/check-auth");
        if (cancelled) return;
        if (res.code === 0 && res.data?.token && res.data.token !== "dev-token") {
          setToken(res.data.token, res.data.username ?? "");
        }
      } catch {
        // 后端不可达/未登录：静默失败，由 LoginPage 手动流程兜底
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
