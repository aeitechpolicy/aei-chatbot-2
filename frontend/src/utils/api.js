export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const SESSION_KEY = 'aei-private-session';
let session = null;
try {
  const saved = JSON.parse(window.sessionStorage.getItem(SESSION_KEY));
  if (saved && typeof saved.token === 'string' && saved.token.length <= 2048 && saved.user && saved.expiresAt > Date.now()) session = saved;
} catch { /* Start signed out when browser storage is unavailable. */ }

export const getSession = () => session;

export function setSession(value) {
  session = value;
  try {
    if (value) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch { /* The current tab can still use its in-memory session. */ }
  window.dispatchEvent(new Event('aei-session-changed'));
}

export async function apiFetch(url, options = {}) {
  const token = session && session.token;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers, cache: 'no-store' });
  if (response.status === 401 && token === (session && session.token)) setSession(null);
  return response;
}

export async function signIn(account, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }), cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Sign-in failed. Please try again.');
  setSession(data);
  return data;
}

export async function signOut() {
  try { await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' }); }
  finally { setSession(null); }
}
