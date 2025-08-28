// src/components/Navbar.jsx
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ROUTES } from "../router/routesConfig";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo.png";
import { useDefaultHomePath } from "../router/useDefaultHomePath";
import { ROLE_PAGES } from "../auth/permissions";

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navigate = useNavigate();
  const defaultHome = useDefaultHomePath();
  const location = useLocation();

  // anchor for positioning the portal menu
  const avatarBtnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Recompute menu position when opening / on scroll / resize
  useLayoutEffect(() => {
    if (!profileOpen) return;
    const compute = () => {
      const btn = avatarBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // Place the menu aligned to the avatar’s right edge, just below it
      setMenuPos({
        top: r.bottom + 8,                               // 8px gap
        right: Math.max(8, window.innerWidth - r.right), // anchor to right side
      });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    const onEsc = (e) => e.key === "Escape" && setProfileOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
      document.removeEventListener("keydown", onEsc);
    };
  }, [profileOpen]);

  const links = useMemo(() => {
    if (!role) return [];
    const allowedKeys = ROLE_PAGES[role] || [];
    const visible = ROUTES.filter(
      (r) => !r.hidden && r.path !== "/login" && r.path !== "/"
    );
    // map ROLE_PAGES order → first matching visible route per pageKey
    return allowedKeys
      .map((k) => visible.find((r) => r.pageKey === k))
      .filter(Boolean);
  }, [role]);

  // const displayName =
  //   user?.name || localStorage.getItem("name") || "User";
  // const displayId =
  //   user?.userId || localStorage.getItem("userId") || "—";
  // const displayRole =
  //   (role || localStorage.getItem("role") || "—").toLowerCase();

  const displayName = localStorage.getItem("name") || "User";
  const displayId = localStorage.getItem("userId") || "—";
  const displayRole = (localStorage.getItem("role") || "—").toLowerCase();

  // Initials strictly from NAME (not ID)
  const initials = (displayName || "U")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navLinkBase =
    "relative px-3 py-2 rounded-xl border text-sm font-medium transition " +
    "border-white/10 text-white/85 hover:text-white";
  const navLinkActive =
    "bg-gradient-to-r from-indigo-500/25 via-fuchsia-500/15 to-cyan-400/20 " +
    "shadow-[0_8px_24px_-8px_rgba(99,102,241,0.45)]";
  const navLinkIdle =
    "hover:bg-white/5 " +
    "after:absolute after:left-3 after:right-3 after:-bottom-[2px] after:h-[2px] after:rounded-full " +
    "after:bg-gradient-to-r after:from-indigo-500/0 after:via-indigo-400/60 after:to-indigo-500/0 " +
    "after:opacity-0 after:transition-opacity after:duration-300 " +
    "hover:after:opacity-100";

  return (
    <header className="sticky top-0 z-[120] w-full border-b border-white/10 bg-black/80 backdrop-blur-xl">
      {/* Ambient gradient glow strip */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-to-b from-indigo-600/25 via-purple-600/20 to-transparent blur-3xl" />
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="h-16 flex items-center justify-between gap-3">
          {/* Logo → home */}
          <button
            onClick={() => navigate(defaultHome || "/")}
            className="group relative flex items-center gap-3 focus:outline-none"
            aria-label="Go to home"
          >
            {/* subtle halo behind logo */}
            <span className="absolute -inset-3 rounded-xl bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-fuchsia-500/0 blur-xl opacity-0 group-hover:opacity-100 transition" />
            <img
              src={logo}
              alt="Logo"
              className="relative h-10 w-12 object-cover drop-shadow-[0_4px_20px_rgba(99,102,241,0.55)]"
            />
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-2">
            {links.map((r) => (
              <NavLink
                key={r.path}
                to={r.path}
                className={({ isActive }) =>
                  `${navLinkBase} ${isActive ? navLinkActive : navLinkIdle}`
                }
              >
                {r.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: hamburger + avatar */}
          <div className="flex items-center gap-2">
            {/* Hamburger */}
            <button
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/10 text-white/90 hover:bg-white/5 transition shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {!mobileOpen ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              )}
            </button>

            {/* Avatar button (anchor for portal) */}
            <button
              ref={avatarBtnRef}
              onClick={() => setProfileOpen((v) => !v)}
              className="relative flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              {/* glow ring */}
              <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-indigo-500/0 via-indigo-500/25 to-cyan-400/0 blur opacity-0 group-hover:opacity-100 pointer-events-none" />
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-sm font-semibold ring-1 ring-white/10 shadow-[0_6px_24px_-8px_rgba(99,102,241,0.7)]">
                {initials}
              </div>
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-white/70">
                <path
                  fill="currentColor"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.272l3.71-4.04a.75.75 0 111.1 1.02l-4.25 4.63a.75.75 0 01-1.1 0l-4.25-4.63a.75.75 0 01.02-1.06z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileOpen && (
          <div className="lg:hidden pb-3">
            <nav className="mt-2 grid gap-2">
              {links.map((r) => (
                <NavLink
                  key={r.path}
                  to={r.path}
                  className={({ isActive }) =>
                    `block ${navLinkBase} ${
                      isActive ? navLinkActive : navLinkIdle
                    }`
                  }
                >
                  {r.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* ===== Profile menu via PORTAL (always above navbar) ===== */}
      {profileOpen &&
        createPortal(
          // Backdrop to catch outside clicks
          <div
            className="fixed inset-0 z-[9999] bg-black/0"
            onClick={() => setProfileOpen(false)}
          >
            {/* Positioned menu wrapper */}
            <div
              style={{ top: menuPos.top, right: menuPos.right }}
              className="absolute"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gradient border shell */}
              <div className="relative p-[1px] rounded-2xl bg-gradient-to-br from-indigo-500/60 via-fuchsia-500/40 to-cyan-400/60 shadow-[0_12px_40px_-8px_rgba(99,102,241,0.55)]">
                {/* Inner card */}
                <div
                  role="menu"
                  className="rounded-2xl bg-[#0b1020]/95 backdrop-blur-xl border border-white/10 p-3"
                >
                  <div className="flex items-center gap-3 p-2">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-semibold ring-1 ring-white/10">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">
                        {displayName}
                      </div>
                      <div className="text-white/60 text-xs truncate">
                        ID: {displayId}
                      </div>
                    </div>
                  </div>

                  <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                  <div className="px-2 py-1">
                    <div className="text-white/70 text-xs mb-1">Role</div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-white/90 bg-white/5">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)]" />
                      <span className="text-sm capitalize">{displayRole}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={logout}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 text-red-200 hover:text-white hover:bg-red-500/20 px-3 py-2 transition"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                        <path strokeWidth="2" strokeLinecap="round" d="M15 12H3m12 0l-4-4m4 4l-4 4M21 3v18" />
                      </svg>
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
