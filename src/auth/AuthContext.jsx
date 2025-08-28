// src/auth/AuthContext.jsx
import { createContext, useContext, useMemo, useState, useEffect } from "react";
import {
  canAccessPage as canAccessPageRaw,
  canDo as canDoRaw,
} from "./permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // On first load, hydrate from localStorage
  useEffect(() => {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    if (role) setUser({ id: "me", name: "You", role });
  }, []);

  // Accept either a role string or a full user object
  const login = (payload) => {
    const role =
      (typeof payload === "string" ? payload : payload?.role || "").toLowerCase();
    if (role) localStorage.setItem("role", role);
    setUser({ id: "me", name: "You", role });
  };

  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("authToken");
    setUser(null);
  };

  const value = useMemo(() => {
    const role = user?.role || (localStorage.getItem("role") || "").toLowerCase();
    return {
      user,
      role,
      login,
      logout,
      // alias raw helpers so there's no identifier clash
      canAccessPage: (pageKey) => canAccessPageRaw(role, pageKey),
      can: (action) => canDoRaw(role, action),
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
