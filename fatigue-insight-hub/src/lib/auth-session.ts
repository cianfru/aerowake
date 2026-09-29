const API = import.meta.env.VITE_API_URL || 'https://aerowake-production.up.railway.app';
let generation = 0;
let refreshing: Promise<boolean> | null = null;
export const getStoredToken = () => localStorage.getItem('aerowake-token');
export const getStoredRefreshToken = () => localStorage.getItem('aerowake-refresh');
export function storeTokens(access: string, refresh: string) {
  localStorage.setItem('aerowake-token', access); localStorage.setItem('aerowake-refresh', refresh);
}
export function sessionChanged() { generation++; }
export const sessionGeneration = () => generation;
export function clearTokens() {
  sessionChanged();
  localStorage.removeItem('aerowake-token'); localStorage.removeItem('aerowake-refresh');
}
export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (token) return { Authorization: `Bearer ${token}` };
  let guest = sessionStorage.getItem('aerowake-guest');
  if (!guest) { guest = crypto.randomUUID(); sessionStorage.setItem('aerowake-guest', guest); }
  return { 'X-Guest-Session': guest };
}
export async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refresh = getStoredRefreshToken(), started = generation;
  if (!refresh) return false;
  refreshing = (async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }) });
      if (!res.ok || started !== generation) return false;
      const tokens = await res.json();
      if (started !== generation || getStoredRefreshToken() !== refresh) return false;
      storeTokens(tokens.access_token, tokens.refresh_token);
      return true;
    } catch { return false; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}
/** Retry once after a shared refresh; never replay a request under a different account. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const started = generation;
  const res = await fetch(input, init);
  if (res.status !== 401 || !new Headers(init.headers).has('Authorization')) return res;
  if (started !== generation) throw new Error('Your session changed. Please try again.');
  if (await refreshSession()) {
    if (started !== generation) throw new Error('Your session changed. Please try again.');
    const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${getStoredToken()}`);
    return fetch(input, { ...init, headers });
  }
  if (started !== generation) throw new Error('Your session changed. Please try again.');
  clearTokens(); window.dispatchEvent(new Event('aerowake-session-expired'));
  return res;
}
