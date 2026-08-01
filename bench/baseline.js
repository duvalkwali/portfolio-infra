import { sleep } from "k6";
import {
  BASE_URL,
  SUMMARY_TREND_STATS,
  authenticate,
  screenOnce,
} from "./lib/screening.js";

/**
 * BEFORE run — the naive screening path.
 *
 * Every request re-reads the enabled rules from Postgres and appends the audit entry
 * synchronously, inside the request. Thresholds are deliberately loose: this run exists
 * to record what the unoptimised path does, not to pass or fail.
 *
 *   docker run --rm -i -v "$PWD":/scripts grafana/k6 run /scripts/baseline.js
 */
export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.05"],
    screen_latency: ["p(95)<5000"],
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
};

export function setup() {
  const session = authenticate();
  console.log(`baseline: authenticated against ${BASE_URL}`);
  return session;
}

export default function (data) {
  screenOnce(data.token);
  sleep(0.1);
}
