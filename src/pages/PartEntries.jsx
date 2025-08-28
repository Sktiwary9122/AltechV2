// src/pages/PartEntriesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  listPartEntries,         // GET /part-entries (filters)
  bulkCreatePartEntries,   // POST /part-entries/bulk
  updatePartEntry,         // PATCH /part-entries/:id
  deletePartEntry,         // DELETE /part-entries/:id
  listIndustryCodes,       // GET /parts-required/industry-codes
} from "../api/api";
import Spinner from "../components/Spinner";
import DotLoader from "../components/DotLoader";
import Dropdown from "../components/Dropdown";

// permissions.js helpers
import { PAGES, ACTIONS, canAccessPage, canDo } from "../auth/permissions";

// ---------- UI helpers ----------
const inputCls =
  "w-full px-4 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";

// ---------- Date helpers (IST) ----------
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Return today's date as YYYY-MM-DD in IST
function todayIST() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

// Convert a YYYY-MM-DD (date-only) to an ISO string pinned to +05:30
function toISTISOString(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return undefined;
  return `${yyyy_mm_dd}T00:00:00.000+05:30`;
}

// Format ISO for <input type="date"> as IST date (YYYY-MM-DD)
function toInputDateIST(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

// ---------- Search helpers ----------
function rowMatchesQuery(row, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const fields = [
    row.invoiceNumber,
    row.industryName,
    row.partCode,
    String(row.quantity ?? ""),
    String(row.rate ?? ""),
  ];
  return fields.some((f) => (f || "").toString().toLowerCase().includes(needle));
}

// ---------- Component ----------
export default function PartEntries() {
  /* -------------------- Access via permissions.js -------------------- */
  const role = (localStorage.getItem("role") || "").toLowerCase();

  const canView =
    canAccessPage(role, PAGES.PART_ENTRIES) ||
    canAccessPage(role, PAGES.VIEW_PART_ENTRIES);

  const canCreate = canDo(role, ACTIONS.PART_ENTRY_CREATE);
  const canEdit   = canDo(role, ACTIONS.PART_ENTRY_EDIT);
  const canDelete = canDo(role, ACTIONS.PART_ENTRY_DELETE);

  /* ------------------------ State -------------------------- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // server filters
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // server sort
  const [sortKey, setSortKey] = useState("purchaseDate_desc");
  const sortParams = useMemo(() => {
    switch (sortKey) {
      case "purchaseDate_asc":  return { sortBy: "purchaseDate", order: "asc" };
      case "quantity_desc":     return { sortBy: "quantity", order: "desc" };
      case "quantity_asc":      return { sortBy: "quantity", order: "asc" };
      case "rate_desc":         return { sortBy: "rate", order: "desc" };
      case "rate_asc":          return { sortBy: "rate", order: "asc" };
      default:                  return { sortBy: "purchaseDate", order: "desc" };
    }
  }, [sortKey]);

  // industry → codes map
  const [industryMap, setIndustryMap] = useState({});
  const industryOptions = useMemo(() => Object.keys(industryMap), [industryMap]);

  // Create modal + confirmation
  const [showCreate, setShowCreate] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit/Delete modals
  const [showEdit, setShowEdit] = useState(null);
  const [showDelete, setShowDelete] = useState(null);

  // Bulk header
  const [bulkHeader, setBulkHeader] = useState({
    invoiceNumber: "",
    purchaseDate: todayIST(),
  });

  // Bulk rows
  const emptyItem = { industryName: "", partCode: "", quantity: "", rate: "" };
  const [bulkItems, setBulkItems] = useState([{ ...emptyItem }]);

  // Version bump to re-fetch when user clicks Apply
  const [filtersVersion, setFiltersVersion] = useState(0);

  /* ------------------------ Fetch -------------------------- */
  const fetchEntries = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        dateFrom: dateFrom ? toISTISOString(dateFrom) : undefined,
        dateTo: dateTo ? toISTISOString(dateTo) : undefined,
        page,
        limit,
        sortBy: sortParams.sortBy,
        order: sortParams.order,
      };
      const res = await listPartEntries(params);
      const payload = res?.data?.data || res?.data || {};
      const list = Array.isArray(payload.items) ? payload.items : [];
      setRows(list);
      const total = Number(payload.total || 0);
      const lim = Number(payload.limit || limit);
      setTotalPages(Math.max(1, Math.ceil(total / (lim || 1))));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load part entries");
    } finally {
      setLoading(false);
    }
  };

  const fetchIndustryMap = async () => {
    try {
      const res = await listIndustryCodes();
      const items = res?.data?.data?.items || res?.data?.items || [];
      const map = {};
      items.forEach((obj) => {
        if (!obj || typeof obj !== "object") return;
        Object.entries(obj).forEach(([name, codes]) => {
          map[name] = Array.isArray(codes) ? codes : [];
        });
      });
      setIndustryMap(map);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load industries");
    }
  };

  useEffect(() => {
    fetchIndustryMap();
  }, []);

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filtersVersion, sortParams]);

  /* -------------- Local search fallback (no API hit) -------------- */
  const localMatches = useMemo(() => {
    if (!q.trim()) return [];
    return rows.filter((r) => rowMatchesQuery(r, q));
  }, [rows, q]);

  const displayRows = useMemo(() => {
    // If we already have matches on the page, show them
    if (q.trim() && localMatches.length > 0) return localMatches;
    return rows;
  }, [rows, q, localMatches]);

  /* ---------------------- UI Helpers ----------------------- */
  const clearFilters = () => {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setSortKey("purchaseDate_desc");
  };

  const openCreate = () => {
    setBulkHeader({
      invoiceNumber: "",
      purchaseDate: todayIST(),
    });
    setBulkItems([{ ...emptyItem }]);
    setConfirmMode(false);
    setShowCreate(true);
  };

  const codesForIndustry = (industry) => industryMap[industry] || [];

  // Is (industry, code) already chosen in another row?
  const isPairTakenElsewhere = (industry, code, currentIndex) => {
    if (!industry || !code) return false;
    return bulkItems.some(
      (it, i) =>
        i !== currentIndex &&
        (it.industryName || "") === industry &&
        (it.partCode || "") === code
    );
  };

  // Options filtered to avoid duplicates across rows (keep current selection available)
  const filteredCodeOptions = (industry, idx) => {
    const all = codesForIndustry(industry);
    const taken = new Set(
      bulkItems
        .filter((_, i) => i !== idx)
        .map((it) => `${it.industryName}__${it.partCode}`)
    );
    return all.filter((code) => !taken.has(`${industry}__${code}`) || bulkItems[idx].partCode === code);
  };

  // Validate bulk
  const validateBulk = () => {
    const errs = [];
    if (!bulkHeader.invoiceNumber.trim()) errs.push("Invoice number is required");
    if (!Array.isArray(bulkItems) || bulkItems.length === 0)
      errs.push("Please add at least one item");

    bulkItems.forEach((it, idx) => {
      const row = idx + 1;
      if (!it.industryName.trim()) errs.push(`Row ${row}: Industry is required`);
      if (!it.partCode.trim()) errs.push(`Row ${row}: Part code is required`);
      if (!it.quantity || Number(it.quantity) <= 0)
        errs.push(`Row ${row}: Quantity must be > 0`);
      if (it.rate === "" || Number(it.rate) < 0)
        errs.push(`Row ${row}: Rate must be ≥ 0`);

      // ensure pair uniqueness
      if (isPairTakenElsewhere(it.industryName, it.partCode, idx)) {
        errs.push(`Row ${row}: Duplicate (industry, part code) in this invoice`);
      }

      // ensure code belongs to industry (if industry has known codes)
      const validCodes = codesForIndustry(it.industryName);
      if (it.partCode && validCodes.length && !validCodes.includes(it.partCode)) {
        errs.push(`Row ${row}: Selected part code not valid for industry`);
      }
    });
    return errs;
  };

  const reviewBulk = (e) => {
    e?.preventDefault?.();
    const errs = validateBulk();
    if (errs.length) return toast.warn(errs[0]);
    setConfirmMode(true);
  };

  const submitBulk = async () => {
    const errs = validateBulk();
    if (errs.length) return toast.warn(errs[0]);

    const payload = {
      invoiceNumber: bulkHeader.invoiceNumber.trim(),
      ...(bulkHeader.purchaseDate
        ? { purchaseDate: toISTISOString(bulkHeader.purchaseDate) }
        : {}),
      items: bulkItems.map((it) => ({
        industryName: it.industryName.trim(),
        partCode: it.partCode.trim(),
        quantity: Number(it.quantity),
        rate: Number(it.rate),
      })),
    };

    setSubmitting(true);
    try {
      await bulkCreatePartEntries(payload);
      toast.success("Entries created");
      setShowCreate(false);
      setConfirmMode(false);
      await fetchEntries();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        "Bulk create failed (check invoice, items, and that pairs exist in PartRequired)";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------- Edit / Delete --------------------- */
  const [editForm, setEditForm] = useState({
    quantity: "",
    rate: "",
    purchaseDate: "",
    invoiceNumber: "",
  });

  const openEdit = (row) => {
    if (!canEdit) return;
    setShowEdit(row);
    setEditForm({
      quantity: row.quantity ?? "",
      rate: row.rate ?? "",
      purchaseDate: toInputDateIST(row.purchaseDate),
      invoiceNumber: row.invoiceNumber || "",
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!canEdit || !showEdit?._id) return;

    const updates = {};
    if (editForm.quantity !== "" && editForm.quantity !== null)
      updates.quantity = Number(editForm.quantity);
    if (editForm.rate !== "" && editForm.rate !== null)
      updates.rate = Number(editForm.rate);
    if (editForm.purchaseDate)
      updates.purchaseDate = toISTISOString(editForm.purchaseDate);
    if (editForm.invoiceNumber?.trim?.())
      updates.invoiceNumber = editForm.invoiceNumber.trim();

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      return;
    }

    setSubmitting(true);
    try {
      await updatePartEntry(showEdit._id, updates);
      toast.success("Entry updated");
      setShowEdit(null);
      await fetchEntries();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete = (row) => {
    if (!canDelete) return;
    setShowDelete(row);
  };

  const submitDelete = async () => {
    if (!canDelete || !showDelete?._id) return;
    setSubmitting(true);
    try {
      await deletePartEntry(showDelete._id);
      toast.success("Entry deleted");
      setShowDelete(null);
      await fetchEntries();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------ UI ----------------------------- */
  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white pt-24">
        You don’t have permission to view Part Entries.
      </div>
    );
  }

  const sortLabel = {
    purchaseDate_desc: "Newest (purchaseDate)",
    purchaseDate_asc: "Oldest (purchaseDate)",
    quantity_desc: "Quantity ↓",
    quantity_asc: "Quantity ↑",
    rate_desc: "Rate ↓",
    rate_asc: "Rate ↑",
  }[sortKey];

  return (
    <div className="min-h-screen p-4 pt-12 text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Spinner />
        </div>
      )}

      {/* Header / Filters */}
      <div className="relative z-[60] flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <div className="w-full md:w-auto bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Search (invoice / text)</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={inputCls}
                placeholder="e.g. INV-2025"
              />
              {q.trim() && localMatches.length > 0 && (
                <div className="mt-1 text-xs text-white/70">
                  Showing {localMatches.length} local match{localMatches.length > 1 ? "es" : ""} on this page.
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="md:col-span-2">
              <Dropdown
                label="Sort"
                options={[
                  "Newest (purchaseDate)",
                  "Oldest (purchaseDate)",
                  "Quantity ↓",
                  "Quantity ↑",
                  "Rate ↓",
                  "Rate ↑",
                ]}
                value={sortLabel}
                onChange={(v) => {
                  if (v.includes("Newest")) setSortKey("purchaseDate_desc");
                  else if (v.includes("Oldest")) setSortKey("purchaseDate_asc");
                  else if (v.includes("Quantity ↓")) setSortKey("quantity_desc");
                  else if (v.includes("Quantity ↑")) setSortKey("quantity_asc");
                  else if (v.includes("Rate ↓")) setSortKey("rate_desc");
                  else setSortKey("rate_asc");
                }}
                disableSearch
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => {
                  // Only hit API if no local matches (or no query)
                  if (q.trim() && localMatches.length > 0) {
                    toast.info("Showing local matches. Clear search or change page to fetch again.");
                    return;
                  }
                  setFiltersVersion((v) => v + 1);
                }}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {canCreate && (
          <div className="flex justify-end">
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
            >
              + Create
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr>
              {[
                "#",
                "Industry Name",
                "Part Code",
                "Quantity",
                "Rate",
                "Invoice #",
                "Purchase Date",
                "Batch Remaining",
                ...(canEdit ? ["Edit"] : []),
                ...(canDelete ? ["Delete"] : []),
              ].map((h) => (
                <th
                  key={h}
                  className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={8 + (canEdit ? 1 : 0) + (canDelete ? 1 : 0)} className="text-center text-white/80 px-4 py-6">
                  No entries found
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => (
                <tr
                  key={row._id || idx}
                  className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors"
                >
                  <td className="border border-[#162134] px-4 py-2">{(page - 1) * limit + idx + 1}</td>
                  <td className="border border-[#162134] px-4 py-2">{row.industryName}</td>
                  <td className="border border-[#162134] px-4 py-2">{row.partCode}</td>
                  <td className="border border-[#162134] px-4 py-2">{row.quantity}</td>
                  <td className="border border-[#162134] px-4 py-2">{row.rate}</td>
                  <td className="border border-[#162134] px-4 py-2">{row.invoiceNumber}</td>
                  <td className="border border-[#162134] px-4 py-2">
                    {row.purchaseDate
                      ? new Date(row.purchaseDate).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" })
                      : ""}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">{row.batchRemaining ?? "-"}</td>

                  {canEdit && (
                    <td className="border border-[#162134] px-4 py-2 text-center">
                      <button
                        onClick={() => openEdit(row)}
                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                  {canDelete && (
                    <td className="border border-[#162134] px-4 py-2 text-center">
                      <button
                        onClick={() => openDelete(row)}
                        className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-3 mt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1 rounded bg-gray-600 disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-white/80">Page {page} / {totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1 rounded bg-gray-600 disabled:opacity-50"
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>

      {/* Create (Bulk) Modal — taller, darker, non-clipping dropdowns */}
      {showCreate && !confirmMode && (
        <div className="fixed inset-0 z-[120] bg-black/70 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            {/* NOTE: overflow-visible so dropdown menus can escape the card */}
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-2xl w-full max-w-4xl  overflow-visible">
              <h3 className="text-xl font-semibold text-center mb-4">Create Entries</h3>

              {/* Header fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1">Invoice Number *</label>
                  <input
                    value={bulkHeader.invoiceNumber}
                    onChange={(e) => setBulkHeader((h) => ({ ...h, invoiceNumber: e.target.value }))}
                    className={inputCls}
                    placeholder="INV-2025-001"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={bulkHeader.purchaseDate}
                    onChange={(e) => setBulkHeader((h) => ({ ...h, purchaseDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3 pr-1 overflow-visible">
                {bulkItems.map((it, idx) => {
                  const codeOptions = filteredCodeOptions(it.industryName, idx);
                  return (
                    <div key={idx} className="rounded-lg border border-white/10 p-3 overflow-visible">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {/* High z-index & relative so the menu stacks above nearby content */}
                        <div className="md:col-span-2 relative overflow-visible">
                          <Dropdown
                            label={`Industry * (Entry ${idx + 1})`}
                            options={industryOptions}
                            value={it.industryName}
                            onChange={(val) => {
                              setBulkItems((arr) => {
                                const next = [...arr];
                                next[idx] = { ...next[idx], industryName: val };
                                // reset/guard partCode on industry change
                                const valid = filteredCodeOptions(val, idx);
                                if (!valid.includes(next[idx].partCode)) {
                                  next[idx].partCode = "";
                                }
                                return next;
                              });
                            }}
                            // If your Dropdown supports a portal, uncomment the next line:
                            // menuPortalTarget={document.body}
                            // menuZIndex={10000}
                            disableAdd
                          />
                        </div>

                        <div className="relative overflow-visible z-[200]">
                          <Dropdown
                            label="Part Code *"
                            options={codeOptions}
                            value={it.partCode}
                            onChange={(val) => {
                              if (isPairTakenElsewhere(it.industryName, val, idx)) {
                                toast.warn("That industry + part code is already added.");
                                return;
                              }
                              setBulkItems((arr) => {
                                const next = [...arr];
                                next[idx] = { ...next[idx], partCode: val };
                                return next;
                              });
                            }}
                            // menuPortalTarget={document.body}
                            // menuZIndex={10000}
                            disableAdd
                          />
                        </div>

                        <div>
                          <label className="block text-sm mb-1">Quantity *</label>
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) =>
                              setBulkItems((arr) => {
                                const next = [...arr];
                                next[idx] = { ...next[idx], quantity: e.target.value };
                                return next;
                              })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Rate *</label>
                          <input
                            type="number"
                            value={it.rate}
                            onChange={(e) =>
                              setBulkItems((arr) => {
                                const next = [...arr];
                                next[idx] = { ...next[idx], rate: e.target.value };
                                return next;
                              })
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-2">
                        {bulkItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBulkItems((arr) => arr.filter((_, i) => i !== idx))
                            }
                            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setBulkItems((arr) => [...arr, { ...emptyItem }])}
                  className="px-4 py-2 rounded-lg border border-white/20 hover:bg-white/5"
                >
                  + Add Item
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reviewBulk}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation (full-screen overlay) */}
      {showCreate && confirmMode && (
        <div className="fixed inset-0 z-[95] bg-black/70 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-auto">
              <h3 className="text-xl font-semibold text-center mb-4">Confirm</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-white/70 text-sm">Invoice Number</div>
                  <div className="text-white text-lg font-semibold">{bulkHeader.invoiceNumber || "-"}</div>
                </div>
                <div>
                  <div className="text-white/70 text-sm">Purchase Date</div>
                  <div className="text-white text-lg font-semibold">
                    {bulkHeader.purchaseDate
                      ? new Date(toISTISOString(bulkHeader.purchaseDate))
                          .toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" })
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
                <table className="min-w-full table-auto border-collapse">
                  <thead>
                    <tr>
                      {["#", "Industry Name", "Part Code", "Quantity", "Rate"].map((h) => (
                        <th key={h} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bulkItems.map((it, idx) => (
                      <tr key={idx} className="odd:bg-white/5 even:bg-transparent">
                        <td className="border border-[#162134] px-4 py-2">{idx + 1}</td>
                        <td className="border border-[#162134] px-4 py-2">{it.industryName || "-"}</td>
                        <td className="border border-[#162134] px-4 py-2">{it.partCode || "-"}</td>
                        <td className="border border-[#162134] px-4 py-2">{it.quantity || "-"}</td>
                        <td className="border border-[#162134] px-4 py-2">{it.rate || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  onClick={() => setConfirmMode(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitBulk}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
                >
                  {submitting ? <DotLoader /> : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-2xl w-full max-w-xl">
            <h3 className="text-xl font-semibold text-center mb-4">Edit Part Entry</h3>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Rate</label>
                  <input
                    type="number"
                    value={editForm.rate}
                    onChange={(e) => setEditForm((f) => ({ ...f, rate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={editForm.purchaseDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, purchaseDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Invoice #</label>
                  <input
                    value={editForm.invoiceNumber}
                    onChange={(e) => setEditForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEdit(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center">
                  {submitting ? <DotLoader /> : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-semibold mb-3">Confirm Delete</h3>
            <p className="mb-4">
              Delete entry <span className="font-semibold">{showDelete.invoiceNumber}</span> for{" "}
              <span className="font-semibold">{showDelete.industryName}</span> (
              <span className="font-semibold">{showDelete.partCode}</span>)?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDelete(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
                Cancel
              </button>
              <button onClick={submitDelete} disabled={submitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center justify-center">
                {submitting ? <DotLoader /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
