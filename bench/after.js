import { sleep } from "k6";
import {
  BASE_URL,
  SUMMARY_TREND_STATS,
  authenticate,
  screenOnce,
} from "./lib/screening.js";

/**
 * AFTER run — the optimised screening path.
 *
 * Rules are served from Redis and the audit append has been moved off the request
 * thread onto a single writer, so this run pushes twice the peak concurrency of the
 * baseline and holds the tail latency to a real SLO instead of a placeholder.
 *
 *   docker run --rm -i -v "$PWD":/scripts grafana/k6 run /scripts/after.js
 */
export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    errors: ["rate<0.01"],
    screen_latency: ["p(95)<500"],
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
};

export function setup() {
  const session = authenticate();
  console.log(`after: authenticated against ${BASE_URL}`);
  return session;
}

export default function (data) {
  screenOnce(data.token);
  sleep(0.05);
}
