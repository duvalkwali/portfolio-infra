import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import Rules from "./pages/Rules";
import AuditLedger from "./pages/AuditLedger";
import Performance from "./pages/Performance";

function Sidebar() {
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
    </nav>
  );
}

export default function App() {
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
        </Routes>
      </main>
    </div>
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
  main: {
    flex: 1,
    padding: 32,
    overflowY: "auto",
  },
};
