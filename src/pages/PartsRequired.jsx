// src/pages/PartsRequiredPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Spinner from "../components/Spinner";
import DotLoader from "../components/DotLoader";
import Dropdown from "../components/Dropdown";
import {
  // NEW: availability fetch (all parts with availability)
  getPartsAvailabilityByIndustry, // GET /parts-required/availability (all) -> { success, data:{ items, total } }
  listPartsRequiredHeaderSubheader, // GET /parts-required/unique -> NEW nested shape
  createPartRequired, // POST /parts-required
  updatePartRequired, // PATCH /parts-required/:id
  deletePartRequired, // DELETE /parts-required/:id
} from "../api/api";

// --- helpers ---
const inputCls =
  "w-full px-4 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border-2 border-indigo-400 transition-colors " +
  "focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/60";

// normalize the nested catalog into a convenient map
function normalizeCatalog(nestedRes) {
  // nestedRes: { success, data: { items: [ { "<header>": { type, industryNames?[], subHeaders?[] } }, ... ] } }
  const items = nestedRes?.data?.items || nestedRes?.data || [];
  const map = {};

  items.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    Object.entries(entry).forEach(([headerName, detail]) => {
      if (!headerName || !detail || typeof detail !== "object") return;
      const type =
        (detail.type || "").toLowerCase() === "tree" ? "tree" : "flat";

      if (type === "flat") {
        const industryArr = Array.isArray(detail.industryNames)
          ? detail.industryNames
          : [];
        const industries = {};
        industryArr.forEach((obj) => {
          if (!obj || typeof obj !== "object") return;
          Object.entries(obj).forEach(([indName, codes]) => {
            industries[indName] = Array.isArray(codes) ? codes : [];
          });
        });
        map[headerName] = { type, industries };
      } else {
        const subsArr = Array.isArray(detail.subHeaders)
          ? detail.subHeaders
          : [];
        const subHeaders = {};
        subsArr.forEach((subObj) => {
          if (!subObj || typeof subObj !== "object") return;
          Object.entries(subObj).forEach(([subHeaderName, subDetail]) => {
            const industryArr = Array.isArray(subDetail?.industryNames)
              ? subDetail.industryNames
              : [];
            const industries = {};
            industryArr.forEach((obj) => {
              if (!obj || typeof obj !== "object") return;
              Object.entries(obj).forEach(([indName, codes]) => {
                industries[indName] = Array.isArray(codes) ? codes : [];
              });
            });
            subHeaders[subHeaderName] = { industries };
          });
        });
        map[headerName] = { type, subHeaders };
      }
    });
  });

  return map;
}

export default function PartsRequired() {
  const [items, setItems] = useState([]); // table rows (from availability)
  const [catalog, setCatalog] = useState({}); // normalized from /parts-required/unique

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // form state (no 'isActive' in UI/payload)
  const emptyForm = {
    header: "",
    type: "flat",
    subHeader: "",
    industryName: "",
    partCode: "",
    msl: "",
    note: "",
  };
  const [form, setForm] = useState(emptyForm);

  // role gates
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const canCreate = role === "admin";
  const canEdit = role === "admin";
  const canDelete = role === "admin";

  /* ========================= Derived options ========================= */
  const headerOptions = useMemo(() => Object.keys(catalog || {}), [catalog]);

  const isExistingHeader = useMemo(
    () =>
      !!form.header &&
      headerOptions.some(
        (h) => (h || "").toLowerCase() === (form.header || "").toLowerCase()
      ),
    [headerOptions, form.header]
  );

  const lockedType = useMemo(() => {
    if (!isExistingHeader) return null;
    const found = headerOptions.find(
      (h) => (h || "").toLowerCase() === (form.header || "").toLowerCase()
    );
    return found ? catalog[found]?.type || null : null;
  }, [isExistingHeader, headerOptions, catalog, form.header]);

  const subHeaderOptions = useMemo(() => {
    if (!isExistingHeader) return [];
    const found = headerOptions.find(
      (h) => (h || "").toLowerCase() === (form.header || "").toLowerCase()
    );
    const meta = found ? catalog[found] : null;
    if (!meta || meta.type !== "tree") return [];
    return Object.keys(meta.subHeaders || {});
  }, [isExistingHeader, headerOptions, catalog, form.header]);

  const industryOptions = useMemo(() => {
    if (!isExistingHeader) return [];
    const found = headerOptions.find(
      (h) => (h || "").toLowerCase() === (form.header || "").toLowerCase()
    );
    const meta = found ? catalog[found] : null;
    if (!meta) return [];

    if (meta.type === "flat") {
      return Object.keys(meta.industries || {});
    }
    if (!form.subHeader) return [];
    const sh = subHeaderOptions.find(
      (s) => (s || "").toLowerCase() === (form.subHeader || "").toLowerCase()
    );
    if (!sh) return [];
    return Object.keys(meta.subHeaders?.[sh]?.industries || {});
  }, [
    isExistingHeader,
    headerOptions,
    catalog,
    form.header,
    form.subHeader,
    subHeaderOptions,
  ]);

  const partCodeOptions = useMemo(() => {
    if (!isExistingHeader) return [];
    const found = headerOptions.find(
      (h) => (h || "").toLowerCase() === (form.header || "").toLowerCase()
    );
    const meta = found ? catalog[found] : null;
    if (!meta || !form.industryName) return [];

    if (meta.type === "flat") {
      return meta.industries?.[form.industryName] || [];
    }
    const sh = subHeaderOptions.find(
      (s) => (s || "").toLowerCase() === (form.subHeader || "").toLowerCase()
    );
    if (!sh) return [];
    return meta.subHeaders?.[sh]?.industries?.[form.industryName] || [];
  }, [
    isExistingHeader,
    headerOptions,
    catalog,
    form.header,
    form.subHeader,
    form.industryName,
    subHeaderOptions,
  ]);

  /* ========================= Fetchers ========================= */
  // NEW: load from availability endpoint instead of listPartsRequired
  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const res = await getPartsAvailabilityByIndustry();
      // Expected: { success, data:{ items:[...], total } }
      const list = Array.isArray(res?.data?.items)
        ? res.data.items
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setItems(list);
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to load availability"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await listPartsRequiredHeaderSubheader();
      setCatalog(normalizeCatalog(res));
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load catalog");
    }
  };

  useEffect(() => {
    fetchAvailability();
    fetchCatalog();
  }, []);

  /* ========================= Search =========================== */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const fields = [
        it.header,
        it.subHeader,
        it.industryName,
        it.partCode,
        typeof it.msl === "number" ? String(it.msl) : it.msl,
        typeof it.available === "number" ? String(it.available) : it.available,
      ].map((v) => (v ?? "").toString().toLowerCase());
      return fields.some((f) => f.includes(q));
    });
  }, [items, search]);

  /* ========================= Handlers ========================= */
  const setFormField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onChangeHeader = (val) => {
    setForm((f) => ({
      ...f,
      header: val,
      type: null,
      subHeader: "",
      industryName: "",
      partCode: "",
    }));

    const exists = headerOptions.find(
      (h) => (h || "").toLowerCase() === (val || "").toLowerCase()
    );
    if (exists) {
      const t = catalog[exists]?.type || "flat";
      setForm((f) => ({ ...f, type: t }));
    } else {
      setForm((f) => ({ ...f, type: f.type || "flat" }));
    }
  };

  const onChangeType = (val) => {
    if (isExistingHeader) return;
    const t = val === "tree" ? "tree" : "flat";
    setForm((f) => ({
      ...f,
      type: t,
      subHeader: t === "tree" ? f.subHeader : "",
    }));
  };

  const onChangeSubHeader = (val) =>
    setForm((f) => ({ ...f, subHeader: val, industryName: "", partCode: "" }));
  const onChangeIndustry = (val) =>
    setForm((f) => ({ ...f, industryName: val, partCode: "" }));

  const onChangePartCode = (val) => setFormField("partCode", val);
  const onChangeMsl = (val) => setFormField("msl", val);

  const resetForm = () => setForm(emptyForm);

  // Validations
  const validateForm = (payload) => {
    const errs = [];
    if (!payload.header.trim()) errs.push("Header is required");
    if (!payload.type) errs.push("Type is required");
    if (payload.type === "tree" && !payload.subHeader.trim())
      errs.push("Subheader is required for Type 'tree'");
    if (!payload.industryName.trim()) errs.push("Industry Name is required");
    if (!payload.partCode.trim()) errs.push("Part Code is required");
    const mslNum = Number(payload.msl);
    if (!Number.isFinite(mslNum) || mslNum < 0)
      errs.push("MSL must be a non-negative number");
    return errs;
  };

  /* =========================== CREATE ========================= */
  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const draft = {
      header: (form.header || "").trim(),
      type: form.type || "flat",
      subHeader: (form.type === "tree" ? form.subHeader : "")?.trim(),
      industryName: (form.industryName || "").trim(),
      partCode: (form.partCode || "").trim(),
      msl: form.msl,
      note: (form.note || "").trim(),
    };

    const errs = validateForm(draft);
    if (errs.length) return toast.warn(errs[0]);

    setSubmitting(true);
    try {
      await createPartRequired({
        header: draft.header,
        type: draft.type,
        ...(draft.type === "tree" ? { subHeader: draft.subHeader } : {}),
        industryName: draft.industryName,
        partCode: draft.partCode,
        msl: Number(draft.msl),
        ...(draft.note ? { note: draft.note } : {}),
      });
      toast.success("Part created");
      setShowCreate(false);
      resetForm();
      await fetchAvailability(); // refresh availability table
      await fetchCatalog(); // refresh catalog for cascades
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 409
          ? "Part already exists for (industryName, partCode)"
          : "Create failed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================ EDIT ========================== */
  const openEdit = (row) => {
    setShowEdit(row);
    setForm({
      header: row.header || "",
      type: row.type || "flat",
      subHeader: row.type === "tree" ? row.subHeader || "" : "",
      industryName: row.industryName || "",
      partCode: row.partCode || "",
      msl: typeof row.msl === "number" ? String(row.msl) : row.msl || "",
      note: row.note || "",
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!showEdit?._id) return toast.error("Invalid record (_id missing)");

    const draft = {
      header: (form.header || "").trim(),
      type: form.type || "flat",
      subHeader: (form.type === "tree" ? form.subHeader : "")?.trim(),
      industryName: (form.industryName || "").trim(),
      partCode: (form.partCode || "").trim(),
      msl: form.msl,
      note: (form.note || "").trim(),
    };

    const errs = validateForm(draft);
    if (errs.length) return toast.warn(errs[0]);

    const updates = {};
    const cmp = (k, curr, orig) => {
      if ((curr ?? "") !== (orig ?? "")) updates[k] = curr;
    };

    cmp("header", draft.header, showEdit.header || "");
    if ((showEdit.type || "flat") !== draft.type) updates.type = draft.type;

    if (draft.type === "tree") {
      const newSub = draft.subHeader;
      if ((showEdit.subHeader || "") !== newSub) updates.subHeader = newSub;
    } else if (showEdit.subHeader) {
      updates.subHeader = "";
    }

    cmp("industryName", draft.industryName, showEdit.industryName || "");
    cmp("partCode", draft.partCode, showEdit.partCode || "");

    const mslNum = Number(draft.msl);
    if (Number.isFinite(mslNum) && mslNum !== Number(showEdit.msl)) {
      updates.msl = mslNum;
    }

    cmp("note", draft.note, showEdit.note || "");

    if (Object.keys(updates).length === 0) {
      return toast.info("No changes to save");
    }

    setSubmitting(true);
    try {
      await updatePartRequired(showEdit._id, updates);
      toast.success("Part updated");
      setShowEdit(null);
      resetForm();
      await fetchAvailability();
      await fetchCatalog();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 409
          ? "Another part exists with same (industryName, partCode)"
          : "Update failed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================== DELETE ========================= */
  const openDelete = (row) => setShowDelete(row);

  const handleDelete = async () => {
    if (!showDelete?._id) return toast.error("Invalid record (_id missing)");
    setSubmitting(true);
    try {
      await deletePartRequired(showDelete._id);
      toast.success("Part deleted");
      setShowDelete(null);
      await fetchAvailability();
      await fetchCatalog();
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          "Delete failed (might be referenced by stock, entries, or records)"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================== UI ========================= */
  return (
    <div className="min-h-screen p-4 pt-24 text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Spinner />
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Parts Creation</h1>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder=" header, industry, part code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls}
          />
          {canCreate && (
            <button
              onClick={openCreate}
              className="w-32 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
            >
              + Create
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-auto custom-scrollbar max-h-[530x]  rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr>
              {[
                "#",
                "Item Type",
                "Item Name",
                "Industry Name",
                "Part Code",
                "MSL(Minimum quantity)",
                "In Stock",
                "Edit",
                "Delete",
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-white/80 px-4 py-6">
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row._id}
                  className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors"
                >
                  <td className="border border-[#162134] px-4 py-2">
                    {idx + 1}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {row.header || "-"}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {row.subHeader || "-"}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {row.industryName || "-"}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {row.partCode || "-"}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {typeof row.msl === "number" ? row.msl : "-"}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {typeof row.available === "number" ? row.available : "-"}
                  </td>

                  {/* Edit */}
                  <td className="border border-[#162134] px-4 py-2 text-center">
                    <button
                      disabled={!canEdit}
                      onClick={() => canEdit && openEdit(row)}
                      className={`px-3 py-1 rounded ${
                        canEdit
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Edit
                    </button>
                  </td>

                  {/* Delete */}
                  <td className="border border-[#162134] px-4 py-2 text-center">
                    <button
                      disabled={!canDelete}
                      onClick={() => canDelete && openDelete(row)}
                      className={`px-3 py-1 rounded ${
                        canDelete
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[120] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <h3 className="text-xl font-semibold text-center mb-4">
                Create Part
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Header */}
                <Dropdown
                  label="Item Type *"
                  options={headerOptions}
                  value={form.header}
                  onChange={onChangeHeader}
                />

                {/* Type (locked if header exists) */}
                <div
                  className={
                    isExistingHeader ? "opacity-60 pointer-events-none" : ""
                  }
                >
                  <Dropdown
                    label={`Type *${isExistingHeader ? " (locked)" : ""}`}
                    options={["flat", "tree"]}
                    value={
                      isExistingHeader ? lockedType || form.type : form.type
                    }
                    onChange={onChangeType}
                    disableSearch
                  />
                </div>

                {/* Subheader when type=tree */}
                {(isExistingHeader
                  ? lockedType === "tree"
                  : form.type === "tree") && (
                  <Dropdown
                    label="Item Name *"
                    options={isExistingHeader ? subHeaderOptions : []}
                    value={form.subHeader}
                    onChange={onChangeSubHeader}
                  />
                )}

                {/* Industry Name */}
                <Dropdown
                  label="Industry Name *"
                  options={industryOptions}
                  value={form.industryName}
                  onChange={onChangeIndustry}
                />

                {/* Part Code */}
                <Dropdown
                  label="Part Code *"
                  options={partCodeOptions}
                  value={form.partCode}
                  onChange={onChangePartCode}
                />

                {/* MSL (required) */}
                <div>
                  <label className="block mb-1">MSL(Minimum Quantity) *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.msl}
                    onChange={(e) => onChangeMsl(e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* (Optional) Note */}
                <div>
                  <label className="block mb-1">Note (optional)</label>
                  <textarea
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center"
                  >
                    {submitting ? <DotLoader /> : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-[120] overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <h3 className="text-xl font-semibold text-center mb-4">
                Edit Part
              </h3>
              <form onSubmit={handleEdit} className="space-y-4">
                <Dropdown
                  label="Item Type *"
                  options={headerOptions}
                  value={form.header}
                  onChange={onChangeHeader}
                />
                <div
                  className={
                    isExistingHeader ? "opacity-60 pointer-events-none" : ""
                  }
                >
                  <Dropdown
                    label={`Type *${isExistingHeader ? " (locked)" : ""}`}
                    options={["flat", "tree"]}
                    value={
                      isExistingHeader ? lockedType || form.type : form.type
                    }
                    onChange={onChangeType}
                    disableSearch
                  />
                </div>
                {(isExistingHeader
                  ? lockedType === "tree"
                  : form.type === "tree") && (
                  <Dropdown
                    label="Item Name *"
                    options={isExistingHeader ? subHeaderOptions : []}
                    value={form.subHeader}
                    onChange={onChangeSubHeader}
                  />
                )}
                <Dropdown
                  label="Industry Name *"
                  options={industryOptions}
                  value={form.industryName}
                  onChange={onChangeIndustry}
                />
                <Dropdown
                  label="Part Code *"
                  options={partCodeOptions}
                  value={form.partCode}
                  onChange={onChangePartCode}
                />

                <div>
                  <label className="block mb-1">MSL(Minimum Quantity) *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.msl}
                    onChange={(e) => onChangeMsl(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block mb-1">Note (optional)</label>
                  <textarea
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEdit(null)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center"
                  >
                    {submitting ? <DotLoader /> : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <div className="bg-black/50 backdrop-blur-md p-6 rounded-xl shadow-lg w-full max-w-sm">
              <h3 className="text-xl font-semibold mb-3">Confirm Delete</h3>
              <p className="mb-4">
                Are you sure you want to delete{" "}
                <span className="font-semibold">
                  {showDelete.header} — {showDelete.industryName}
                  {showDelete.partCode ? ` (${showDelete.partCode})` : ""}
                </span>
                ?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDelete(null)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center justify-center"
                >
                  {submitting ? <DotLoader /> : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
