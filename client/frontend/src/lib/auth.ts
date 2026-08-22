const TOKEN_KEY = 'auth_token';
const USERNAME_KEY = 'auth_username';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, username: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 手动退出（区别于会话过期）：清凭据并回首页。 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  sessionStorage.setItem('manual_logout', '1');
  window.location.hash = '#/';
}
