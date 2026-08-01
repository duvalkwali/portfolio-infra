import { useState } from "react";
import * as api from "../api/client";

const DECISION_COLORS = {
  PASS: "var(--green)",
  FLAG: "var(--yellow)",
  REJECT: "var(--red)",
};

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF"];
const CHANNELS = ["web", "mobile", "api", "branch", "atm"];

function newTransactionId() {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Manual screening form. Useful for demos and for generating audit entries on demand —
 * an amount over 10,000 trips the FLAG rule and over 50,000 the REJECT rule.
 */
export default function ScreenPanel({ onScreened }) {
  const [form, setForm] = useState({
    transactionId: newTransactionId(),
    senderId: "ACC-1001",
    receiverId: "ACC-2002",
    amount: "12500.00",
    currency: "USD",
    channel: "web",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await api.screen({
        transactionId: form.transactionId,
        senderId: form.senderId,
        receiverId: form.receiverId,
        amount: Number(form.amount),
        currency: form.currency,
        timestamp: new Date().toISOString(),
        metadata: { channel: form.channel },
      });
      setResult(response);
      // A fresh id so the next submission is a distinct transaction.
      setForm((current) => ({ ...current, transactionId: newTransactionId() }));
      onScreened?.(response);
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Screen a transaction</h2>
      <form onSubmit={handleSubmit}>
        <div style={styles.grid}>
          <Field label="Sender" value={form.senderId} onChange={update("senderId")} />
          <Field label="Receiver" value={form.receiverId} onChange={update("receiverId")} />
          <Field label="Amount" value={form.amount} onChange={update("amount")} type="number" step="0.01" />
          <Select label="Currency" value={form.currency} onChange={update("currency")} options={CURRENCIES} />
          <Select label="Channel" value={form.channel} onChange={update("channel")} options={CHANNELS} />
        </div>

        <div style={styles.footer}>
          <code style={styles.txId}>{form.transactionId}</code>
          <button type="submit" style={styles.submit} disabled={busy}>
            {busy ? "Screening…" : "Screen"}
          </button>
        </div>
      </form>

      {error && <div style={styles.error}>{error}</div>}

      {result && (
        <div style={styles.result}>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Decision</span>
            <span
              style={{
                ...styles.decision,
                color: DECISION_COLORS[result.decision] ?? "var(--text-primary)",
              }}
            >
              {result.decision}
            </span>
          </div>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Triggered rules</span>
            <span style={styles.resultValue}>
              {result.triggeredRules?.length ? result.triggeredRules.join(", ") : "none"}
            </span>
          </div>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Audit entry</span>
            <span style={styles.resultValue}>#{result.auditEntryId}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input style={styles.input} {...props} required />
    </label>
  );
}

function Select({ label, options, ...props }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select style={styles.input} {...props}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

const styles = {
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
  },
  title: { fontSize: 16, fontWeight: 600, marginBottom: 20 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  field: { display: "flex", flexDirection: "column" },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  input: {
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "9px 11px",
    fontSize: 14,
    color: "var(--text-primary)",
    fontFamily: "var(--font-sans)",
    outline: "none",
    width: "100%",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 16,
  },
  txId: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  submit: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  error: {
    marginTop: 16,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid var(--red)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--red)",
  },
  result: {
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid var(--border)",
  },
  resultRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    fontSize: 13,
    gap: 16,
  },
  resultLabel: { color: "var(--text-secondary)" },
  resultValue: {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    textAlign: "right",
  },
  decision: {
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: 15,
  },
};
