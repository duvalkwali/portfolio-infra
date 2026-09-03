import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Real k6 measurements against the live deployment, not estimates.
 *
 * "before" was captured while the naive implementation was still deployed — rules
 * re-read from Postgres on every call, audit entry inserted synchronously inside the
 * request. "after" replays the identical 10/50/100 VU profile against the optimized
 * build, so the load is held constant and only the implementation differs.
 *
 * Raw k6 output for all of these lives in portfolio-infra/bench/results/.
 */
const SERIES = {
  before: { label: "Before (naive)", color: "#d97706" },
  after: { label: "After (optimized)", color: "#1d3fcc" },
};

const metrics = {
  before: { p50: 202.12, p95: 717.1, p99: 994.44, rps: 116.08, errorRate: "0.00%" },
  after: { p50: 76.5, p95: 205.25, p99: 314.09, rps: 230.37, errorRate: "0.00%" },
};

/**
 * The 200 VU run — double the comparison load. Kept separate on purpose: its latencies
 * are not comparable with the numbers above, because it is measuring where this
 * container stops coping rather than what the optimization did.
 */
const capacity = { vus: 200, rps: 267.05, p95: 454.03, p99: 646.69, errorRate: "0.23%" };

const latencyData = [
  { percentile: "p50", before: metrics.before.p50, after: metrics.after.p50 },
  { percentile: "p95", before: metrics.before.p95, after: metrics.after.p95 },
  { percentile: "p99", before: metrics.before.p99, after: metrics.after.p99 },
];

const throughputData = [
  { name: SERIES.before.label, rps: metrics.before.rps, key: "before" },
  { name: SERIES.after.label, rps: metrics.after.rps, key: "after" },
];

/** Negative is faster for latency; positive is more for throughput. */
function changePct(before, after) {
  return ((after - before) / before) * 100;
}

export default function Performance() {
  return (
    <div>
      <h1 style={styles.title}>Performance</h1>
      <p style={styles.subtitle}>
        Before/after k6 load tests against the live screening endpoint. All figures
        are real measurements on a fixed-resource container (0.75 CPU / 768 MB), not
        estimates. Both runs use the same 10 → 50 → 100 VU profile, so the load is
        held constant and only the implementation changes.
      </p>

      <div style={styles.deltaRow}>
        <DeltaTile label="p50 latency" change={changePct(metrics.before.p50, metrics.after.p50)}
          from={`${metrics.before.p50} ms`} to={`${metrics.after.p50} ms`} lowerIsBetter />
        <DeltaTile label="p95 latency" change={changePct(metrics.before.p95, metrics.after.p95)}
          from={`${metrics.before.p95} ms`} to={`${metrics.after.p95} ms`} lowerIsBetter />
        <DeltaTile label="p99 latency" change={changePct(metrics.before.p99, metrics.after.p99)}
          from={`${metrics.before.p99} ms`} to={`${metrics.after.p99} ms`} lowerIsBetter />
        <DeltaTile label="Throughput" change={changePct(metrics.before.rps, metrics.after.rps)}
          from={`${metrics.before.rps} rps`} to={`${metrics.after.rps} rps`} />
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Latency distribution</h2>
        <p style={styles.cardNote}>
          Response time in milliseconds at each percentile. Lower is better — the gap
          widens toward the tail, which is where the synchronous audit write hurt most.
        </p>
        <div style={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={latencyData} barGap={2} margin={{ top: 24, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="percentile" tick={axisTick} axisLine={axisLine} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56}
                label={{ value: "ms", position: "insideTopLeft", offset: -14, fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<DarkTooltip unit="ms" />} />
              <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={9} />
              <Bar dataKey="before" name={SERIES.before.label} fill={SERIES.before.color} radius={[4, 4, 0, 0]} maxBarSize={54}>
                <LabelList dataKey="before" position="top" fill="var(--text-secondary)" fontSize={11} formatter={ms} />
              </Bar>
              <Bar dataKey="after" name={SERIES.after.label} fill={SERIES.after.color} radius={[4, 4, 0, 0]} maxBarSize={54}>
                <LabelList dataKey="after" position="top" fill="var(--text-secondary)" fontSize={11} formatter={ms} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Throughput</h2>
        <p style={styles.cardNote}>
          Sustained requests per second at the same 100 VU peak. Higher is better.
        </p>
        <div style={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={throughputData} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={150} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<DarkTooltip unit="rps" />} />
              <Bar dataKey="rps" name="Requests / sec" radius={[0, 4, 4, 0]} maxBarSize={40}>
                {throughputData.map((row) => (
                  <Cell key={row.key} fill={SERIES[row.key].color} />
                ))}
                <LabelList dataKey="rps" position="right" fill="var(--text-secondary)" fontSize={12} formatter={rps} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.grid}>
        <MetricTable label={SERIES.before.label} data={metrics.before} color={SERIES.before.color} />
        <MetricTable label={SERIES.after.label} data={metrics.after} color={SERIES.after.color} />
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Where it stops coping</h2>
        <p style={styles.cardNote}>
          A separate run pushes {capacity.vus} VUs — double the comparison load — to
          find the ceiling rather than to measure the optimization. The container tops
          out around {capacity.rps} rps; past that it starts refusing connections, so
          these latencies are deliberately kept out of the comparison above.
        </p>
        <div style={styles.capacityRow}>
          <SmallStat label="Peak throughput" value={`${capacity.rps} rps`} />
          <SmallStat label="p95" value={`${capacity.p95} ms`} />
          <SmallStat label="p99" value={`${capacity.p99} ms`} />
          <SmallStat label="Error rate" value={capacity.errorRate} />
        </div>
      </div>

      <p style={styles.method}>
        <strong style={styles.methodHead}>Method.</strong> The baseline was captured
        before any optimization existed and has not been re-measured. Throughput on
        this deployment is bimodal against JIT warmup — a run started on a cold JVM
        lands near 132 rps and settles around 230 rps once the hot paths compile — so
        the "after" figure is the median of three warm runs, all of which had a 0.00%
        error rate. What changed: the enabled rule set is served from Redis instead of
        a per-request Postgres query, and audit entries are queued for a single writer
        thread that batch-inserts off the request path — which also closed a
        read-modify-write race where two concurrent screenings could read the same
        previous hash and fork the ledger chain.
      </p>
    </div>
  );
}

function DeltaTile({ label, change, from, to, lowerIsBetter = false }) {
  const improved = lowerIsBetter ? change < 0 : change > 0;
  return (
    <div style={styles.deltaTile}>
      <span style={styles.deltaLabel}>{label}</span>
      <span style={{ ...styles.deltaValue, color: improved ? "var(--green)" : "var(--red)" }}>
        {change > 0 ? "+" : ""}{change.toFixed(1)}%
      </span>
      <span style={styles.deltaFromTo}>
        {from} → {to}
      </span>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div style={styles.smallStat}>
      <span style={styles.deltaLabel}>{label}</span>
      <span style={styles.smallStatValue}>{value}</span>
    </div>
  );
}

function DarkTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={styles.tooltip}>
      {label && <div style={styles.tooltipLabel}>{label}</div>}
      {payload.map((entry) => (
        <div key={entry.name} style={styles.tooltipRow}>
          <span style={{ ...styles.tooltipDot, background: entry.color ?? entry.payload?.fill }} />
          <span style={styles.tooltipName}>{entry.name}</span>
          <span style={styles.tooltipValue}>
            {entry.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricTable({ label, data, color }) {
  const rows = [
    { key: "p50", label: "p50 latency", unit: "ms" },
    { key: "p95", label: "p95 latency", unit: "ms" },
    { key: "p99", label: "p99 latency", unit: "ms" },
    { key: "rps", label: "Throughput", unit: "rps" },
    { key: "errorRate", label: "Error rate", unit: "" },
  ];

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>
        <span style={{ ...styles.swatch, background: color }} />
        {label}
      </h2>
      {rows.map((r) => (
        <div key={r.key} style={styles.row}>
          <span style={styles.rowLabel}>{r.label}</span>
          <span style={styles.rowValue}>
            {typeof data[r.key] === "number" ? `${data[r.key]} ${r.unit}` : data[r.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

// Recharts renders nothing for a label whose formatter returns a number, so both of
// these must hand back a string.
const ms = (value) => `${Math.round(value)}`;
const rps = (value) => `${value.toFixed(1)}`;
const axisTick = { fill: "var(--text-muted)", fontSize: 12 };
const axisLine = { stroke: "var(--border)" };
const legendStyle = { fontSize: 12, color: "var(--text-secondary)", paddingTop: 8 };

const styles = {
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 24,
    maxWidth: 680,
    lineHeight: 1.6,
  },
  deltaRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  deltaTile: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  deltaLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  deltaValue: {
    fontFamily: "var(--font-mono)",
    fontSize: 26,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.1,
  },
  deltaFromTo: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-secondary)",
    fontVariantNumeric: "tabular-nums",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
    color: "var(--text-primary)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cardNote: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: 16,
    maxWidth: 640,
  },
  chartWrap: { width: "100%", overflowX: "auto" },
  swatch: { width: 10, height: 10, borderRadius: 3, display: "inline-block", flexShrink: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
    marginBottom: 16,
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
  capacityRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 12,
  },
  smallStat: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  smallStatValue: {
    fontFamily: "var(--font-mono)",
    fontSize: 15,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  tooltip: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
  },
  tooltipLabel: {
    color: "var(--text-muted)",
    marginBottom: 6,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontSize: 10,
  },
  tooltipRow: { display: "flex", alignItems: "center", gap: 8, padding: "2px 0" },
  tooltipDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  tooltipName: { color: "var(--text-secondary)" },
  tooltipValue: {
    fontFamily: "var(--font-mono)",
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
    marginLeft: "auto",
  },
  method: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    maxWidth: 720,
    marginTop: 8,
  },
  methodHead: { color: "var(--text-primary)" },
};
