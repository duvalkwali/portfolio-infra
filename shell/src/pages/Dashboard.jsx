import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getDevToken, setDevToken } from "../auth/store";
import ScreenPanel from "../components/ScreenPanel";

// Recharts renders to SVG attributes, which cannot resolve CSS variables, so the
// decision palette is repeated here as literals matching index.css.
const DECISION_COLORS = {
  PASS: "#22c55e",
  FLAG: "#eab308",
  REJECT: "#ef4444",
};

const MAX_LIVE_ALERTS = 12;

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

/**
 * Turns the ledger's recent activity into chart rows.
 *
 * `recentActivity` is the raw audit feed, so it also carries entries like
 * USER_REGISTERED that have no amount. Only screening entries can be plotted, and the
 * feed arrives newest-first while the chart reads left-to-right.
 */
function toChartData(recentActivity) {
  return (recentActivity ?? [])
    .filter((entry) => entry.payload && entry.payload.amount != null)
    .map((entry) => ({
      time: formatTime(entry.createdAt),
      amount: Number(entry.payload.amount),
      decision: entry.payload.decision ?? "PASS",
    }))
    .reverse();
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [streamStatus, setStreamStatus] = useState("connecting");
  const [seeding, setSeeding] = useState(false);
  const seenAlertIds = useRef(new Set());

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.getDashboardStats());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const source = api.openAlertStream({
      onAlert: (alert) => {
        // EventSource replays on reconnect, and one screening that trips two rules
        // emits two distinct alerts — dedupe on id so the feed stays honest either way.
        if (seenAlertIds.current.has(alert.id)) return;
        seenAlertIds.current.add(alert.id);
        setStreamStatus("live");
        setLiveAlerts((current) => [alert, ...current].slice(0, MAX_LIVE_ALERTS));
      },
      onError: () => setStreamStatus("reconnecting"),
    });

    source.onopen = () => setStreamStatus("live");
    return () => source.close();
  }, []);

  /**
   * Seeding needs the dev token as well as an admin session. It is asked for once per
   * tab rather than stored with the login, because it is a deployment secret that
   * happens to pass through the browser — not part of the user's identity.
   */
  const handleSeed = async () => {
    const devToken = getDevToken() ?? window.prompt(
      "Seeding requires the deployment's dev token (sent as X-Dev-Token).");
    if (!devToken) return;
    setDevToken(devToken.trim());

    setSeeding(true);
    setError(null);
    try {
      await api.seed(200, devToken.trim());
      await loadStats();
    } catch (e) {
      // 404 is what both a wrong token and a deployment without one return, by design:
      // the endpoint does not confirm its own existence to a caller who cannot use it.
      if (e.status === 404) {
        setDevToken(null);
        setError("Seeding is unavailable: the dev token was rejected, or this "
          + "deployment has no DEV_API_TOKEN configured.");
      } else {
        setError(e.message);
      }
    } finally {
      setSeeding(false);
    }
  };

  const chartData = toChartData(stats?.recentActivity);

  const cards = [
    { label: "Transactions Screened", value: stats?.totalScreened ?? 0, color: "var(--text-primary)" },
    { label: "Flagged", value: stats?.flagged ?? 0, color: "var(--yellow)" },
    { label: "Rejected", value: stats?.rejected ?? 0, color: "var(--red)" },
    { label: "Pass Rate", value: `${(stats?.passRate ?? 0).toFixed(1)}%`, color: "var(--green)" },
    { label: "Open Alerts", value: stats?.alertsOpen ?? 0, color: "var(--accent)" },
  ];

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Dashboard</h1>
        <div style={styles.headerActions}>
          <StreamBadge status={streamStatus} />
          {isAdmin && (
            <button type="button" style={styles.seedBtn} onClick={handleSeed} disabled={seeding}>
              {seeding ? "Seeding…" : "Seed 200 transactions"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.cardLabel}>{c.label}</div>
            <div style={{ ...styles.cardValue, color: c.color }}>{loading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.columns}>
        <div style={styles.chartCard}>
          <h2 style={styles.sectionTitle}>Recent screening activity</h2>
          {chartData.length === 0 ? (
            <p style={styles.emptyText}>
              No screening activity yet. Screen a transaction below to populate the ledger.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3140" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#5a5e70", fontSize: 11 }} stroke="#2d3140" />
                <YAxis
                  tick={{ fill: "#5a5e70", fontSize: 11 }}
                  stroke="#2d3140"
                  width={70}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99,102,241,0.08)" }}
                  contentStyle={{
                    background: "#1a1d27",
                    border: "1px solid #2d3140",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#8b8fa3" }}
                  formatter={(value, _key, item) => [
                    formatAmount(value),
                    item?.payload?.decision ?? "Amount",
                  ]}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((row, index) => (
                    <Cell key={index} fill={DECISION_COLORS[row.decision] ?? DECISION_COLORS.PASS} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={styles.feedCard}>
          <h2 style={styles.sectionTitle}>Latest alerts</h2>
          {liveAlerts.length === 0 ? (
            <p style={styles.emptyText}>
              Waiting for live alerts. Any screening that flags or rejects a transaction
              appears here instantly.
            </p>
          ) : (
            <div style={styles.feed}>
              {liveAlerts.map((alert) => (
                <div key={alert.id} style={styles.feedRow}>
                  <span
                    style={{
                      ...styles.feedDecision,
                      color: DECISION_COLORS[alert.decision] ?? "var(--text-primary)",
                    }}
                  >
                    {alert.decision}
                  </span>
                  <span style={styles.feedRule}>{alert.ruleName}</span>
                  <span style={styles.feedAmount}>{formatAmount(alert.amount)}</span>
                  <span style={styles.feedTime}>{formatTime(alert.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ScreenPanel onScreened={loadStats} />
    </div>
  );
}

function StreamBadge({ status }) {
  const color =
    status === "live"
      ? "var(--green)"
      : status === "reconnecting"
      ? "var(--yellow)"
      : "var(--text-muted)";

  const label =
    status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Connecting";

  return (
    <span style={styles.streamBadge}>
      <span style={{ ...styles.streamDot, background: color }} />
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
    </span>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 16,
    flexWrap: "wrap",
  },
  headerActions: { display: "flex", alignItems: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: 700 },
  seedBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  streamBadge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12,
    fontWeight: 500,
  },
  streamDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  error: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid var(--red)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "var(--red)",
    marginBottom: 20,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "20px 24px",
  },
  cardLabel: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 8,
    fontWeight: 500,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums",
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  chartCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
  },
  feedCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
  },
  sectionTitle: { fontSize: 16, fontWeight: 600, marginBottom: 20 },
  emptyText: { color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 },
  feed: { display: "flex", flexDirection: "column" },
  feedRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "9px 0",
    borderBottom: "1px solid var(--border)",
    fontSize: 13,
  },
  feedDecision: {
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: 12,
    width: 58,
    flexShrink: 0,
  },
  feedRule: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  feedAmount: {
    fontFamily: "var(--font-mono)",
    fontVariantNumeric: "tabular-nums",
    color: "var(--text-secondary)",
  },
  feedTime: {
    fontSize: 12,
    color: "var(--text-muted)",
    width: 72,
    textAlign: "right",
    flexShrink: 0,
  },
};
