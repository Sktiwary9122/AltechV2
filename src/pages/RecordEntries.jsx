// RecordEntries.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import Spinner from "../components/Spinner";
import DotLoader from "../components/DotLoader";
import Dropdown from "../components/Dropdown";

import { PAGES, ACTIONS, canAccessPage, canDo } from "../auth/permissions";

import {
  listRecordEntries,
  deleteRecordEntry,
  getRecordEntry,
} from "../api/api";

import SerialnumberPage from "./SerialnumberPage";

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";

function toISTDate(d) {
  if (!d) return "";
  try {
    const date = new Date(d);
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 60 * 60000);
    return ist.toLocaleDateString("en-GB");
  } catch {
    return "";
  }
}

export default function RecordEntries() {
  const navigate = useNavigate();
  const location = useLocation();

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const canView =
    canAccessPage(role, PAGES.RECORD_ENTRIES) ||
    canAccessPage(role, PAGES.VIEW_RECORD_ENTRIES);
  const canCreate = canDo(role, ACTIONS.RECORD_ENTRY_CREATE);
  const canEdit   = canDo(role, ACTIONS.RECORD_ENTRY_EDIT);
  const canDelete = canDo(role, ACTIONS.RECORD_ENTRY_DELETE);

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white pt-24">
        You don’t have permission to view Record Entries.
      </div>
    );
  }

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [packingStatus, setPackingStatus] = useState("");

  const [sortKey, setSortKey] = useState("entryDate_desc");
  const sortParams = useMemo(() => {
    switch (sortKey) {
      case "entryDate_asc": return { sortBy: "entryDate", order: "asc" };
      case "entryDate_desc": return { sortBy: "entryDate", order: "desc" };
      case "productSrNo_asc": return { sortBy: "productSrNo", order: "asc" };
      case "productSrNo_desc": return { sortBy: "productSrNo", order: "desc" };
      default: return { sortBy: "entryDate", order: "desc" };
    }
  }, [sortKey]);

  const [filtersVersion, setFiltersVersion] = useState(0);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        packingStatus: packingStatus || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
        sortBy: sortParams.sortBy,
        order: sortParams.order,
      };

      const res = await listRecordEntries(params);
      const payload = res?.data?.data || res?.data || {};
      const items = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [];

      // Fetch full details for all ids in parallel (single loader)
      const fulls = await Promise.all(
        items.map(async (it) => {
          try {
            const r = await getRecordEntry(it._id);
            return r?.data?.data || r?.data || null;
          } catch {
            return null;
          }
        })
      );

      const merged = items.map((it, i) => ({ ...it, ...(fulls[i] || {}) }));
      setRows(merged);

      const total = Number(payload.total || 0);
      const lim = Number(payload.limit || limit);
      setTotalPages(Math.max(1, Math.ceil(total / (lim || 1))));
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filtersVersion, sortParams]);

  const clearFilters = () => {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setPackingStatus("");
    setSortKey("entryDate_desc");
  };

  const [showSerialModal, setShowSerialModal] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);

  const openEdit = (row) => {
    navigate("/record-entries/form", {
      state: { mode: "edit", serial: row.productSrNo },
    });
  };

  const confirmDelete = (row) => setDeleteRow(row);

  const submitDelete = async () => {
    if (!deleteRow?._id) return;
    setDeleting(true);
    try {
      await deleteRecordEntry(deleteRow._id);
      toast.success("Record deleted");
      setDeleteRow(null);
      await fetchRows();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const [createdOverlay, setCreatedOverlay] = useState(null);
  useEffect(() => {
    const created = location.state?.createdRecord;
    if (created) {
      setCreatedOverlay(created);
      fetchRows();
      navigate(".", { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const sortLabel = {
    entryDate_desc: "Newest (entryDate)",
    entryDate_asc: "Oldest (entryDate)",
    productSrNo_asc: "Serial ↑",
    productSrNo_desc: "Serial ↓",
  }[sortKey];

  return (
    <div className="min-h-screen p-4 pt-12 text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
          <Spinner />
        </div>
      )}

      {/* Filters */}
      <div className="relative z-[60] flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
        <div className="w-full md:w-[70vw] bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 overflow-visible min-h-[132px]">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Search (serial / text)</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={inputCls}
                placeholder="e.g. SR-001, Stabilizer…"
              />
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
            <div className="relative">
              <Dropdown
                label="Packing Status"
                options={["Pending", "Processing", "Completed"]}
                value={packingStatus}
                onChange={setPackingStatus}
              />
            </div>
            <div className="md:col-span-2">
              <Dropdown
                label="Sort"
                options={[
                  "Newest (entryDate)",
                  "Oldest (entryDate)",
                  "Serial ↑",
                  "Serial ↓",
                ]}
                value={sortLabel}
                onChange={(v) => {
                  if (v.includes("Newest")) setSortKey("entryDate_desc");
                  else if (v.includes("Oldest")) setSortKey("entryDate_asc");
                  else if (v.includes("Serial ↑")) setSortKey("productSrNo_asc");
                  else setSortKey("productSrNo_desc");
                }}
                disableSearch
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setFiltersVersion((v) => v + 1)}
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
              onClick={() => setShowSerialModal(true)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
            >
              + Create Entry
            </button>
          </div>
        )}
      </div>

      {/* Wide table with grouped columns */}
      <div className="w-full h-[500px] overflow-x-auto rounded-xl bg-white/5 backdrop-blur-md border border-white/10 custom-scrollbar">
        <table className="min-w-[1900px] table-auto border-collapse">
          <thead>
            {/* Top header row */}
            <tr>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">#</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Serial</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Product</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Model</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Entry Date (IST)</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Packing Status</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Fault Reported</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Fault Analyzed</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Cosmetic Problem</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Action Taken</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">New Serial</th>
              <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Assigned To</th>

              {/* Grouped headers */}
              <th colSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-center">
                Parts Required
              </th>
              <th colSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-center">
                Parts Replaced
              </th>

              {canEdit && (
                <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Edit</th>
              )}
              {canDelete && (
                <th rowSpan={2} className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">Delete</th>
              )}
            </tr>
            {/* Sub header row for grouped columns */}
            <tr>
              <th className="sticky top-[2.56rem] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left">Industry</th>
              <th className="sticky top-[2.56rem] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left">Qty</th>
              <th className="sticky top-[2.56rem] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left">Industry</th>
              <th className="sticky top-[2.56rem] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left">Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    13 /* fixed cols */ +
                    4 /* grouped subcols */ +
                    (canEdit ? 1 : 0) +
                    (canDelete ? 1 : 0)
                  }
                  className="text-center text-white/80 px-4 py-6"
                >
                  No records found
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const reqLines = row.requirementLines || [];
                const repLines = row.replacementLines || [];
                const assigned = row.assignedTo || [];

                return (
                  <tr
                    key={row._id || idx}
                    className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors align-top"
                  >
                    <td className="border border-[#162134] px-4 py-2">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="border border-[#162134] px-4 py-2">{row.productSrNo}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.productName}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.modelNumber}</td>
                    <td className="border border-[#162134] px-4 py-2">{toISTDate(row.entryDate)}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.packingStatus || "-"}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.faultReported || "—"}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.faultAnalyzed || "—"}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.cosmeticProblem || "—"}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.actionTaken || "—"}</td>
                    <td className="border border-[#162134] px-4 py-2">{row.newSrNo || "—"}</td>

                    {/* Assigned To (stacked chips) */}
                    <td className="border border-[#162134] px-4 py-2">
                      {assigned.length ? (
                        <div className="space-y-1">
                          {assigned.map((a) => (
                            <div
                              key={a._id || a.userId}
                              className="px-2 py-1 rounded border border-white/20 bg-white/5 w-fit"
                            >
                              {a.userId}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Parts Required - Industry column */}
                    <td className="border border-[#162134] px-4 py-2">
                      {reqLines.length ? (
                        <div className="space-y-1">
                          {reqLines.map((r) => (
                            <div
                              key={r._id || r.industryName}
                              className="px-2 py-1 rounded border border-white/20 bg-white/5"
                            >
                              {r.industryName}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    {/* Parts Required - Qty column */}
                    <td className="border border-[#162134] px-4 py-2">
                      {reqLines.length ? (
                        <div className="space-y-1">
                          {reqLines.map((r) => (
                            <div
                              key={(r._id || r.industryName) + "-qty"}
                              className="px-2 py-1 rounded border border-white/20 bg-white/5 text-right"
                            >
                              {r.qtyRequired}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Parts Replaced - Industry */}
                    <td className="border border-[#162134] px-4 py-2">
                      {repLines.length ? (
                        <div className="space-y-1">
                          {repLines.map((r) => (
                            <div
                              key={r._id || `${r.industryName}-${r.partCode}`}
                              className="px-2 py-1 rounded border border-white/20 bg-white/5"
                            >
                              {r.industryName}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    {/* Parts Replaced - Qty */}
                    <td className="border border-[#162134] px-4 py-2">
                      {repLines.length ? (
                        <div className="space-y-1">
                          {repLines.map((r) => (
                            <div
                              key={(r._id || `${r.industryName}-${r.partCode}`) + "-qty"}
                              className="px-2 py-1 rounded border border-white/20 bg-white/5 text-right"
                            >
                              {r.qty}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

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
                          onClick={() => confirmDelete(row)}
                          className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
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

      {/* Serial number modal */}
      {showSerialModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0b1020] shadow-2xl max-h-[90vh] md:min-h-[80vh] overflow-y-auto ">
            <button
              onClick={() => setShowSerialModal(false)}
              className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/10 px-2.5 py-1 text-white/80 hover:bg-white/20"
            >
              Close
            </button>
            <SerialnumberPage />
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteRow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[96] flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg w-full max-w-sm">
            <h3 className="text-xl font-semibold mb-3">Confirm Delete</h3>
            <p className="mb-4">
              Delete entry <span className="font-semibold">{deleteRow.productSrNo}</span>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteRow(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
                Cancel
              </button>
              <button onClick={submitDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center justify-center">
                {deleting ? <DotLoader /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created overlay */}
      {createdOverlay && (
        <div className="fixed inset-0 z-[97] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white/10 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">
              Entry Saved
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white/90">
              <div><span className="text-white/70">Serial:</span> {createdOverlay.productSrNo || "-"}</div>
              <div><span className="text-white/70">Product:</span> {createdOverlay.productName || "-"}</div>
              <div><span className="text-white/70">Model:</span> {createdOverlay.modelNumber || "-"}</div>
              <div><span className="text-white/70">Packing Status:</span> {createdOverlay.packingStatus || "-"}</div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setCreatedOverlay(null)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
