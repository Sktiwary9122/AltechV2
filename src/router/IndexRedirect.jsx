import React from "react";
import { Navigate } from "react-router-dom";
import { useDefaultHomePath } from "./useDefaultHomePath";
import { useAuth } from "../auth/AuthContext";

export default function IndexRedirect() {
  const { role } = useAuth();
  const defaultHome = useDefaultHomePath();

  if (!role) return <Navigate to="/login" replace />;
  return <Navigate to={defaultHome || "/403"} replace />;
}
