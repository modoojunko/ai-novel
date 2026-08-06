export const BASE_URL = "http://localhost:8000";

export function url(hashPath: string) {
  return `${BASE_URL}/#${hashPath}`;
}
