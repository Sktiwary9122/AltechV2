// src/router/useDefaultHomePath.js (or .jsx)
import { useMemo } from "react";
import { ROUTES } from "./routesConfig";
import { useAuth } from "../auth/AuthContext";
import { ROLE_PAGES } from "../auth/permissions";

export function useDefaultHomePath() {
  const { role } = useAuth();

  return useMemo(() => {
    if (!role) return null;

    const orderedKeys = ROLE_PAGES[role] || [];

    // iterate by ROLE_PAGES order, and for each pageKey,
    // find the first visible (non-hidden), real route
    for (const key of orderedKeys) {
      const r = ROUTES.find(
        (route) =>
          route.pageKey === key &&
          !route.hidden &&
          route.path !== "/login" &&
          route.path !== "/" &&
          route.path !== "*"
      );
      if (r) return r.path;
    }

    // nothing matched → no home
    return null;
  }, [role]);
}
