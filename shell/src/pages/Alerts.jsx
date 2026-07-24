import { useState, useEffect } from "react";

const STATUS_COLORS = {
  PENDING: "var(--review)",
  CLEARED: "var(--cleared)",
  BLOCKED: "var(--blocked)",
};

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={styles.title}>Alert Queue</h1>
      {alerts.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            No alerts yet. Alerts appear here when transactions exceed risk
            thresholds.
          </p>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.header}>
            <span style={styles.colId}>ID</span>
            <span style={styles.colAccount}>Account</span>
            <span style={styles.colAmount}>Amount</span>
            <span style={styles.colScore}>Risk</span>
            <span style={styles.colStatus}>Status</span>
            <span style={styles.colTime}>Time</span>
          </div>
          {alerts.map((a) => (
            <div key={a.id} style={styles.row}>
              <span style={{ ...styles.colId, fontFamily: "var(--font-mono)" }}>
                {a.id}
              </span>
              <span style={styles.colAccount}>{a.accountId}</span>
              <span style={{ ...styles.colAmount, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                ${a.amount?.toFixed(2)}
              </span>
              <span style={{ ...styles.colScore, fontFamily: "var(--font-mono)", color: a.riskScore > 70 ? "var(--red)" : a.riskScore > 40 ? "var(--yellow)" : "var(--green)" }}>
                {a.riskScore}
              </span>
              <span style={styles.colStatus}>
                <span style={{ ...styles.badge, background: STATUS_COLORS[a.status] || "var(--text-muted)" }}>
                  {a.status}
                </span>
              </span>
              <span style={{ ...styles.colTime, color: "var(--text-secondary)" }}>
                {a.createdAt}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontSize: 24, fontWeight: 700, marginBottom: 24 },
  empty: {
    background: "var(--bg-card)",
    border: "1px dashed var(--border)",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
  },
  emptyText: { color: "var(--text-muted)", fontSize: 14 },
  table: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  row: {
    display: "flex",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    alignItems: "center",
    fontSize: 14,
  },
  colId: { width: 80 },
  colAccount: { flex: 1 },
  colAmount: { width: 120, textAlign: "right" },
  colScore: { width: 80, textAlign: "center" },
  colStatus: { width: 100, textAlign: "center" },
  colTime: { width: 160, textAlign: "right" },
  badge: {
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    color: "#000",
  },
};
