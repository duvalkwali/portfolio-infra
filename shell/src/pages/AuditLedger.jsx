import { useState, useEffect } from "react";
import * as api from "../api/client";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function AuditLedger() {
  const [entries, setEntries] = useState([]);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getAudit(20)
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      setVerifyResult(await api.verifyAudit());
    } catch (e) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Audit Ledger</h1>
        <button style={styles.verifyBtn} onClick={handleVerify} disabled={verifying}>
          {verifying ? "Verifying..." : "Verify Chain"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {verifyResult && (
        <div
          style={{
            ...styles.verifyBanner,
            borderColor: verifyResult.valid ? "var(--green)" : "var(--red)",
            background: verifyResult.valid ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          }}
        >
          <span style={{ color: verifyResult.valid ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
            {verifyResult.valid ? "Chain intact" : "Tampering detected"}
          </span>
          {verifyResult.entries != null && (
            <span style={styles.verifyDetail}>
              {verifyResult.entries} entries verified in {verifyResult.durationMs}ms
            </span>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            The audit ledger is a hash-chained log of every screening decision.
            Each entry stores the SHA-256 hash of the previous entry, making
            tampering detectable. Entries appear here once the screening engine
            is running.
          </p>
        </div>
      ) : (
        <div style={styles.chain}>
          {entries.map((e, i) => (
            <div key={e.id} style={styles.block}>
              <div style={styles.blockHeader}>
                <span style={styles.blockIndex}>#{e.id}</span>
                <span style={styles.blockTime}>{formatDateTime(e.createdAt)}</span>
              </div>
              <div style={styles.hashRow}>
                <span style={styles.hashLabel}>hash</span>
                <code style={styles.hash}>{e.hash?.slice(0, 16)}...</code>
              </div>
              <div style={styles.hashRow}>
                <span style={styles.hashLabel}>prev</span>
                <code style={styles.hash}>
                  {e.previousHash ? `${e.previousHash.slice(0, 16)}...` : "genesis"}
                </code>
              </div>
              <div style={styles.action}>{e.action}</div>
              {i < entries.length - 1 && (
                <div style={styles.connector}>
                  <div style={styles.connectorLine} />
                </div>
              )}
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
  verifyBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  verifyBanner: {
    border: "1px solid",
    borderRadius: 12,
    padding: "14px 20px",
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verifyDetail: {
    fontSize: 13,
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
  },
  empty: {
    background: "var(--bg-card)",
    border: "1px dashed var(--border)",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
  },
  emptyText: { color: "var(--text-muted)", fontSize: 14 },
  error: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid var(--red)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "var(--red)",
    marginBottom: 20,
  },
  chain: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  block: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    position: "relative",
  },
  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  blockIndex: {
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--accent)",
  },
  blockTime: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  hashRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  hashLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    width: 36,
    fontWeight: 600,
  },
  hash: {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  action: {
    marginTop: 8,
    fontSize: 13,
    color: "var(--text-secondary)",
  },
  connector: {
    display: "flex",
    justifyContent: "center",
    padding: "4px 0",
    position: "relative",
    zIndex: 1,
    marginBottom: -20,
    marginTop: 8,
  },
  connectorLine: {
    width: 2,
    height: 20,
    background: "var(--accent)",
  },
};
