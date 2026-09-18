import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const from = location.state?.from ?? "/";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "login") {
        await signIn(username, password);
      } else {
        // The backend lets the very first account claim ADMIN. Once one exists it
        // rejects the claim, so fall back to a plain ANALYST registration.
        await signUp(username, password, "ADMIN").catch((e) => {
          if (e.status !== 403) throw e;
          return signUp(username, password);
        });
      }
      // Replace so the back button does not land on the login screen again.
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◇</span>
          <span style={styles.logoText}>LedgerGuard</span>
        </div>
        <p style={styles.subtitle}>
          {mode === "login"
            ? "Sign in to the screening console."
            : "Create an account. The first account created becomes the administrator."}
        </p>

        <label style={styles.label} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          style={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <label style={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          style={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.submit} disabled={busy}>
          {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          style={styles.toggle}
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 32,
    display: "flex",
    flexDirection: "column",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  logoIcon: { fontSize: 24, color: "var(--accent)" },
  logoText: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" },
  subtitle: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 24,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  input: {
    background: "var(--bg-primary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: "var(--text-primary)",
    fontFamily: "var(--font-sans)",
    marginBottom: 16,
    outline: "none",
  },
  error: {
    background: "rgba(255,77,94,0.10)",
    border: "1px solid var(--red)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--red)",
    marginBottom: 16,
  },
  submit: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "11px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  toggle: {
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 13,
    marginTop: 16,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
};
