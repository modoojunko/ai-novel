export function getApiBaseUrl(): string {
  const cfg = typeof window !== "undefined" ? (window as any).__RUNTIME_CONFIG__ : null;
  return cfg?.API_BASE_URL || "";
}
