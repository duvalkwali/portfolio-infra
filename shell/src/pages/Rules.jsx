import { useState, useEffect } from "react";

export default function Rules() {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then(setRules)
      .catch(() => {});
  }, []);

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Screening Rules</h1>
        <button style={styles.addBtn}>+ Add Rule</button>
      </div>
      {rules.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            No rules configured. Rules define the conditions that flag
            transactions for review — amount thresholds, velocity limits,
            geographic risk, and merchant categories.
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {rules.map((r) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.ruleName}>{r.name}</span>
                <span
                  style={{
                    ...styles.badge,
                    background: r.enabled ? "var(--green)" : "var(--text-muted)",
                  }}
                >
                  {r.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <div style={styles.ruleType}>{r.type}</div>
              <div style={styles.ruleConfig}>
                <code style={styles.code}>{JSON.stringify(r.config, null, 2)}</code>
              </div>
              <div style={styles.ruleWeight}>
                Weight: <span style={styles.weightValue}>{r.weight}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: 700 },
  addBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  empty: {
    background: "var(--bg-card)",
    border: "1px dashed var(--border)",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
  },
  emptyText: { color: "var(--text-muted)", fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ruleName: { fontWeight: 600, fontSize: 15 },
  badge: {
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    color: "#000",
  },
  ruleType: {
    fontSize: 12,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 12,
  },
  ruleConfig: {
    background: "var(--bg-primary)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    overflowX: "auto",
  },
  code: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-secondary)",
    whiteSpace: "pre",
  },
  ruleWeight: {
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  weightValue: {
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--accent)",
  },
};
