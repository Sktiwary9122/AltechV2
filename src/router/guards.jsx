// src/router/guards.jsx
import { Navigate, Outlet } from "react-router-dom";
import { Suspense } from "react";
import { useAuth } from "../auth/AuthContext";
import { canAccessPage as canAccessPageRaw } from "../auth/permissions";
import { useDefaultHomePath } from "./useDefaultHomePath";
export function RequireAuth({ children }) {
  const { role } = useAuth();               // ⬅️ use role
  if (!role) return <Navigate to="/login" replace />;
  return children || <Outlet />;
}

export function RequirePage({ pageKey, children }) {
  const { role } = useAuth();               // ⬅️ use role
  if (!role) return <Navigate to="/login" replace />;
  if (!canAccessPageRaw(role, pageKey)) return <Navigate to="/403" replace />;
  return <Suspense fallback={null}>{children || <Outlet />}</Suspense>;
}

export function RequireGuest({ children }) {
  const { role } = useAuth();               // ⬅️ use role
  const defaultHome = useDefaultHomePath();
  if (role) return <Navigate to={defaultHome || "/403"} replace />;
  return children || <Outlet />;
}
