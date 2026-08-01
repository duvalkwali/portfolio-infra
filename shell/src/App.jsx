import { Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import Rules from "./pages/Rules";
import AuditLedger from "./pages/AuditLedger";
import Performance from "./pages/Performance";
import Login from "./pages/Login";

function Sidebar() {
  const { role, signOut } = useAuth();

  const links = [
    { to: "/", label: "Dashboard", icon: "◈" },
    { to: "/alerts", label: "Alerts", icon: "▲" },
    { to: "/rules", label: "Rules", icon: "⚙" },
    { to: "/audit", label: "Audit Ledger", icon: "⛓" },
    { to: "/performance", label: "Performance", icon: "⚡" },
  ];

  return (
    <nav style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoIcon}>◇</span>
        <span style={styles.logoText}>LedgerGuard</span>
      </div>
      <div style={styles.nav}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            style={({ isActive }) => ({
              ...styles.navLink,
              background: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "#fff" : "var(--text-secondary)",
            })}
          >
            <span style={styles.navIcon}>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </div>
      <div style={styles.account}>
        <div style={styles.roleRow}>
          <span style={styles.roleLabel}>Signed in as</span>
          <span style={styles.roleBadge}>{role}</span>
        </div>
        <button type="button" style={styles.signOut} onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

/** Sends unauthenticated visitors to the login screen, remembering where they were headed. */
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function Console() {
  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/audit" element={<AuditLedger />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <Console />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
  },
  sidebar: {
    width: 240,
    background: "var(--bg-secondary)",
    borderRight: "1px solid var(--border)",
    padding: "24px 0",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
  },
  logo: {
    padding: "0 24px 32px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    fontSize: 24,
    color: "var(--accent)",
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "0 12px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    transition: "background 0.15s",
  },
  navIcon: {
    fontSize: 16,
    width: 20,
    textAlign: "center",
    fontFamily: "var(--font-mono)",
  },
  account: {
    marginTop: "auto",
    padding: "16px 24px 0",
    borderTop: "1px solid var(--border)",
  },
  roleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  roleLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  roleBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--accent)",
  },
  signOut: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-secondary)",
    padding: "7px 12px",
    fontSize: 13,
    width: "100%",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  main: {
    flex: 1,
    padding: 32,
    overflowY: "auto",
  },
};
