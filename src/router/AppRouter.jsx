import { useMemo } from "react";
import { useRoutes } from "react-router-dom";
import { ROUTES } from "./routesConfig";
import { RequireAuth, RequirePage, RequireGuest } from "./guards";
import Layout from "../components/Layout";
import Login from "../pages/Login";
import IndexRedirect from "./IndexRedirect";

export default function AppRouter() {
  const routes = useMemo(() => {
    const securedRoutes = ROUTES
      .filter(
        (r) => r.path !== "/login" && r.pageKey !== "FORBIDDEN" && r.pageKey !== "NOT_FOUND"
      )
      .map((r) => ({
        path: r.path,
        element: (
          <RequireAuth>
            <RequirePage pageKey={r.pageKey}>{r.element}</RequirePage>
          </RequireAuth>
        ),
      }));

    const forbidden = ROUTES.find((r) => r.pageKey === "FORBIDDEN");
    const notFound = ROUTES.find((r) => r.pageKey === "NOT_FOUND");

    return [
      { path: "/login", element: <RequireGuest><Login /></RequireGuest> },

      // Root layout; index child decides where to go based on role
      {
        path: "/",
        element: (
          <RequireAuth>
            <Layout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <IndexRedirect /> },                 // ⬅️ role-aware home
          ...securedRoutes.filter((r) => r.path !== "/"),             // all other routes
        ],
      },

      // DO NOT mount a separate top-level "/" route anymore

      ...(forbidden ? [{ path: forbidden.path, element: forbidden.element }] : []),
      ...(notFound ? [{ path: notFound.path, element: notFound.element }] : []),
    ];
  }, []);

  return useRoutes(routes);
}
