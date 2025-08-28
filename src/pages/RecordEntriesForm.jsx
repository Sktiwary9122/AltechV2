import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Dropdown from "../components/Dropdown";
import Switch from "../components/Switch";
import QrScanner from "../components/QrScanner";
import DotLoader from "../components/DotLoader";
import { options } from "../assets/options";
import qrScan from "../assets/qr-scan.svg";

import {
  getGroupedProductDetailsWithIds,
  getStockByIndustry,
  getEndUserIds,
  createRecordEntry,
  getRecordEntryBySerial,
  updateRecordEntry,
} from "../api/api";

/* ---------- IST helpers ---------- */
function nowInISTDateParts(d = new Date()) {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = ist.getFullYear();
  const MM = pad(ist.getMonth() + 1);
  const DD = pad(ist.getDate());
  return { ist, YYYY, MM, DD };
}
function istDateYYYYMMDD() {
  const { YYYY, MM, DD } = nowInISTDateParts();
  return `${YYYY}-${MM}-${DD}`;
}
function istNowISO() {
  return nowInISTDateParts().ist.toISOString();
}

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-black/30 text-white placeholder-white/70 " +
  "border border-indigo-500 ring-2 ring-indigo-400 outline-none transition";

const cardCls =
  "w-full p-6 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

// Helper function to aggregate line items by industry
const aggregateLines = (lines, qtyKey) => {
  if (!lines || lines.length === 0) {
    return [];
  }
  const map = new Map();
  for (const line of lines) {
    if (line.industryName) {
      const currentQty = map.get(line.industryName) || 0;
      map.set(line.industryName, currentQty + (Number(line[qtyKey]) || 0));
    }
  }
  // Sort for stable comparison
  const sortedEntries = Array.from(map.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  return sortedEntries.map(([industryName, qty]) => ({ industryName, qty }));
};

export default function RecordEntryForm() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const mode = state?.mode || "create";
  const serialFromFlow = state?.serial || state?.incomingSerial || "";

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [grouped, setGrouped] = useState([]);
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [productDetailId, setProductDetailId] = useState("");

  const [stockMap, setStockMap] = useState({});
  const industryOptions = useMemo(() => Object.keys(stockMap), [stockMap]);

  const [faultReported, setFaultReported] = useState("");
  const [faultAnalyzed, setFaultAnalyzed] = useState("");
  const [cosmeticProblem, setCosmeticProblem] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [packingStatus, setPackingStatus] = useState("Pending");
  const [packingDate, setPackingDate] = useState("");
  const [newSrNo, setNewSrNo] = useState("");
  const [remarks, setRemarks] = useState("");

  // NEW: end-users + assigned
  const [endUsers, setEndUsers] = useState([]);           // [{_id, userId, ...}]
  const endUserOptions = useMemo(
    () => endUsers.map((u) => u.userId),
    [endUsers]
  );
  const [assignedUserIds, setAssignedUserIds] = useState(""); // comma-separated string via Dropdown multiSelect

  const [reqLines, setReqLines] = useState([
    { industryName: "", qtyRequired: "" },
  ]);
  const [repLines, setRepLines] = useState([
    { industryName: "", quantity: "" },
  ]);

  const [form, setForm] = useState({ productSrNo: serialFromFlow || "" });
  const [original, setOriginal] = useState(null);

  // ### Reactive aggregation using useMemo ###
  const aggregatedReqs = useMemo(
    () => aggregateLines(reqLines, "qtyRequired"),
    [reqLines]
  );
  const aggregatedReps = useMemo(
    () => aggregateLines(repLines, "quantity"),
    [repLines]
  );

  const modelOptions = useMemo(() => {
    const g = grouped.find((x) => x.productName === productName);
    return g ? g.models.map((m) => m.modelNumber) : [];
  }, [grouped, productName]);

  useEffect(() => {
    setModelNumber("");
    setProductDetailId("");
  }, [productName]);

  useEffect(() => {
    const g = grouped.find((x) => x.productName === productName);
    const hit = g?.models.find((m) => m.modelNumber === modelNumber);
    setProductDetailId(hit?._id || "");
  }, [grouped, productName, modelNumber]);

  /* ---- Data Fetching ---- */
  useEffect(() => {
    (async () => {
      try {
        const productRes = await getGroupedProductDetailsWithIds();
        const productList = Array.isArray(productRes?.data)
          ? productRes.data
          : [];
        setGrouped(productList);

        // Load end users for "Assign To"
        try {
          const endRes = await getEndUserIds();
          const endArr = Array.isArray(endRes?.data)
            ? endRes.data
            : endRes?.data?.data || [];
          setEndUsers(endArr);
        } catch (e) {
          console.error(e);
          toast.error("Failed to load end users");
        }

        if (mode === "edit") {
          const recRes = await getRecordEntryBySerial(serialFromFlow);
          const rec = recRes?.data?.data?.data;
          if (!rec?._id) throw new Error("Record not found");
          setOriginal(rec);

          setForm((f) => ({
            ...f,
            productSrNo: rec.productSrNo || serialFromFlow,
          }));
          setProductName(rec.productName || "");
          setTimeout(() => setModelNumber(rec.modelNumber || ""), 10);

          setFaultReported(rec.faultReported || "");
          setFaultAnalyzed(rec.faultAnalyzed || "");
          setCosmeticProblem(rec.cosmeticProblem || "");
          setActionTaken(rec.actionTaken || "");
          setPackingStatus(rec.packingStatus || "Pending");
          setPackingDate(
            rec.packingDate
              ? new Date(rec.packingDate).toISOString().slice(0, 10)
              : ""
          );
          setNewSrNo(rec.newSrNo || "");
          setRemarks(rec.remarks || "");

          const prefilledReqs = (rec.requirementLines || []).map((r) => ({
            _id: r._id,
            industryName: r.industryName,
            qtyRequired: r.qtyRequired,
          }));
          setReqLines(
            prefilledReqs.length > 0
              ? prefilledReqs
              : [{ industryName: "", qtyRequired: "" }]
          );

          const prefilledReps = (rec.replacementLines || []).map((r) => ({
            _id: r._id,
            industryName: r.industryName,
            quantity: r.qty,
          }));
          setRepLines(
            prefilledReps.length > 0
              ? prefilledReps
              : [{ industryName: "", quantity: "" }]
          );

          // NEW: prefill assigned users
          const preAssigned = (rec.assignedTo || [])
            .map((a) => a.userId)
            .filter(Boolean);
          setAssignedUserIds(preAssigned.join(", "));
        } else {
          setProductName(productList[0]?.productName || "");
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load form data");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getStockByIndustry();
        const items = res?.data?.items || res?.data?.data?.items || [];
        const map = {};
        items.forEach((obj) => {
          if (!obj || typeof obj !== "object") return;
          const { total } = obj;
          const keys = Object.keys(obj).filter((k) => k !== "total");
          if (!keys.length) return;
          const industry = keys[0];
          const codesArr = Array.isArray(obj[industry]) ? obj[industry] : [];
          const codes = {};
          codesArr.forEach((o) => {
            Object.entries(o || {}).forEach(
              ([code, qty]) => (codes[code] = Number(qty) || 0)
            );
          });
          map[industry] = { total: Number(total) || 0, codes };
        });
        setStockMap(map);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load stock by industry");
      }
    })();
  }, []);

  /* ---- Handlers and Validation ---- */
  const addReqLine = () =>
    setReqLines((a) => [...a, { industryName: "", qtyRequired: "" }]);
  const removeReqLine = (i) =>
    setReqLines((a) => a.filter((_, idx) => idx !== i));
  const setReqAt = (i, key, val) =>
    setReqLines((a) =>
      a.map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
    );

  const addRepLine = () =>
    setRepLines((a) => [...a, { industryName: "", quantity: "" }]);
  const removeRepLine = (i) =>
    setRepLines((a) => a.filter((_, idx) => idx !== i));
  const setRepAt = (i, key, val) =>
    setRepLines((a) =>
      a.map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
    );

  const validate = () => {
    /* validation logic */ return [];
  };

  // Helper: map assignedUserIds (comma-separated) -> [{userRef, userId}]
  const mapAssignedTo = () => {
    const ids = (assignedUserIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return [];
    const mapped = ids
      .map((uid) => {
        const u = endUsers.find((x) => x.userId === uid);
        return u ? { userRef: u._id, userId: u.userId } : null;
      })
      .filter(Boolean);
    return mapped;
  };

  /* ---- Submit ---- */
  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length) {
      toast.warn(errs[0]);
      return;
    }

    if (mode === "create") {
      const payload = {
        productDetail: productDetailId,
        productName,
        modelNumber,
        productSrNo: form.productSrNo,
        faultReported,
        faultAnalyzed,
        cosmeticProblem,
        actionTaken,
        packingStatus,
        packingDate: packingDate ? new Date(packingDate).toISOString() : null,
        newSrNo,
        remarks,
        entryDate: istNowISO(),
        requirementLines: reqLines
          .filter((r) => r.industryName && r.qtyRequired)
        .map((r) => ({
          industryName: r.industryName,
          qtyRequired: Number(r.qtyRequired),
        })),
        replacementRequests: repLines
          .filter((r) => r.industryName && r.quantity)
          .map((r) => ({
            industryName: r.industryName,
            quantity: Number(r.quantity),
            dateReplaced: istNowISO(),
          })),
      };

      // NEW: include assignedTo if provided
      const assigned = mapAssignedTo();
      if (assigned.length) payload.assignedTo = assigned;

      setSaving(true);
      try {
        await createRecordEntry(payload);
        toast.success("Record entry created");
        navigate("/record-entries", { state: { createdRecord: payload } });
      } catch (err) {
        toast.error(err?.response?.data?.message || "Save failed");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === "edit") {
      try {
        const body = {};

        // 1. Build 'core' payload with changed fields only
        const coreChanges = {};
        if (faultReported !== (original.faultReported || ""))
          coreChanges.faultReported = faultReported;
        if (faultAnalyzed !== (original.faultAnalyzed || ""))
          coreChanges.faultAnalyzed = faultAnalyzed;
        if (cosmeticProblem !== (original.cosmeticProblem || ""))
          coreChanges.cosmeticProblem = cosmeticProblem;
        if (actionTaken !== (original.actionTaken || ""))
          coreChanges.actionTaken = actionTaken;
        if (packingStatus !== (original.packingStatus || "Pending"))
          coreChanges.packingStatus = packingStatus;
        const originalPackingDate = original.packingDate
          ? new Date(original.packingDate).toISOString().slice(0, 10)
          : "";
        if (packingDate !== originalPackingDate)
          coreChanges.packingDate = packingDate
            ? new Date(packingDate).toISOString()
            : null;
        if (newSrNo !== (original.newSrNo || "")) coreChanges.newSrNo = newSrNo;
        if (remarks !== (original.remarks || "")) coreChanges.remarks = remarks;
                // 4. NEW: assignedTo changes
        const newAssignedIds = (assignedUserIds || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .sort();
        const originalAssignedIds = (original.assignedTo || [])
          .map((a) => a.userId)
          .filter(Boolean)
          .sort();

        const sameAssigned =
          JSON.stringify(newAssignedIds) === JSON.stringify(originalAssignedIds);

        if (!sameAssigned) {
          const mapped = mapAssignedTo();
          coreChanges.assignedTo = mapped; // send even if empty to clear assignments
        }

        if (Object.keys(coreChanges).length > 0) {
          body.core = coreChanges;
        }

        // 2. Build 'requirements' payload if aggregated totals have changed
        const finalReqs = aggregatedReqs.filter((r) => r.qty > 0);
        const originalAggregatedReqs = aggregateLines(
          original.requirementLines || [],
          "qtyRequired"
        );

        if (
          JSON.stringify(finalReqs) !== JSON.stringify(originalAggregatedReqs)
        ) {
          body.requirements = finalReqs;
        }

        // 3. Build 'replacements' payload if aggregated totals have changed
        const finalReps = aggregatedReps.filter((r) => r.qty > 0);
        const originalAggregatedReps = aggregateLines(
          original.replacementLines || [],
          "qty"
        );

        if (
          JSON.stringify(finalReps) !== JSON.stringify(originalAggregatedReps)
        ) {
          body.replacements = finalReps;
        }

        if (Object.keys(body).length === 0) {
          toast.info("No changes to update.");
          return;
        }

        setSaving(true);
        await updateRecordEntry(original._id, body);
        toast.success("Record updated");
        navigate("/record-entries");
      } catch (err) {
        console.error(err);
        toast.error(
          err?.message || err?.response?.data?.message || "Update failed"
        );
      } finally {
        setSaving(false);
      }
    }
  };

  if (scanning) {
    return (
      <QrScanner
        onClose={() => setScanning(false)}
        onDecoded={(text) => {
          setNewSrNo(text || "");
          setScanning(false);
        }}
      />
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full pt-24 flex flex-col items-center space-y-6 pb-10"
    >
      <h2 className="text-white text-lg md:text-2xl font-bold border p-2 rounded-lg mb-4">
        {mode === "edit" ? "Update Entry" : "Create Entry"} — Serial:{" "}
        <span className="font-bold">{form.productSrNo || "—"}</span>
      </h2>

      <div className="w-[92%] md:w-[70%] lg:w-[60%] space-y-6">
        <div className={cardCls}>
          <label className="block text-white mb-2">Entry Date (IST)</label>
          <input
            type="date"
            className={`${inputCls} opacity-80 cursor-not-allowed`}
            value={istDateYYYYMMDD()}
            disabled
            readOnly
          />
        </div>

        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Dropdown
              label="Product Name"
              options={grouped.map((g) => g.productName)}
              value={productName}
              onChange={setProductName}
              disabled={mode === "edit"}
            />
            <Dropdown
              label="Model Number"
              options={modelOptions}
              value={modelNumber}
              onChange={setModelNumber}
              disabled={mode === "edit"}
            />
          </div>
        </div>

        <div className={cardCls}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Switch
              label="Fault Reported"
              value={faultReported}
              onChange={setFaultReported}
            />
            <Dropdown
              label="Fault Analyzed"
              options={options["Fault Analysed"] || []}
              value={faultAnalyzed}
              onChange={setFaultAnalyzed}
              disableAdd
            />
            <Dropdown
              label="Cosmetic Problem"
              options={options["Cosmetic Problem"] || []}
              value={cosmeticProblem}
              onChange={setCosmeticProblem}
              disableAdd
            />
            <div>
              <label className="block text-white mb-1">Action Taken</label>
              <textarea
                className="w-full p-2 border rounded bg-slate-600 text-white"
                placeholder="Action Taken"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">Parts Required</h3>
            <button
              type="button"
              onClick={addReqLine}
              className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/5 text-white"
            >
              + Add
            </button>
          </div>
          <div className="space-y-3">
            {reqLines.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
              >
                <div className="md:col-span-3">
                  <Dropdown
                    label={`Industry * (Row ${idx + 1})`}
                    options={industryOptions}
                    value={row.industryName}
                    onChange={(v) => setReqAt(idx, "industryName", v)}
                    disableAdd
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-white mb-1">
                    Qty Required *
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    value={row.qtyRequired}
                    onChange={(e) =>
                      setReqAt(idx, "qtyRequired", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeReqLine(idx)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">Parts Replaced</h3>
            <button
              type="button"
              onClick={addRepLine}
              className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/5 text-white"
            >
              + Add
            </button>
          </div>
          <div className="space-y-3">
            {repLines.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
              >
                <div className="md:col-span-3">
                  <Dropdown
                    label={`Industry * (Row ${idx + 1})`}
                    options={industryOptions}
                    value={row.industryName}
                    onChange={(v) => setRepAt(idx, "industryName", v)}
                    disableAdd
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-white mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    value={row.quantity}
                    onChange={(e) => setRepAt(idx, "quantity", e.target.value)}
                  />
                </div>
                <div className="md:col-span-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRepLine(idx)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          <label className="block text-white mb-1">New Serial No</label>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              className="flex-1 p-2 border rounded text-white bg-slate-700"
              value={newSrNo}
              onChange={(e) => setNewSrNo(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="px-3 py-2 bg-white rounded text-black"
            >
              <img src={qrScan} alt="Scan" className="w-6 h-6" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Dropdown
              label="Packing Status"
              options={["Pending", "Processing", "Completed"]}
              value={packingStatus}
              onChange={setPackingStatus}
              disableAdd
            />
            <div className="md:col-span-2">
              <label className="block text-white mb-1">Packing Date</label>
              <input
                type="date"
                className={inputCls}
                value={packingDate}
                onChange={(e) => setPackingDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-white mb-1">Remarks</label>
            <textarea
              className="w-full p-2 border rounded bg-slate-600 text-white"
              placeholder="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          {/* NEW: Assign To (end-users) */}
          <div className="mt-3">
            <Dropdown
              label="Assign To (end-users)"
              options={endUserOptions}
              value={assignedUserIds}
              onChange={setAssignedUserIds}
              multiSelect
              disableAdd
            />
            <div className="text-xs text-white/60 mt-1">
              Multiple selections allowed.
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded flex justify-center"
        >
          {saving ? (
            <DotLoader />
          ) : mode === "edit" ? (
            "Update Entry"
          ) : (
            "Create Entry"
          )}
        </button>
      </div>
    </form>
  );
}
