// src/pages/RecordEntriesFormDEO.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Dropdown from "../components/Dropdown";
import Switch from "../components/Switch";
import DotLoader from "../components/DotLoader";
import Spinner from "../components/Spinner";
import { options } from "../assets/options";

// NEW: scanner imports
import QrScanner from "../components/QrScanner";
import qrScan from "../assets/qr-scan.svg";

// APIs
import {
  getGroupedProductDetailsWithIds,
  getStockByIndustry,
  getRecordEntryBySerial,
  getEndUserIds,
  // DEO endpoints
  deoCreateRecordEntry,
  deoUpddateRecordEntry,
} from "../api/api";

/* ---------- styles ---------- */
const inputCls =
  "w-full px-3 py-2 rounded-lg bg-black/30 text-white placeholder-white/70 " +
  "border border-indigo-500 ring-2 ring-indigo-400 outline-none transition";

const readonlyCell =
  "w-full px-3 py-2 rounded-lg bg-black/20 text-white/80 border border-white/20";

const cardCls =
  "w-full p-6 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

/* ---------- time helpers ---------- */
function nowInIST() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60000);
}
function toYMD(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function istDateYYYYMMDD() {
  return toYMD(nowInIST());
}

/* ---------- qty helpers ---------- */
function aggregateByIndustry(lines, qtyKey) {
  const out = new Map();
  (lines || []).forEach((l) => {
    if (!l?.industryName) return;
    const q = Number(l[qtyKey] || 0);
    out.set(l.industryName, (out.get(l.industryName) || 0) + q);
  });
  return out;
}
function remainingByIndustry(record) {
  const req = aggregateByIndustry(
    record?.requirementLines || [],
    "qtyRequired"
  );
  const rep = aggregateByIndustry(record?.replacementLines || [], "qty");
  const map = {};
  req.forEach((need, ind) => {
    const got = rep.get(ind) || 0;
    map[ind] = Math.max(0, need - got);
  });
  return map;
}
function allIndustriesSatisfied(record) {
  const rem = remainingByIndustry(record || {});
  return Object.values(rem).every((v) => v === 0);
}
function sum(lines, key) {
  return (lines || []).reduce((acc, x) => acc + (Number(x?.[key]) || 0), 0);
}

export default function RecordEntriesFormDEO() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const incomingSerial = state?.serial || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  const [record, setRecord] = useState(null);
  const recordId = record?._id;
  const isPacked = (record?.packingStatus || "").toLowerCase() === "completed";

  // options/meta
  const [grouped, setGrouped] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [endUsers, setEndUsers] = useState([]);

  // ----- Step 1: create details (immutable for DEO after create)
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [productDetailId, setProductDetailId] = useState("");
  const [productSrNo, setProductSrNo] = useState(incomingSerial || "");
  const [faultReported, setFaultReported] = useState("");
  const [faultAnalyzed, setFaultAnalyzed] = useState("");
  const [cosmeticProblem, setCosmeticProblem] = useState("");
  const [reqLines, setReqLines] = useState([
    { industryName: "", qtyRequired: "" },
  ]);

  // ----- Step 2: additions + action
  const [repAdds, setRepAdds] = useState([]); // [{industryName, qty}]
  const [actionTaken, setActionTaken] = useState("");

  // ----- Step 3: packing + remarks + assigned
  const [packingStatus, setPackingStatus] = useState("Pending");
  const [packingDate, setPackingDate] = useState("");
  const [newSrNo, setNewSrNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [assignedUserIds, setAssignedUserIds] = useState("");

  // NEW: scanner flag
  const [scanning, setScanning] = useState(false);

  /* ---------- derived ---------- */
  const modelOptions = useMemo(() => {
    const g = grouped.find((x) => x.productName === productName);
    return g ? g.models.map((m) => m.modelNumber) : [];
  }, [grouped, productName]);

  useEffect(() => {
    const g = grouped.find((x) => x.productName === productName);
    const hit = g?.models.find((m) => m.modelNumber === modelNumber);
    setProductDetailId(hit?._id || "");
  }, [grouped, productName, modelNumber]);

  // Stock helper
  const availableStock = (ind) => stockMap[ind]?.total ?? 0;

  const reqIndustries = useMemo(() => {
    const arr =
      record?.requirementLines?.map((r) => r.industryName).filter(Boolean) ||
      reqLines.map((r) => r.industryName).filter(Boolean);
    return [...new Set(arr)];
  }, [record, reqLines]);

  const remMap = useMemo(() => remainingByIndustry(record || {}), [record]);
  const remainingTotal = useMemo(
    () => Object.values(remMap).reduce((a, b) => a + b, 0),
    [remMap]
  );

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prodRes, stockRes, endRes] = await Promise.all([
          getGroupedProductDetailsWithIds(),
          getStockByIndustry(),
          getEndUserIds(),
        ]);

        const prodList = Array.isArray(prodRes?.data) ? prodRes.data : [];
        setGrouped(prodList);
        if (!incomingSerial) {
          setProductName(prodList[0]?.productName || "");
          setModelNumber(prodList[0]?.models?.[0]?.modelNumber || "");
        }

        const items =
          stockRes?.data?.items || stockRes?.data?.data?.items || [];
        const smap = {};
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
          smap[industry] = { total: Number(total) || 0, codes };
        });
        setStockMap(smap);

        const endArr = Array.isArray(endRes?.data)
          ? endRes.data
          : endRes?.data?.data || [];
        setEndUsers(endArr);

        if (incomingSerial) {
          const recRes = await getRecordEntryBySerial(incomingSerial);
          const payload = recRes?.data?.data;
          if (payload?.isExisting && payload?.data?._id) {
            const rec = payload.data;
            if (cancelled) return;
            setRecord(rec);

            setProductName(rec.productName || "");
            setModelNumber(rec.modelNumber || "");
            setProductSrNo(rec.productSrNo || "");
            setFaultReported(rec.faultReported || "");
            setFaultAnalyzed(rec.faultAnalyzed || "");
            setCosmeticProblem(rec.cosmeticProblem || "");

            const preReq = (rec.requirementLines || []).map((r) => ({
              _id: r._id,
              industryName: r.industryName,
              qtyRequired: r.qtyRequired,
            }));
            setReqLines(
              preReq.length ? preReq : [{ industryName: "", qtyRequired: "" }]
            );

            const industries = [
              ...new Set(preReq.map((r) => r.industryName).filter(Boolean)),
            ];
            setRepAdds(
              industries.map((ind) => ({ industryName: ind, qty: "" }))
            );

            setPackingStatus(rec.packingStatus || "Pending");
            setPackingDate(
              rec.packingDate
                ? new Date(rec.packingDate).toISOString().slice(0, 10)
                : ""
            );
            setNewSrNo(rec.newSrNo || "");
            setRemarks(rec.remarks || "");
            setActionTaken(rec.actionTaken || "");

            const preAssigned = (rec.assignedTo || [])
              .map((a) => a.userId)
              .filter(Boolean);
            setAssignedUserIds(preAssigned.join(", "));
          }
        }
      } catch (e) {
        console.error(e);
        toast.error(e?.response?.data?.message || "Failed to load DEO form");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- step navigation (block step 3 until all industries satisfied) ---------- */
  const tryGotoStep = (target) => {
    if (target === step) return;

    // Always allow stepping back to view previous pages
    if (target < step) {
      setStep(target);
      return;
    }

    if (target === 2) {
      if (!recordId) {
        toast.info("Please save Step 1 first.");
        return;
      }
      setStep(2);
      return;
    }

    if (target === 3) {
      if (isPacked) {
        setStep(3);
        return;
      }
      if (!allIndustriesSatisfied(record)) {
        toast.warn(
          "You can proceed to Packing only after each industry's replacements match its requirement."
        );
        return;
      }
      setStep(3);
      return;
    }
  };

  /* ---------- handlers ---------- */
  const addReqLine = () =>
    setReqLines((a) => [...a, { industryName: "", qtyRequired: "" }]);
  const removeReqLine = (i) =>
    setReqLines((a) => a.filter((_, idx) => idx !== i));
  const setReqAt = (i, key, val) =>
    setReqLines((a) =>
      a.map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
    );

  const setRepAddAt = (i, key, val) =>
    setRepAdds((a) =>
      a.map((r, idx) => (idx === i ? { ...r, [key]: val } : r))
    );

  /* ---------- Step 1 save (create) ---------- */
  const onSaveStep1 = async () => {
    if (recordId) {
      setStep(2);
      return;
    }
    if (!productDetailId) return toast.warn("Please select Model.");
    if (!productSrNo?.trim()) return toast.warn("Please enter product serial.");

    const req = reqLines
      .map((r) => ({
        industryName: (r.industryName || "").trim(),
        qtyRequired: Number(r.qtyRequired || 0),
      }))
      .filter((r) => r.industryName && r.qtyRequired > 0);

    if (!req.length) return toast.warn("Add at least one Part Required line.");

    const payload = {
      productDetail: productDetailId,
      productName,
      modelNumber,
      productSrNo: productSrNo.trim(),
      faultReported,
      faultAnalyzed,
      cosmeticProblem,
      actionTaken: "",
      remarks: "",
      requirementLines: req,
    };

    setSaving(true);
    try {
      const res = await deoCreateRecordEntry(payload);
      const rec = res?.data?.record || res?.data;
      if (!rec?._id) throw new Error("Create failed");
      setRecord(rec);

      const industries = [
        ...new Set(
          (rec.requirementLines || [])
            .map((r) => r.industryName)
            .filter(Boolean)
        ),
      ];
      setRepAdds(industries.map((ind) => ({ industryName: ind, qty: "" })));

      const preAssigned = (rec.assignedTo || [])
        .map((a) => a.userId)
        .filter(Boolean);
      setAssignedUserIds(preAssigned.join(", "));

      toast.success("Created. Proceed to Parts Replaced.");
      setStep(2);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Create failed");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Step 2 save (additions) ---------- */
  // ---------- Step 2 save (additions) ----------
  const onSaveStep2 = async () => {
    if (!recordId) return toast.warn("Create the record first.");
    if (isPacked) return toast.warn("Record is already packed.");

    const additions = repAdds
      .map((r) => ({
        industryName: (r.industryName || "").trim(),
        qty: Number(r.qty || 0),
      }))
      .filter((r) => r.industryName && r.qty > 0);

    // validate each row against remaining & stock
    const currentRem = remainingByIndustry(record || {});
    for (const add of additions) {
      const remaining = currentRem[add.industryName] ?? 0;
      const avail = availableStock(add.industryName);
      if (add.qty > remaining) {
        return toast.warn(
          `"${add.industryName}": requested ${add.qty} exceeds remaining requirement ${remaining}.`
        );
      }
      if (add.qty > avail) {
        return toast.warn(
          `"${add.industryName}": requested ${add.qty} exceeds available stock ${avail}.`
        );
      }
    }

    const body = {};
    if (additions.length) body.additions = additions;
    if (actionTaken.trim()) body.actionTaken = actionTaken.trim();

    // ⬇️ NEW: if there is nothing to update BUT all industries are already satisfied,
    // just move forward to Step 3 (packing) instead of showing "Nothing to update".
    if (!additions.length && !body.actionTaken) {
      if (allIndustriesSatisfied(record)) {
        toast.info("All parts are already replaced. Moving to Packing.");
        setStep(3);
      } else {
        toast.info("Nothing to update.");
      }
      return;
    }

    setSaving(true);
    try {
      const res = await deoUpddateRecordEntry(recordId, body);
      const updated = res?.data?.record || res?.data;
      if (!updated?._id) throw new Error("Update failed");
      setRecord(updated);

      // clear the entry fields (so next add is fresh)
      setRepAdds((rows) => rows.map((r) => ({ ...r, qty: "" })));

      // Move to step 3 ONLY when every industry is satisfied
      if (allIndustriesSatisfied(updated)) {
        toast.success("All industries satisfied. Proceed to Packing.");
        setStep(3);
      } else {
        const totalReq = sum(updated?.requirementLines, "qtyRequired");
        const totalRep = sum(updated?.replacementLines, "qty");
        toast.success(
          `Saved. Remaining total: ${Math.max(
            0,
            totalReq - totalRep
          )} (all industries must reach 0 to proceed).`
        );
        setStep(2);
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };  

  /* ---------- Step 3 save (packing + meta) ---------- */
  const onSaveStep3 = async () => {
    if (!recordId) return toast.warn("Create the record first.");

    if (!isPacked && !allIndustriesSatisfied(record)) {
      return toast.warn(
        "Cannot open Packing until every industry's replacements match its requirement."
      );
    }

    const body = {};
    if (actionTaken.trim()) body.actionTaken = actionTaken.trim();
    else body.actionTaken = "";
    if (remarks.trim()) body.remarks = remarks.trim();

    // Assigned To
    const ids = (assignedUserIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) {
      const mapped = ids
        .map((uid) => {
          const u = endUsers.find((x) => x.userId === uid);
          return u ? { userRef: u._id, userId: u.userId } : null;
        })
        .filter(Boolean);
      if (mapped.length) body.assignedTo = mapped;
    }

    // Packing (optional; if any packing field present)
    const wantsPacking =
      packingStatus || packingDate || (newSrNo && newSrNo.trim().length > 0);
    if (wantsPacking) {
      const pack = {};
      if (packingStatus) pack.packingStatus = packingStatus;
      if (packingDate) pack.packingDate = new Date(packingDate).toISOString();
      if (newSrNo?.trim()) pack.newSrNo = newSrNo.trim();
      body.packing = pack;
    }

    if (!Object.keys(body).length) {
      toast.info("Nothing to update.");
      return;
    }

    setSaving(true);
    try {
      const res = await deoUpddateRecordEntry(recordId, body);
      const updated = res?.data?.record || res?.data;
      if (!updated?._id) throw new Error("Update failed");
      setRecord(updated);
      toast.success(wantsPacking ? "Packed / updated." : "Updated.");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- UI ---------- */
  const StepHeader = () => (
    <div className="w-[92%] md:w-[70%] lg:w-[60%] flex items-center justify-between text-white/80 mb-2">
      {["1. Details", "2. Parts Replaced", "3. Packing"].map((label, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = idx < step;
        return (
          <button
            key={label}
            type="button"
            onClick={() => tryGotoStep(idx)}
            className={
              "flex-1 text-center py-2 mx-1 rounded-lg border transition " +
              (active
                ? "border-indigo-400 bg-indigo-500/20 text-white"
                : done
                ? "border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                : "border-white/20 bg-white/5 hover:bg-white/10")
            }
            title={
              idx === 3 && !isPacked
                ? "Allowed only after each industry's replacements match its requirement"
                : ""
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const endUserOptions = useMemo(
    () => endUsers.map((u) => u.userId),
    [endUsers]
  );

  /* ---------- early loading ---------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <Spinner />
      </div>
    );
  }
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
    <div className="w-full pt-24 flex flex-col items-center space-y-6 pb-10 text-white">
      <h2 className="text-white text-lg md:text-2xl font-bold border p-2 rounded-lg">
        Record Entry{" "}
        {record?.productSrNo ? `— Serial: ${record.productSrNo}` : ""}
      </h2>

      <StepHeader />

      <div className="w-[92%] md:w-[70%] lg:w-[60%] space-y-6">
        {/* STEP 1 */}
        {step === 1 && (
          <>
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
                  disabled={!!recordId}
                />
                <Dropdown
                  label="Model"
                  options={modelOptions}
                  value={modelNumber}
                  onChange={setModelNumber}
                  disabled={!!recordId}
                />
              </div>

              <div className="mt-4">
                <label className="block text-white mb-1">
                  Product Serial Number
                </label>
                <input
                  className={inputCls}
                  value={productSrNo}
                  onChange={(e) => setProductSrNo(e.target.value)}
                  disabled={!!recordId}
                  placeholder="Enter product serial number"
                />
              </div>
            </div>

            <div className={cardCls}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Switch
                  label="Fault Reported"
                  value={faultReported}
                  onChange={setFaultReported}
                  disabled={!!recordId}
                />
                <Dropdown
                  label="Fault Analysed"
                  options={options["Fault Analysed"] || []}
                  value={faultAnalyzed}
                  onChange={setFaultAnalyzed}
                  disabled={!!recordId}
                />
                <Dropdown
                  label="Cosmetic Problem"
                  options={options["Cosmetic Problem"] || []}
                  value={cosmeticProblem}
                  onChange={setCosmeticProblem}
                  disabled={!!recordId}
                />
              </div>
            </div>

            <div className={cardCls}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Parts Required</h3>
                {!recordId && (
                  <button
                    type="button"
                    onClick={() =>
                      setReqLines((a) => [
                        ...a,
                        { industryName: "", qtyRequired: "" },
                      ])
                    }
                    className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/5 text-white"
                  >
                    + Add
                  </button>
                )}
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
                        options={Object.keys(stockMap)}
                        value={row.industryName}
                        onChange={(v) => setReqAt(idx, "industryName", v)}
                        disableAdd
                        disabled={!!recordId}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-white mb-1">
                        Qty Required *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className={inputCls}
                        value={row.qtyRequired}
                        onChange={(e) =>
                          setReqAt(idx, "qtyRequired", e.target.value)
                        }
                        disabled={!!recordId}
                      />
                    </div>

                    {!recordId && reqLines.length > 1 && (
                      <div className="md:col-span-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeReqLine(idx)}
                          className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveStep1}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"
              >
                {saving ? <DotLoader /> : recordId ? "Next" : "Save & Next"}
              </button>
            </div>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <div className={cardCls}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Parts Replaced</h3>
              </div>

              {reqIndustries.length === 0 ? (
                <div className="text-white/80">
                  No requirement industries found.
                </div>
              ) : (
                <div className="space-y-3">
                  {repAdds.map((row, idx) => {
                    const remaining = remMap[row.industryName] ?? 0;
                    const available = availableStock(row.industryName);
                    const requiredTotal = (record?.requirementLines || [])
                      .filter((r) => r.industryName === row.industryName)
                      .reduce((a, b) => a + (Number(b.qtyRequired) || 0), 0);
                    const alreadyRep = (record?.replacementLines || [])
                      .filter((r) => r.industryName === row.industryName)
                      .reduce((a, b) => a + (Number(b.qty) || 0), 0);

                    return (
                      <div
                        key={row.industryName || idx}
                        className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end"
                      >
                        <div className="md:col-span-3">
                          <label className="block text-white/90 mb-1">
                            Industry
                          </label>
                          <div className={readonlyCell}>
                            {row.industryName || "—"}
                          </div>
                        </div>
                        <div>
                          <label className="block text-white/90 mb-1">
                            Required
                          </label>
                          <div className={readonlyCell}>{requiredTotal}</div>
                        </div>
                        <div>
                          <label className="block text-white/90 mb-1">
                            Currently Replaced
                          </label>
                          <div className={readonlyCell}>{alreadyRep}</div>
                        </div>
                        <div>
                          <label className="block text-white mb-1">
                            Add Qty{" "}
                            <span className="text-white/60">
                              (Remain: {remaining}, Stock: {available})
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            className={inputCls}
                            value={row.qty}
                            onChange={(e) =>
                              setRepAddAt(idx, "qty", e.target.value)
                            }
                            disabled={isPacked}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={cardCls}>
              <label className="block text-white mb-1">Action Taken</label>
              <textarea
                className="w-full p-2 border rounded bg-slate-600 text-white"
                placeholder="What did you do?"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                disabled={isPacked}
              />
            </div>

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveStep2}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-60"
                  disabled={isPacked}
                  title={
                    isPacked
                      ? "Already packed"
                      : "Saves additions; will move to Packing only when ALL industries are fully replaced"
                  }
                >
                  {saving ? (
                    <DotLoader />
                  ) : (
                    "Save (Next page after replacing all parts)"
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 3 (only reachable when all industries satisfied or already packed) */}
        {step === 3 && (
          <>
            <div className={cardCls}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Dropdown
                  label="Packing Status"
                  options={["Pending", "Processing", "Completed"]}
                  value={packingStatus}
                  onChange={setPackingStatus}
                  disabled={isPacked}
                />
                <div className="md:col-span-2">
                  <label className="block text-white mb-1">Packing Date</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={packingDate}
                    onChange={(e) => setPackingDate(e.target.value)}
                    disabled={isPacked}
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-white mb-1">New Serial No</label>
                {/* NEW: same scanner UI as admin page */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    className={inputCls + " flex-1"}
                    value={newSrNo}
                    onChange={(e) => setNewSrNo(e.target.value)}
                    disabled={isPacked}
                  />
                  <button
                    type="button"
                    onClick={() => !isPacked && setScanning(true)}
                    disabled={isPacked}
                    className={`px-3 py-2 bg-white rounded text-black ${
                      isPacked ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    title={
                      isPacked ? "Already packed" : "Scan new serial number"
                    }
                  >
                    <img src={qrScan} alt="Scan" className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-white mb-1">Remarks</label>
                <textarea
                  className="w-full p-2 border rounded bg-slate-600 text-white"
                  placeholder="Remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={isPacked}
                />
              </div>

              <div className="mt-3">
                <label className="block text-white mb-1">
                  Action Taken (optional)
                </label>
                <textarea
                  className="w-full p-2 border rounded bg-slate-600 text-white"
                  placeholder="Additional notes"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  disabled={isPacked}
                />
              </div>

              <div className="mt-3">
                <Dropdown
                  label="Assign To (end-users)"
                  options={endUserOptions}
                  value={assignedUserIds}
                  onChange={setAssignedUserIds}
                  multiSelect
                  disabled={isPacked}
                />
                <div className="text-xs text-white/60 mt-1">
                  Multiple selections allowed. Applies on Save.
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveStep3}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"
                >
                  {saving ? <DotLoader /> : isPacked ? "Done" : "Save"}
                </button>
              </div>
            </div>

            {isPacked && (
              <div className="text-emerald-300/90">
                This record is packed (Completed). Further edits are locked.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
