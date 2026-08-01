/**
 * The auth store: `{ token, role }` persisted in localStorage so a reload keeps the
 * session. Kept in its own module because both the API client and the React context
 * read it, and importing the context from the client would be a cycle.
 */

const STORAGE_KEY = "ledgerguard.auth";

export function readAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.token ? parsed : null;
  } catch {
    // A corrupted entry should log the user out, not crash the app on boot.
    return null;
  }
}

export function writeAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getToken() {
  return readAuth()?.token ?? null;
}

/**
 * The dev-endpoint token, held for the tab's lifetime only.
 *
 * `/api/dev/**` needs a shared secret in addition to the ADMIN role, and that secret
 * cannot be baked into the bundle — the bundle is served to anyone who loads the page.
 * So the operator supplies it at the moment they use it. sessionStorage rather than
 * localStorage: closing the tab should not leave it behind on a shared machine.
 */
const DEV_TOKEN_KEY = "ledgerguard.devToken";

export function getDevToken() {
  try {
    return sessionStorage.getItem(DEV_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setDevToken(token) {
  try {
    if (token) sessionStorage.setItem(DEV_TOKEN_KEY, token);
    else sessionStorage.removeItem(DEV_TOKEN_KEY);
  } catch {
    // Private-browsing modes can refuse the write. The token still works for this
    // call; the operator is just asked for it again next time.
  }
}

/**
 * Whether the stored token has passed its `exp` claim.
 *
 * Read locally only to tell a genuinely expired session apart from a permission
 * denial — the backend remains the authority on whether a token is acceptable.
 * An unreadable token is treated as expired so the user is sent back to sign in.
 */
export function isTokenExpired(token = getToken()) {
  if (!token) return true;

  try {
    const [, payload] = token.split(".");
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!claims.exp) return false;
    return claims.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
