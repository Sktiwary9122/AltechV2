import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Spinner from "../components/Spinner";
import Dropdown from "../components/Dropdown";
import DotLoader from "../components/DotLoader";

import {
  getGroupedProductDetailsWithIds,
  getFinishedGoods,
  createFinishedGoods,
  updateFinishedGoods,
  deleteFinishedGoods,
} from "../api/api";

// ⬇️ permissions
import { ACTIONS, ROLES, canDo } from "../auth/permissions";

/* ---------- theme helpers ---------- */
const inputCls =
  "w-full px-3 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white/20 transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";

const cardCls =
  "w-full p-4 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

/* ---------- utils ---------- */
function findModel(grouped, productName, modelNumber) {
  const g = (grouped || []).find((x) => x.productName === productName);
  if (!g) return null;
  return (g.models || []).find((m) => m.modelNumber === modelNumber) || null;
}

export default function FinishedGoods() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 🔐 role (read from your auth source; fallback to localStorage; default viewer)
  const [role, setRole] = useState(ROLES.VIEWER);
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const userObj = storedUser ? JSON.parse(storedUser) : {};
      const r = userObj?.role || localStorage.getItem("role") || ROLES.VIEWER;
      setRole(r);
    } catch {
      setRole(ROLES.VIEWER);
    }
  }, []);

  // Derived permissions for this page
  const canCreate = canDo(role, ACTIONS.RECORD_ENTRY_CREATE);
  const canEdit = canDo(role, ACTIONS.RECORD_ENTRY_EDIT);
  const canDelete = canDo(role, ACTIONS.RECORD_ENTRY_DELETE);

  // Product/model catalog
  const [grouped, setGrouped] = useState([]);
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");

  const modelOptions = useMemo(() => {
    const g = grouped.find((x) => x.productName === productName);
    return g ? g.models.map((m) => m.modelNumber) : [];
  }, [grouped, productName]);

  const selectedModel = useMemo(
    () => findModel(grouped, productName, modelNumber),
    [grouped, productName, modelNumber]
  );
  const selectedProductDetailsId = selectedModel?._id || null;

  // Table rows
  const [rows, setRows] = useState([]);

  // Modals
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);   // row being edited
  const [openDelete, setOpenDelete] = useState(null); // row being deleted

  // Create form
  const [cProduct, setCProduct] = useState("");
  const [cModel, setCModel] = useState("");
  const [cTotalIn, setCTotalIn] = useState("");
  const [cTotalOut, setCTotalOut] = useState("0");

  const cModelOptions = useMemo(() => {
    const g = grouped.find((x) => x.productName === cProduct);
    return g ? g.models.map((m) => m.modelNumber) : [];
  }, [grouped, cProduct]);
  const cSelectedModel = useMemo(
    () => findModel(grouped, cProduct, cModel),
    [grouped, cProduct, cModel]
  );
  const cProductDetailsId = cSelectedModel?._id || null;

  // Edit (increment) form
  const [incIn, setIncIn] = useState("0");
  const [incOut, setIncOut] = useState("0");

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await getGroupedProductDetailsWithIds();
        const list = Array.isArray(res?.data) ? res.data : [];
        setGrouped(list);

        // default selection
        const p = list[0]?.productName || "";
        const m = list[0]?.models?.[0]?.modelNumber || "";
        setProductName(p);
        setModelNumber(m);

        await loadTable(); // all entries by default
      } catch (e) {
        console.error(e);
        toast.error("Failed to load product catalog");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- load table ---------- */
  const loadTable = async (filterById) => {
    try {
      setLoading(true);
      const params = {};
      if (filterById) params.productDetailsId = filterById;
      const res = await getFinishedGoods(params);
      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      setRows(
        list.map((x) => ({
          _id: x._id,
          productDetailsId: x.productDetailsId,
          product: x.product,
          model: x.model,
          totalIn: Number(x.totalIn || 0),
          totalOut: Number(x.totalOut || 0),
          currentStock: Number(x.currentStock || 0),
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to load entries");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- filter apply/clear ---------- */
  const onApplyFilter = () => {
    if (selectedProductDetailsId) {
      loadTable(selectedProductDetailsId);
    } else {
      loadTable();
    }
  };

  const onClearFilter = () => {
    setProductName(grouped[0]?.productName || "");
    setModelNumber(grouped[0]?.models?.[0]?.modelNumber || "");
    loadTable();
  };

  /* ---------- create ---------- */
  const openCreateModal = () => {
    if (!canCreate) return;
    setCProduct(productName || grouped[0]?.productName || "");
    // if product changed, the model list will recompute; pick first model
    const firstModel =
      grouped.find(
        (g) => g.productName === (productName || grouped[0]?.productName)
      )?.models?.[0]?.modelNumber || "";
    setCModel(modelNumber || firstModel);
    setCTotalIn("");
    setCTotalOut("0");
    setOpenCreate(true);
  };

  const closeCreate = () => setOpenCreate(false);

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!canCreate) return;

    if (!cProductDetailsId) {
      toast.warn("Please select a valid Product and Model.");
      return;
    }
    const ti = Number(cTotalIn || 0);
    const to = Number(cTotalOut || 0);
    if (ti < 0 || to < 0) {
      toast.warn("Totals cannot be negative.");
      return;
    }

    try {
      setSaving(true);
      await createFinishedGoods({
        productDetailsId: cProductDetailsId,
        product: cProduct,
        model: cModel,
        totalIn: ti,
        totalOut: to,
      });
      toast.success("Finished Goods entry created");
      closeCreate();
      // refresh filtered view: if current filter matches created item, keep it
      const keepFilter =
        selectedProductDetailsId &&
        selectedProductDetailsId === cProductDetailsId;
      await loadTable(keepFilter ? selectedProductDetailsId : undefined);
    } catch (e) {
      console.error(e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e.message ||
        "Create failed";
      if (String(msg).toLowerCase().includes("duplicate")) {
        toast.error(
          "An entry already exists for this Product/Model. Use Update instead."
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  /* ---------- edit (increment) ---------- */
  const openEditModal = (row) => {
    if (!canEdit) return;
    setOpenEdit(row);
    setIncIn("0");
    setIncOut("0");
  };
  const closeEdit = () => setOpenEdit(null);

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!canEdit || !openEdit?._id) return;
    const addIn = Number(incIn || 0);
    const addOut = Number(incOut || 0);
    if (addIn < 0 || addOut < 0) {
      toast.warn("Increment values cannot be negative.");
      return;
    }
    if (addIn === 0 && addOut === 0) {
      toast.info("Nothing to update.");
      return;
    }
    try {
      setSaving(true);
      await updateFinishedGoods(openEdit._id, {
        totalIn: addIn,
        totalOut: addOut,
      });
      toast.success("Entry updated");
      closeEdit();
      // 🔁 Reload ALL entries after edit (no filter)
      await loadTable();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- delete (modal) ---------- */
  const openDeleteModal = (row) => {
    if (!canDelete) return;
    setOpenDelete(row);
  };
  const closeDelete = () => setOpenDelete(null);

  const confirmDelete = async () => {
    if (!canDelete || !openDelete?._id) return;
    try {
      setDeleting(true);
      await deleteFinishedGoods(openDelete._id);
      toast.success("Deleted");
      closeDelete();
      // 🔁 Reload ALL entries after delete (no filter)
      await loadTable();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pt-24 text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
          <Spinner />
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Finished Goods
            <span className="ml-2 text-sm font-normal text-white/60">
              — cumulative stock by Product / Model
            </span>
          </h2>

          {/* Create button (hidden for viewer/roles without permission) */}
          {canCreate && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
            >
              + New Entry
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={`${cardCls} mb-4`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4">
            <Dropdown
              label="Product"
              options={grouped.map((g) => g.productName)}
              value={productName}
              onChange={(v) => {
                setProductName(v);
                // auto-select first model of that product
                const first = grouped.find((g) => g.productName === v)
                  ?.models?.[0]?.modelNumber;
                setModelNumber(first || "");
              }}
            />
          </div>
          <div className="md:col-span-4">
            <Dropdown
              label="Model"
              options={modelOptions}
              value={modelNumber}
              onChange={setModelNumber}
            />
          </div>
          <div className="md:col-span-4 flex items-end gap-2">
            <button
              onClick={onApplyFilter}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
            >
              Apply
            </button>
            <button
              onClick={onClearFilter}
              className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="w-full min-w-[900px] table-auto border-collapse">
          <thead>
            <tr>
              {[
                "#",
                "Product",
                "Model",
                "Total In",
                "Total Out",
                "Current Stock",
              ].map((h) => (
                <th
                  key={h}
                  className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left"
                >
                  {h}
                </th>
              ))}
              {/* Action headers only if allowed */}
              {canEdit && (
                <th className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">
                  Edit
                </th>
              )}
              {canDelete && (
                <th className="sticky top-0 bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left">
                  Delete
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, i) => (
                <tr
                  key={r._id}
                  className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors"
                >
                  <td className="border border-[#162134] px-4 py-2">{i + 1}</td>
                  <td className="border border-[#162134] px-4 py-2">
                    {r.product}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {r.model}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {r.totalIn}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {r.totalOut}
                  </td>
                  <td className="border border-[#162134] px-4 py-2">
                    {r.currentStock}
                  </td>

                  {/* Edit column */}
                  {canEdit && (
                    <td className="border border-[#162134] px-4 py-2">
                      <button
                        onClick={() => openEditModal(r)}
                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Edit
                      </button>
                    </td>
                  )}

                  {/* Delete column */}
                  {canDelete && (
                    <td className="border border-[#162134] px-4 py-2">
                      <button
                        onClick={() => openDeleteModal(r)}
                        className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6 + (canEdit ? 1 : 0) + (canDelete ? 1 : 0)}
                  className="text-center text-white/80 px-4 py-6"
                >
                  No entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal (only render if allowed) */}
      {canCreate && openCreate && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          onClick={closeCreate}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-[95%] max-w-2xl p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <div className="bg-[#0c1024] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">
                    New Finished Goods
                  </h3>
                  <button
                    onClick={closeCreate}
                    className="text-white/80 hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form
                onSubmit={submitCreate}
                className="bg-[#0c1024] p-4 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Dropdown
                    label="Product"
                    options={grouped.map((g) => g.productName)}
                    value={cProduct}
                    onChange={(v) => {
                      setCProduct(v);
                      const first =
                        grouped.find((g) => g.productName === v)?.models?.[0]
                          ?.modelNumber || "";
                      setCModel(first);
                    }}
                  />
                  <Dropdown
                    label="Model"
                    options={cModelOptions}
                    value={cModel}
                    onChange={setCModel}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-white/80">
                      Total In
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={cTotalIn}
                      onChange={(e) => setCTotalIn(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-white/80">
                      Total Out
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={cTotalOut}
                      onChange={(e) => setCTotalOut(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-white/70 text-sm">
                    {cProductDetailsId
                      ? `productDetailsId: ${cProductDetailsId}`
                      : "Select product & model"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeCreate}
                      className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center justify-center min-w-[120px]"
                    >
                      {saving ? <DotLoader /> : "Create"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Update (increment) modal (only render if allowed) */}
      {canEdit && openEdit && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          onClick={closeEdit}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-[95%] max-w-xl p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <div className="bg-[#0c1024] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">
                    Update — {openEdit.product} / {openEdit.model}
                  </h3>
                  <button
                    onClick={closeEdit}
                    className="text-white/80 hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form
                onSubmit={submitEdit}
                className="bg-[#0c1024] p-4 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 text-white/80">
                      Add to Total In (+)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={incIn}
                      onChange={(e) => setIncIn(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-white/80">
                      Add to Total Out (+)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={incOut}
                      onChange={(e) => setIncOut(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 p-3 text-sm text-white/80">
                  <div>
                    Current Totals: <b>In</b> {openEdit.totalIn} • <b>Out</b>{" "}
                    {openEdit.totalOut} • <b>Stock</b> {openEdit.currentStock}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center justify-center min-w-[120px]"
                  >
                    {saving ? <DotLoader /> : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal (only render if allowed) */}
      {canDelete && openDelete && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          onClick={closeDelete}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-[95%] max-w-md p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <div className="bg-[#0c1024] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Delete Entry</h3>
                  <button
                    onClick={closeDelete}
                    className="text-white/80 hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="bg-[#0c1024] p-4 space-y-4">
                <div className="text-white/90">
                  Are you sure you want to delete this finished goods record?
                </div>

                <div className="rounded-lg border border-white/10 p-3 text-sm text-white/80 space-y-1">
                  <div>
                    <b>Product / Model:</b> {openDelete.product} / {openDelete.model}
                  </div>
                  <div>
                    <b>Totals:</b> In {openDelete.totalIn} • Out {openDelete.totalOut} • Stock{" "}
                    {openDelete.currentStock}
                  </div>
                  <div className="text-red-300">
                    This action cannot be undone.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeDelete}
                    className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white inline-flex items-center justify-center min-w-[120px]"
                  >
                    {deleting ? <DotLoader /> : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
