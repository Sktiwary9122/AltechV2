// src/pages/ProductDetailsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  getAllProductDetails,
  createProductDetail,
  updateProductDetail,
  deleteProductDetail,
  getGroupedProductDetails,
} from "../api/api";
import Spinner from "../components/Spinner";
import DotLoader from "../components/DotLoader";
import Dropdown from "../components/Dropdown";

export default function ProductDetails() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // UI state uses `product` (but rows might have productName)
  const [form, setForm] = useState({ product: "", modelNumber: "" });

  // { [productName]: models[] }
  const [groupedMap, setGroupedMap] = useState({});

  // role gates
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const canCreate = ["admin", "ima", "deo"].includes(role);
  const canEdit = role === "admin";
  const canDelete = role === "admin";

  // ---- helpers: normalize product field across API variants ----
  const getProd = (row) => row?.product ?? row?.productName ?? "";
  const setFormFromRow = (row) =>
    setForm({
      product: getProd(row),
      modelNumber: row?.modelNumber || "",
    });

  // dropdown options
  const productOptions = useMemo(
    () => Object.keys(groupedMap || {}),
    [groupedMap]
  );
  const modelOptions = useMemo(
    () => (form.product ? groupedMap[form.product] ?? [] : []),
    [groupedMap, form.product]
  );

  // fetch table data
  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getAllProductDetails();
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setItems(list);
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to load product details"
      );
    } finally {
      setLoading(false);
    }
  };

  // fetch grouped product->models (productName + models[])
  const fetchGrouped = async () => {
    try {
      const res = await getGroupedProductDetails();
      const arr = Array.isArray(res?.data) ? res.data : [];
      const map = {};
      arr.forEach(({ productName, models }) => {
        if (!productName) return;
        map[productName] = Array.isArray(models) ? models : [];
      });
      setGroupedMap(map);
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to load grouped products"
      );
    }
  };

  useEffect(() => {
    fetchAll();
    fetchGrouped();
  }, []);

  // search by either product or productName
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const p = getProd(it).toLowerCase();
      const m = it.modelNumber?.toLowerCase() || "";
      return p.includes(q) || m.includes(q);
    });
  }, [items, search]);

  const resetForm = () => setForm({ product: "", modelNumber: "" });

  /* ========================== CREATE ========================== */
  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const productName = form.product?.trim();
    const modelNumber = form.modelNumber?.trim();
    if (!productName || !modelNumber) {
      toast.warn("Both Product and Model are required");
      return;
    }
    setSubmitting(true);
    try {
      // backend expects `product`
      await createProductDetail({ productName, modelNumber });
      toast.success("Product created");
      setShowCreate(false);
      resetForm();
      await fetchAll();
      await fetchGrouped();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* =========================== EDIT =========================== */
  const openEdit = (row) => {
    setShowEdit(row);
    setFormFromRow(row); // normalize product/productName into form.product
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const idToUpdate = showEdit?._id;
    if (!idToUpdate) {
      toast.error("Invalid record: Cannot find product ID.");
      return;
    }
    const product = form.product?.trim();
    const modelNumber = form.modelNumber?.trim();
    if (!product || !modelNumber) {
      toast.warn("Product and Model cannot be empty.");
      return;
    }
    if (
      product === getProd(showEdit) &&
      modelNumber === (showEdit.modelNumber || "")
    ) {
      toast.info("No changes to save.");
      setShowEdit(null);
      return;
    }

    setSubmitting(true);
    try {
      // backend expects `product`
      await updateProductDetail(idToUpdate, { product, modelNumber });
      toast.success("Product updated");
      setShowEdit(null);
      resetForm();
      await fetchAll();
      await fetchGrouped();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ========================== DELETE ========================== */
  const openDelete = (row) => setShowDelete(row);

  const handleDelete = async () => {
    const idToDelete = showDelete?._id;
    if (!idToDelete) {
      toast.error("Invalid record: Cannot find product ID.");
      return;
    }
    setSubmitting(true);
    try {
      await deleteProductDetail(idToDelete);
      toast.success("Product deleted");
      setShowDelete(null);
      await fetchAll();
      await fetchGrouped();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================ UI ============================ */
  return (
    <div className="min-h-screen p-6 md:p-8 pt-28 text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Spinner />
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col gap-4 sm:gap-5 mb-5 sm:flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Model Creation</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search product or model"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-auto flex-1 sm:flex-initial md:w-72 px-4 py-2.5 rounded-lg bg-black/30 text-white placeholder-white/70 border border-indigo-400 focus:outline-none ring-2 ring-indigo-500 transition"
          />
          {canCreate && (
            <button
              onClick={openCreate}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
            >
              + Create
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-auto custom-scrollbar max-h-[600px] rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 bg-slate-300 text-black px-6 py-3 border border-[#162134] text-left">
                #
              </th>
              <th className="sticky top-0 bg-slate-300 text-black px-6 py-3 border border-[#162134] text-left">
                Product
              </th>
              <th className="sticky top-0 bg-slate-300 text-black px-6 py-3 border border-[#162134] text-left">
                Model
              </th>
              <th className="sticky top-0 bg-slate-300 text-black px-6 py-3 border border-[#162134] text-center">
                Edit
              </th>
              <th className="sticky top-0 bg-slate-300 text-black px-6 py-3 border border-[#162134] text-center">
                Delete
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-white/80 px-6 py-6">
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => (
                <tr
                  key={row._id}
                  className="
          odd:bg-white/5 even:bg-white/0
          hover:bg-white/10
          transition-colors
        "
                >
                  <td className="border border-[#162134] px-6 py-3">
                    {idx + 1}
                  </td>
                  <td className="border border-[#162134] px-6 py-3">
                    {getProd(row)}
                  </td>
                  <td className="border border-[#162134] px-6 py-3">
                    {row.modelNumber}
                  </td>
                  <td className="border border-[#162134] px-6 py-3 text-center">
                    <button
                      disabled={!canEdit}
                      onClick={() => canEdit && openEdit(row)}
                      className={`rounded px-3 py-1.5 ${
                        canEdit
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-gray-600 cursor-not-allowed"
                      }`}
                    >
                      Edit
                    </button>
                  </td>
                  <td className="border border-[#162134] px-6 py-3 text-center">
                    <button
                      disabled={!canDelete}
                      onClick={() => canDelete && openDelete(row)}
                      className={`px-3 py-1.5 rounded ${
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-xl font-semibold text-center mb-5">
              Create Model
            </h3>
            <form onSubmit={handleCreate} className="space-y-5">
              <Dropdown
                label="Product *"
                options={productOptions}
                value={form.product}
                onChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    product: val,
                    modelNumber: (groupedMap[val] || []).includes(f.modelNumber)
                      ? f.modelNumber
                      : "",
                  }))
                }
              />
              <Dropdown
                label="Model *"
                options={modelOptions}
                value={form.modelNumber}
                onChange={(val) => setForm((f) => ({ ...f, modelNumber: val }))}
              />
              <div className="flex justify-end gap-3 pt-2">
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
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-xl font-semibold text-center mb-5">
              Edit Product Detail
            </h3>
            <form onSubmit={handleEdit} className="space-y-5">
              <Dropdown
                label="Product"
                options={productOptions}
                value={form.product}
                onChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    product: val,
                    modelNumber: (groupedMap[val] || []).includes(f.modelNumber)
                      ? f.modelNumber
                      : "",
                  }))
                }
              />
              <Dropdown
                label="Model"
                options={modelOptions}
                value={form.modelNumber}
                onChange={(val) => setForm((f) => ({ ...f, modelNumber: val }))}
              />
              <div className="flex justify-end gap-3 pt-2">
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
      )}

      {/* Delete Confirm */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-lg w-full max-w-sm">
            <h3 className="text-xl font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-5">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {getProd(showDelete)} — {showDelete.modelNumber}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3">
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
      )}
    </div>
  );
}
