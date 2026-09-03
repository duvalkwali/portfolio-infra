import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";

const STATUS_COLORS = {
  OPEN: "var(--review)",
  REVIEWED: "var(--accent)",
  RESOLVED: "var(--cleared)",
};

const DECISION_COLORS = {
  PASS: "var(--green)",
  FLAG: "var(--yellow)",
  REJECT: "var(--red)",
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "RESOLVED", label: "Resolved" },
];

const PAGE_SIZE = 20;

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function Alerts() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("OPEN");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAlerts({ status: status || undefined, page, size: PAGE_SIZE }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = async (id) => {
    setResolvingId(id);
    setError(null);
    try {
      await api.updateAlert(id, "RESOLVED");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setResolvingId(null);
    }
  };

  const alerts = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Alert Queue</h1>
        <div style={styles.filters}>
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setStatus(filter.value);
                setPage(0);
              }}
              style={{
                ...styles.filterBtn,
                background: status === filter.value ? "var(--accent)" : "transparent",
                color: status === filter.value ? "#fff" : "var(--text-secondary)",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading && alerts.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Loading alerts…</p>
        </div>
      ) : alerts.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            No alerts match this filter. Alerts appear here when a screened transaction
            trips a rule.
          </p>
        </div>
      ) : (
        <>
          <div style={styles.table}>
            <div style={styles.header}>
              <span style={styles.colId}>ID</span>
              <span style={styles.colTx}>Transaction</span>
              <span style={styles.colRule}>Rule</span>
              <span style={styles.colDecision}>Decision</span>
              <span style={styles.colAmount}>Amount</span>
              <span style={styles.colStatus}>Status</span>
              <span style={styles.colTime}>Created</span>
              <span style={styles.colAction} />
            </div>
            {alerts.map((a) => (
              <div key={a.id} style={styles.row}>
                <span style={{ ...styles.colId, fontFamily: "var(--font-mono)" }}>{a.id}</span>
                <span style={{ ...styles.colTx, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {a.transactionId}
                </span>
                <span style={styles.colRule}>{a.ruleName}</span>
                <span
                  style={{
                    ...styles.colDecision,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    fontSize: 12,
                    color: DECISION_COLORS[a.decision] ?? "var(--text-primary)",
                  }}
                >
                  {a.decision}
                </span>
                <span
                  style={{
                    ...styles.colAmount,
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Number(a.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span style={styles.colStatus}>
                  <span
                    style={{
                      ...styles.badge,
                      background: STATUS_COLORS[a.status] ?? "var(--text-muted)",
                    }}
                  >
                    {a.status}
                  </span>
                </span>
                <span style={{ ...styles.colTime, color: "var(--text-secondary)" }}>
                  {formatDateTime(a.createdAt)}
                </span>
                <span style={styles.colAction}>
                  {a.status !== "RESOLVED" && (
                    <button
                      type="button"
                      style={styles.resolveBtn}
                      onClick={() => handleResolve(a.id)}
                      disabled={resolvingId === a.id}
                    >
                      {resolvingId === a.id ? "…" : "Resolve"}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div style={styles.pager}>
            <span style={styles.pagerInfo}>
              Page {page + 1} of {Math.max(totalPages, 1)} · {totalElements} alerts
            </span>
            <div style={styles.pagerButtons}>
              <button
                type="button"
                style={styles.pagerBtn}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                ← Previous
              </button>
              <button
                type="button"
                style={styles.pagerBtn}
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1 || loading}
              >
                Next →
              </button>
            </div>
          </div>
        </>
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
    gap: 16,
    flexWrap: "wrap",
  },
  title: { fontSize: 24, fontWeight: 700 },
  filters: { display: "flex", gap: 4 },
  filterBtn: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  error: {
    background: "rgba(255,77,94,0.10)",
    border: "1px solid var(--red)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "var(--red)",
    marginBottom: 20,
  },
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
  colId: { width: 60 },
  colTx: { width: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  colRule: { flex: 1, minWidth: 120 },
  colDecision: { width: 90, textAlign: "center" },
  colAmount: { width: 120, textAlign: "right" },
  colStatus: { width: 110, textAlign: "center" },
  colTime: { width: 180, textAlign: "right", fontSize: 12 },
  colAction: { width: 96, textAlign: "right" },
  badge: {
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    color: "#000",
  },
  resolveBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-secondary)",
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  pager: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    gap: 16,
    flexWrap: "wrap",
  },
  pagerInfo: { fontSize: 13, color: "var(--text-secondary)" },
  pagerButtons: { display: "flex", gap: 8 },
  pagerBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-secondary)",
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
};
