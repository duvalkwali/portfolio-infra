export default function Performance() {
  const metrics = {
    before: { p50: 0, p95: 0, p99: 0, rps: 0, errorRate: "—" },
    after: { p50: 0, p95: 0, p99: 0, rps: 0, errorRate: "—" },
  };

  return (
    <div>
      <h1 style={styles.title}>Performance</h1>
      <p style={styles.subtitle}>
        Before/after benchmarks from k6 load tests against the live screening
        endpoint. All figures are real measurements on a fixed-resource
        container, not estimates.
      </p>

      <div style={styles.grid}>
        <MetricTable label="Before (naive)" data={metrics.before} />
        <MetricTable label="After (optimized)" data={metrics.after} />
      </div>

      <div style={styles.empty}>
        <p style={styles.emptyText}>
          Latency distribution chart and throughput timeline will render here
          once k6 results are captured. The "before" run must complete before
          any optimization work begins — the entire credibility of the
          before/after story depends on this ordering.
        </p>
      </div>
    </div>
  );
}

function MetricTable({ label, data }) {
  const rows = [
    { key: "p50", label: "p50 latency" },
    { key: "p95", label: "p95 latency" },
    { key: "p99", label: "p99 latency" },
    { key: "rps", label: "Throughput (RPS)" },
    { key: "errorRate", label: "Error rate" },
  ];

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>{label}</h2>
      {rows.map((r) => (
        <div key={r.key} style={styles.row}>
          <span style={styles.rowLabel}>{r.label}</span>
          <span style={styles.rowValue}>
            {typeof data[r.key] === "number" && data[r.key] === 0
              ? "—"
              : typeof data[r.key] === "number"
              ? `${data[r.key]}ms`
              : data[r.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 32,
    maxWidth: 640,
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
    marginBottom: 32,
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
    color: "var(--text-primary)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
    fontSize: 14,
  },
  rowLabel: { color: "var(--text-secondary)" },
  rowValue: {
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  empty: {
    background: "var(--bg-card)",
    border: "1px dashed var(--border)",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
  },
  emptyText: {
    color: "var(--text-muted)",
    fontSize: 14,
    maxWidth: 520,
    margin: "0 auto",
    lineHeight: 1.6,
  },
};
