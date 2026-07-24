import { useState, useEffect } from "react";

const MOCK_STATS = {
  totalScreened: 0,
  flagged: 0,
  cleared: 0,
  avgRiskScore: 0,
};

export default function Dashboard() {
  const [stats, setStats] = useState(MOCK_STATS);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Transactions Screened", value: stats.totalScreened, color: "var(--text-primary)" },
    { label: "Flagged", value: stats.flagged, color: "var(--red)" },
    { label: "Cleared", value: stats.cleared, color: "var(--green)" },
    { label: "Avg Risk Score", value: stats.avgRiskScore.toFixed(1), color: "var(--yellow)" },
  ];

  return (
    <div>
      <h1 style={styles.title}>Dashboard</h1>
      <div style={styles.grid}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.cardLabel}>{c.label}</div>
            <div style={{ ...styles.cardValue, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={styles.placeholder}>
        <p style={styles.placeholderText}>
          Risk distribution chart and recent activity will render here once the
          backend is connected.
        </p>
      </div>
    </div>
  );
}

const styles = {
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 24,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 32,
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
  placeholder: {
    background: "var(--bg-card)",
    border: "1px dashed var(--border)",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
  },
  placeholderText: {
    color: "var(--text-muted)",
    fontSize: 14,
  },
};
