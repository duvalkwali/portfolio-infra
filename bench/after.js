import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const screenLatency = new Trend("screen_latency", true);

const BASE_URL = __ENV.BASE_URL || "https://ledgerguard.duvalkwali.tech";

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
};

function randomTransaction() {
  return {
    amount: Math.random() * 10000,
    currency: "CAD",
    merchantId: `MERCH-${Math.floor(Math.random() * 500)}`,
    merchantCategory: ["grocery", "electronics", "travel", "atm", "online"][
      Math.floor(Math.random() * 5)
    ],
    accountId: `ACC-${Math.floor(Math.random() * 1000)}`,
    country: ["CA", "US", "NG", "RU", "CN", "GB"][
      Math.floor(Math.random() * 6)
    ],
    channel: ["POS", "ONLINE", "ATM"][Math.floor(Math.random() * 3)],
    timestamp: new Date().toISOString(),
  };
}

export default function () {
  const payload = JSON.stringify(randomTransaction());
  const params = { headers: { "Content-Type": "application/json" } };

  const res = http.post(`${BASE_URL}/api/screen`, payload, params);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has risk score": (r) => {
      try {
        return JSON.parse(r.body).riskScore !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(res.status !== 200);
  screenLatency.add(res.timings.duration);

  sleep(0.05);
}
