import { clearAuth, getToken, isTokenExpired } from "../auth/store";

/**
 * Base URL for the API.
 *
 * `VITE_API_URL` wins when it is set — that is how the shell talks to the deployed
 * backend at https://ledgerguard.duvalkwali.tech. When it is unset the base is empty,
 * so requests stay same-origin and the Vite dev proxy forwards `/api` and `/actuator`
 * to http://localhost:8080. Both paths reach the same default backend.
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Thrown for any non-2xx response, carrying the status so callers can branch on it. */
export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function onUnauthorized() {
  clearAuth();
  // A hard navigation also tears down component state holding stale data.
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

/**
 * Spring returns errors as a JSON problem body, but 401s from the security filter and
 * proxy errors come back as HTML or empty. Read defensively and fall back to the status.
 */
async function readError(response) {
  const text = await response.text().catch(() => "");
  if (!text) return { message: `Request failed (${response.status})`, body: null };

  try {
    const parsed = JSON.parse(text);
    return {
      message: parsed.message || parsed.error || parsed.detail || `Request failed (${response.status})`,
      body: parsed,
    };
  } catch {
    return { message: text.slice(0, 200), body: null };
  }
}

async function request(path, { method = "GET", body, auth = true, signal, headers: extra } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  Object.assign(headers, extra);

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && auth) {
    // The backend answers a role denial with 401 rather than 403, so a blanket
    // sign-out here would eject an ANALYST who touched an ADMIN-only endpoint.
    // A token that is present and unexpired means "not permitted", not "expired".
    if (isTokenExpired()) {
      onUnauthorized();
      throw new ApiError(401, "Session expired — please sign in again", null);
    }
    throw new ApiError(401, "Your role does not permit this action", null);
  }

  if (!response.ok) {
    const { message, body: errorBody } = await readError(response);
    throw new ApiError(response.status, message, errorBody);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------- auth

export function login(username, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
}

export function register(username, password, role) {
  return request("/api/auth/register", {
    method: "POST",
    // Omit the role entirely rather than sending null; the backend treats an absent
    // role as ANALYST and rejects an unauthorised ADMIN claim.
    body: role ? { username, password, role } : { username, password },
    auth: false,
  });
}

// ---------------------------------------------------------------- screening

export function screen(transaction) {
  return request("/api/screen", { method: "POST", body: transaction });
}

// ---------------------------------------------------------------- rules

export function getRules() {
  return request("/api/rules");
}

export function createRule(rule) {
  return request("/api/rules", { method: "POST", body: rule });
}

export function updateRule(id, rule) {
  return request(`/api/rules/${id}`, { method: "PUT", body: rule });
}

export function deleteRule(id) {
  return request(`/api/rules/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------- alerts

export function getAlerts({ status, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request(`/api/alerts?${params}`);
}

export function updateAlert(id, status) {
  return request(`/api/alerts/${id}`, { method: "PATCH", body: { status } });
}

/**
 * Opens the live alert stream.
 *
 * `EventSource` cannot set request headers, so the bearer token travels as a query
 * parameter — the backend accepts it on this one endpoint for exactly that reason.
 * Returns the EventSource so the caller can close it on unmount.
 */
export function openAlertStream({ onAlert, onError } = {}) {
  const token = getToken();
  const params = token ? `?token=${encodeURIComponent(token)}` : "";
  const source = new EventSource(`${API_BASE}/api/alerts/stream${params}`);

  source.addEventListener("alert", (event) => {
    try {
      onAlert?.(JSON.parse(event.data));
    } catch {
      // A malformed frame should not kill the subscription.
    }
  });

  if (onError) source.onerror = onError;

  return source;
}

// ---------------------------------------------------------------- audit

export function getAudit(limit = 20) {
  return request(`/api/audit?limit=${limit}`);
}

export function verifyAudit() {
  return request("/api/audit/verify");
}

// ---------------------------------------------------------------- dashboard & dev

export function getDashboardStats() {
  return request("/api/dashboard/stats");
}

/**
 * Seeds demo data.
 *
 * `/api/dev/**` requires the ADMIN role *and* an `X-Dev-Token` header matching the
 * deployment's `DEV_API_TOKEN` — these endpoints truncate and regenerate the ledger, so
 * the admin password alone is deliberately not enough. The secret cannot live in this
 * bundle, so the caller passes it in; a missing or wrong token comes back as 404, which
 * is also what a deployment with no dev token configured returns.
 */
export function seed(count = 200, devToken) {
  return request(`/api/dev/seed?count=${count}`, {
    method: "POST",
    headers: devToken ? { "X-Dev-Token": devToken } : undefined,
  });
}
