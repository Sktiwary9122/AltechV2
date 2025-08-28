import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FiSearch, FiChevronDown, FiCheck, FiX } from "react-icons/fi";

export default function Dropdown({
  options = [],
  label,
  value,
  onChange,
  disabled = false,
  disableSearch = false,
  multiSelect = false,
  disableAdd = false,
  menuMaxHeight = 240,
  menuZIndex = 100000,
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filtered, setFiltered] = useState(options);
  const [chosen, setChosen] = useState(value || "");

  // Portal position state
  // When openUp is true we use "bottom", otherwise we use "top"
  const [menuPos, setMenuPos] = useState({
    left: 0,
    width: 0,
    top: null,     // number | null
    bottom: null,  // number | null
    openUp: false,
  });

  // Sync chosen with external value
  useEffect(() => {
    setChosen(value || "");
  }, [value]);

  // Filter options
  useEffect(() => {
    if (disableSearch) {
      setFiltered(options);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(q ? options.filter((o) => o.toLowerCase().includes(q)) : options);
  }, [search, options, disableSearch]);

  const computeMenuPos = () => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    const left = Math.max(8, Math.min(rect.left, vw - rect.width - 8));
    const width = rect.width;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const desired = Math.min(menuMaxHeight, 260);

    let openUp = false;
    if (spaceBelow < desired && spaceAbove > spaceBelow) openUp = true;

    // No animation for position: we set final coordinates immediately
    if (openUp) {
      // anchor above using bottom so we don't need menu height
      const bottom = vh - rect.top + 6; // 6px gap
      setMenuPos({ left, width, top: null, bottom, openUp: true });
    } else {
      const top = rect.bottom + 6; // 6px gap
      setMenuPos({ left, width, top, bottom: null, openUp: false });
    }
  };

  // Open/close handlers
  const openMenu = () => {
    if (disabled) return;
    computeMenuPos(); // compute BEFORE opening: prevents visible jump
    setOpen(true);
  };
  const closeMenu = () => {
    setOpen(false);
    setSearch("");
  };

  // Recompute position while open (scroll/resize)
  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => computeMenuPos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menuMaxHeight]);

  // Close on outside click (works with portal)
  useEffect(() => {
    const onDown = (e) => {
      if (!open) return;
      const t = e.target;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const select = (val) => {
    setSearch("");
    if (!multiSelect) {
      setChosen(val);
      setOpen(false);
      onChange?.(val);
      return;
    }
    const list = chosen
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = list.indexOf(val);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(val);
    const newStr = list.join(", ");
    setChosen(newStr);
    onChange?.(newStr);
  };

  const suggestion = search.trim();

  return (
    <div className="w-full font-sans">
      {label && (
        <label className="block text-white font-medium mb-1">{label}</label>
      )}

      {/* Custom scrollbar for the menu list */}
      <style>{`
        .scrollbar-custom { scrollbar-width: thin; scrollbar-color: #6366f1 transparent; }
        .scrollbar-custom::-webkit-scrollbar { width: 6px; }
        .scrollbar-custom::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-custom::-webkit-scrollbar-thumb { background-color: #6366f1; border-radius: 3px; }
      `}</style>

      {/* Trigger */}
      <div className="relative">
        <div
          type="button"
          ref={triggerRef}
          disabled={disabled}
          onClick={() => (open ? closeMenu() : openMenu())}
          className={`
            w-full flex items-center justify-between
            px-4 py-2 rounded-lg
            bg-gradient-to-r from-indigo-500 to-indigo-600 text-white
            shadow-lg hover:shadow-xl transition-shadow
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          {open && !disableSearch ? (
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 w-5 h-5 -translate-y-1/2 text-white/80"/>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search…"
                className="w-full bg-transparent pl-10 pr-8 py-1 outline-none text-white placeholder-white/70"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !filtered.length && suggestion && !disableAdd) {
                    select(suggestion);
                  }
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <span className="truncate">
              {chosen || <span className="text-white/70">Select…</span>}
            </span>
          )}
          <FiChevronDown
            className={`w-6 h-6 transform transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Portal menu — NO position animation; only optional fade */}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuPos.left,
              width: menuPos.width,
              top: menuPos.top ?? "auto",
              bottom: menuPos.bottom ?? "auto",
              zIndex: menuZIndex,
            }}
            className="
              bg-black/80 backdrop-blur-3xl
              border border-indigo-400 rounded-lg shadow-2xl
              /* Only fade (no top/left animation) */
              transition-opacity duration-100 opacity-100
            "
          >
            <ul
              className="max-h-[240px] overflow-y-auto divide-y divide-indigo-100 scrollbar-custom"
              style={{ maxHeight: menuMaxHeight }}
            >
              {filtered.map((opt) => {
                const isSelected = multiSelect
                  ? chosen
                      .split(",")
                      .map((s) => s.trim())
                      .includes(opt)
                  : chosen === opt;

                return (
                  <li
                    key={opt}
                    onClick={() => select(opt)}
                    className={`
                      flex items-center justify-between px-4 py-2 cursor-pointer
                      hover:bg-indigo-100 hover:text-indigo-800 hover:rounded-md transition
                      ${
                        isSelected
                          ? "bg-gradient-to-r from-indigo-200 to-indigo-300 text-indigo-900 font-medium rounded-md"
                          : "text-white"
                      }
                    `}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <FiCheck className="w-5 h-5 text-indigo-600" />}
                  </li>
                );
              })}
            </ul>

            {!filtered.length && !disableSearch && suggestion && !disableAdd && (
              <div className="p-3 border-t border-indigo-200">
                <button
                  type="button"
                  onClick={() => select(suggestion)}
                  className="
                    flex items-center justify-center w-full py-2 bg-indigo-600 hover:bg-indigo-700
                    text-white rounded-lg transition
                  "
                >
                  <FiCheck className="w-5 h-5 mr-2" />
                  Add “{suggestion}”
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
