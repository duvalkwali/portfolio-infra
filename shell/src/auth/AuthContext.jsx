import { createContext, useCallback, useContext, useMemo, useState } from "react";
import * as api from "../api/client";
import { clearAuth, readAuth, writeAuth } from "./store";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Seeded straight from localStorage so a reload restores the session without a flash
  // of the login screen.
  const [auth, setAuth] = useState(() => readAuth());

  const signIn = useCallback(async (username, password) => {
    const response = await api.login(username, password);
    const next = { token: response.token, role: response.role };
    writeAuth(next);
    setAuth(next);
    return next;
  }, []);

  const signUp = useCallback(async (username, password, role) => {
    const response = await api.register(username, password, role);
    const next = { token: response.token, role: response.role };
    writeAuth(next);
    setAuth(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

  const value = useMemo(
    () => ({
      token: auth?.token ?? null,
      role: auth?.role ?? null,
      isAuthenticated: Boolean(auth?.token),
      isAdmin: auth?.role === "ADMIN",
      signIn,
      signUp,
      signOut,
    }),
    [auth, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
