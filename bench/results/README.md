# Screening benchmark results

Raw k6 output, captured against the live deployment at
`https://ledgerguard.duvalkwali.tech` — a container capped at **0.75 CPU / 768 MB**
sharing a single DigitalOcean droplet with Postgres, Redis and Caddy.

| File | Load | What it is |
|---|---|---|
| `before.txt` | 10 → 50 → 100 VUs | The naive path, captured **before any optimization existed** |
| `after-equal-load.txt` | 10 → 50 → 100 VUs | The optimized path at the **identical** profile — this is the before/after comparison |
| `after.txt` | up to 200 VUs | A capacity run to find the ceiling, *not* a latency comparison |

## The comparison

Same script, same load profile, same container limits — only the implementation differs.

| | p50 | p95 | p99 | Throughput | Errors |
|---|---|---|---|---|---|
| Before | 202.12 ms | 717.10 ms | 994.44 ms | 116.08 req/s | 0.00% |
| After | 76.50 ms | 205.25 ms | 314.09 ms | 230.37 req/s | 0.00% |
| Change | **−62.2%** | **−71.4%** | **−68.4%** | **+98.5%** | — |

## Reading these honestly

**Ordering.** `before.txt` was captured while the naive implementation was still the
deployed build. It has not been re-measured or reconstructed after the fact, and it is
the conservative side of the comparison.

**Why the "after" is a median.** Throughput here is bimodal against JIT warmup: a run
started on a cold JVM lands near 132 req/s, and the same script on the same box settles
around 230 req/s once the hot paths compile. Publishing whichever run happened to come
first would mislead in one direction or the other, so the figure above is the **median
of three warm runs** (226.8 / 230.4 / 241.6 req/s), all with a 0.00% error rate.

**Why `after.txt` is not the comparison.** It pushes 200 VUs — double the baseline — so
its latencies describe saturation, not the optimization. It is included because "how
much load does this survive" is a different and also worth answering: the container
tops out near **267 req/s**, and past that it starts refusing connections (0.23% of
requests), which is the honest answer to where this deployment stops coping.

**A stall that had to be fixed first.** Early "after" runs showed a reproducible ~34 s
pause at peak load — the app kept processing (the audit chain stayed intact and every
"failed" request was still persisted; only the responses were lost), but the proxy gave
up mid-request. The cause was two JVM defaults that are wrong for these limits: under
2 CPUs the JVM selects SerialGC, and `MaxRAMPercentage` defaults to 25%, leaving a
~192 MB heap. Switching to G1 with a 70% heap removed it. Capping Tomcat's thread pool
was also tried and reverted — it cost ~30% throughput without reducing errors.

## Reproducing

```bash
docker run --rm -v "$PWD/bench":/scripts grafana/k6 run /scripts/baseline.js
```

`after.js` is the 200 VU variant. Both authenticate in `setup()` and share their request
contract through `bench/lib/screening.js`. Override the target with
`-e BASE_URL=https://…`.
