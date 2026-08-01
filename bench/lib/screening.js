import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

/**
 * Shared contract for the screening load tests.
 *
 * baseline.js and after.js must hit the endpoint the same way for their numbers to be
 * comparable, so the request shape, the login handshake and the assertions live here
 * rather than being duplicated (and drifting) across the two scripts. Only the load
 * profile and the thresholds differ between them.
 */

export const BASE_URL = (__ENV.BASE_URL || "https://ledgerguard.duvalkwali.tech").replace(/\/+$/, "");

/**
 * A dedicated ANALYST account rather than the admin one. Screening only requires an
 * authenticated caller, and keeping the load test off the admin credentials means a
 * benchmark run can never mutate rules or reseed the database by accident.
 */
const LOAD_USER = __ENV.LOAD_USER || "loadtest";
const LOAD_PASS = __ENV.LOAD_PASS || "LoadTest-2026!";

export const errorRate = new Rate("errors");
export const screenLatency = new Trend("screen_latency", true);

const DECISIONS = ["PASS", "FLAG", "REJECT"];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF"];
const CHANNELS = ["web", "mobile", "api", "branch", "atm"];

const JSON_HEADERS = { headers: { "Content-Type": "application/json" } };

/**
 * Logs in and hands the token to every VU through k6's setup data. Registers the
 * account first if it does not exist yet, so a fresh environment needs no manual step.
 */
export function authenticate() {
  const credentials = JSON.stringify({ username: LOAD_USER, password: LOAD_PASS });

  let res = http.post(`${BASE_URL}/api/auth/login`, credentials, JSON_HEADERS);

  if (res.status === 401 || res.status === 404) {
    // No such account yet — create it. Registration returns a token as well, so there
    // is no need to log in again afterwards.
    res = http.post(`${BASE_URL}/api/auth/register`, credentials, JSON_HEADERS);
  }

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`setup: could not authenticate as ${LOAD_USER} (HTTP ${res.status}): ${res.body}`);
  }

  const token = res.json("token");
  if (!token) {
    throw new Error(`setup: auth response carried no token: ${res.body}`);
  }

  return { token };
}

/**
 * Amounts follow a Pareto tail so the run actually exercises the rule engine: roughly
 * 10% of transactions clear the 10k FLAG threshold and ~4% clear the 50k REJECT one.
 * A uniform draw would leave almost every request on the cheap all-PASS path and
 * flatter the numbers.
 */
function heavyTailAmount() {
  const alpha = 0.5;
  const minimum = 100;
  const uniform = Math.random() || 1e-9;
  const amount = Math.min(minimum * Math.pow(uniform, -1 / alpha), 5_000_000);
  return Math.round(amount * 100) / 100;
}

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

/** The real ScreenRequest contract the API exposes. */
export function randomScreenRequest() {
  return {
    transactionId: `k6-${__VU}-${__ITER}-${Date.now()}`,
    senderId: `ACC-${1000 + Math.floor(Math.random() * 9000)}`,
    receiverId: `ACC-${1000 + Math.floor(Math.random() * 9000)}`,
    amount: heavyTailAmount(),
    currency: pick(CURRENCIES),
    timestamp: new Date().toISOString(),
    metadata: {
      channel: pick(CHANNELS),
      frequency_per_hour: Math.floor(Math.random() * 20),
    },
  };
}

/** Issues one screening call and records the shared metrics. Returns the response. */
export function screenOnce(token) {
  const res = http.post(`${BASE_URL}/api/screen`, JSON.stringify(randomScreenRequest()), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { name: "POST /api/screen" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "decision is PASS|FLAG|REJECT": (r) => {
      try {
        return DECISIONS.includes(r.json("decision"));
      } catch {
        return false;
      }
    },
  });

  errorRate.add(res.status !== 200);
  screenLatency.add(res.timings.duration);

  return res;
}

/** p50/p95/p99 are the figures the Performance page publishes, so always print them. */
export const SUMMARY_TREND_STATS = ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"];
