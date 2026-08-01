import { useState, useEffect, useCallback } from "react";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";

const OPERATORS = [
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "EQUALS",
  "NOT_EQUALS",
];

const OPERATOR_SYMBOLS = {
  GREATER_THAN: ">",
  GREATER_THAN_OR_EQUAL: "≥",
  LESS_THAN: "<",
  LESS_THAN_OR_EQUAL: "≤",
  EQUALS: "=",
  NOT_EQUALS: "≠",
};

const ACTIONS = ["FLAG", "REJECT"];

const EMPTY_FORM = {
  name: "",
  field: "amount",
  operator: "GREATER_THAN",
  threshold: "10000",
  action: "FLAG",
  enabled: true,
};

export default function Rules() {
  const { isAdmin } = useAuth();
  const [rules, setRules] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await api.getRules());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      field: rule.field,
      operator: rule.operator,
      threshold: String(rule.threshold),
      action: rule.action,
      enabled: rule.enabled,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      field: form.field,
      operator: form.operator,
      threshold: Number(form.threshold),
      action: form.action,
      enabled: form.enabled,
    };

    try {
      if (editingId == null) {
        await api.createRule(payload);
      } else {
        await api.updateRule(editingId, payload);
      }
      closeForm();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.name}"? Screening will stop applying it.`)) {
      return;
    }
    setError(null);
    try {
      await api.deleteRule(rule.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const update = (key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Screening Rules</h1>
        {isAdmin && (
          <button type="button" style={styles.addBtn} onClick={openCreate}>
            + Add Rule
          </button>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {isAdmin && formOpen && (
        <form style={styles.form} onSubmit={handleSubmit}>
          <h2 style={styles.formTitle}>{editingId == null ? "New rule" : `Editing rule #${editingId}`}</h2>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Name</span>
              <input style={styles.input} value={form.name} onChange={update("name")} required />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Field</span>
              <input style={styles.input} value={form.field} onChange={update("field")} required />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Operator</span>
              <select style={styles.input} value={form.operator} onChange={update("operator")}>
                {OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Threshold</span>
              <input
                style={styles.input}
                type="number"
                step="0.01"
                value={form.threshold}
                onChange={update("threshold")}
                required
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Action</span>
              <select style={styles.input} value={form.action} onChange={update("action")}>
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...styles.field, justifyContent: "flex-end" }}>
              <span style={styles.label}>Enabled</span>
              <label style={styles.toggleRow}>
                <input type="checkbox" checked={form.enabled} onChange={update("enabled")} />
                <span style={styles.toggleText}>{form.enabled ? "Active" : "Disabled"}</span>
              </label>
            </label>
          </div>
          <div style={styles.formActions}>
            <button type="button" style={styles.cancelBtn} onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>
              {saving ? "Saving…" : editingId == null ? "Create rule" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {loading && rules.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Loading rules…</p>
        </div>
      ) : rules.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>
            No rules configured. Rules define the conditions that flag transactions for
            review — amount thresholds, velocity limits, and other derived signals.
          </p>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={styles.colId}>ID</span>
            <span style={styles.colName}>Name</span>
            <span style={styles.colCondition}>Condition</span>
            <span style={styles.colAction}>Action</span>
            <span style={styles.colStatus}>Status</span>
            {isAdmin && <span style={styles.colControls} />}
          </div>
          {rules.map((rule) => (
            <div key={rule.id} style={styles.row}>
              <span style={{ ...styles.colId, fontFamily: "var(--font-mono)" }}>{rule.id}</span>
              <span style={styles.colName}>{rule.name}</span>
              <span style={{ ...styles.colCondition, fontFamily: "var(--font-mono)", fontSize: 13 }}>
                {rule.field} {OPERATOR_SYMBOLS[rule.operator] ?? rule.operator}{" "}
                {Number(rule.threshold).toLocaleString()}
              </span>
              <span
                style={{
                  ...styles.colAction,
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: 12,
                  color: rule.action === "REJECT" ? "var(--red)" : "var(--yellow)",
                }}
              >
                {rule.action}
              </span>
              <span style={styles.colStatus}>
                <span
                  style={{
                    ...styles.badge,
                    background: rule.enabled ? "var(--green)" : "var(--text-muted)",
                  }}
                >
                  {rule.enabled ? "Active" : "Disabled"}
                </span>
              </span>
              {isAdmin && (
                <span style={styles.colControls}>
                  <button type="button" style={styles.smallBtn} onClick={() => openEdit(rule)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.smallBtn, color: "var(--red)" }}
                    onClick={() => handleDelete(rule)}
                  >
                    Delete
                  </button>
                </span>
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
  error: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid var(--red)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "var(--red)",
    marginBottom: 20,
  },
  form: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  formTitle: { fontSize: 16, fontWeight: 600, marginBottom: 20 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 38,
  },
  toggleText: { fontSize: 14, color: "var(--text-secondary)" },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 20,
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-secondary)",
    padding: "9px 18px",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  saveBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 20px",
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
  table: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  tableHeader: {
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
  colId: { width: 50 },
  colName: { flex: 1, minWidth: 140 },
  colCondition: { width: 260 },
  colAction: { width: 90, textAlign: "center" },
  colStatus: { width: 110, textAlign: "center" },
  colControls: { width: 130, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" },
  badge: {
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    color: "#000",
  },
  smallBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-secondary)",
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
};
