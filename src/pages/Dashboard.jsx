import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Spinner from "../components/Spinner";
import { getRmReport, listPartsRequiredHeaderSubheader, exportRmReport } from "../api/api";

/* ---------------- IST date helpers ---------------- */
function nowIST() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60000);
}
function toISTDateKey(dLike) {
  try {
    const d0 = dLike instanceof Date ? dLike : new Date(dLike);
    const utc = d0.getTime() + d0.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 60 * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`;
  } catch {
    return "";
  }
}
function currentMonthRangeIST() {
  const today = nowIST();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    dateFrom: toISTDateKey(start),
    dateTo: toISTDateKey(today),
  };
}

/* ---------------- styles ---------------- */
const inputCls =
  "w-full px-3 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";
const cardCls =
  "w-full p-4 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

/* ============================================================
   Dashboard (RM Report)
   ============================================================ */
export default function Dashboard() {
  // filters (default: this month IST)
  const { dateFrom: monthStart, dateTo: monthEnd } = useMemo(
    () => currentMonthRangeIST(),
    []
  );
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(monthEnd);
  const [q, setQ] = useState("");
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [productSrNo, setProductSrNo] = useState("");
  const [packingStatus, setPackingStatus] = useState("");

  // data
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState([]); // /parts-required/unique -> data.items
  const [columns, setColumns] = useState([]); // final columns
  const [rows, setRows] = useState([]);       // final rows
  const [groups, setGroups] = useState(null); // bands + subBands

  /* ---------- helpers: read catalog structure ---------- */
  // catalog item example (from your controller):
  // { "PACKING MATERIALS": { type:"tree", subHeaders:[ {"BABY CARTON":{...}}, {"BUBBLE":{...}} ] } }
  function extractSubHeaders(payload) {
    const arr = [];
    const raw = payload?.subHeaders || payload?.subheaders || [];
    for (const s of raw) {
      if (!s) continue;
      if (typeof s === "string") arr.push(s);
      else {
        const k = Object.keys(s || {})[0];
        if (k) arr.push(k);
      }
    }
    return arr;
  }

  /* ---------- columns builder (exact Excel order) ---------- */
  const buildColumnsFromCatalog = (items) => {
    // static left (exact order)
    const left = [
      { key: "Date", label: "Date" },
      { key: "Product", label: "Product" },
      { key: "Model No", label: "Model No" },
      { key: "Product Sr No.", label: "Product Sr No." },
      { key: "Fault Reported", label: "Fault Reported" },
      { key: "Fault Analysed(Functional)", label: "Fault Analysed(Functional)" },
      { key: "Cosmetic Problem", label: "Cosmetic Problem" },
    ];

    // PR & RP dynamic blocks
    const PR_GROUPS = [];
    const RP_GROUPS = [];
    const prSubBands = [];
    const rpSubBands = [];

    const safeItems = Array.isArray(items) ? items : [];
    // keep headers sorted as backend already returns sorted, but sort defensively
    safeItems.forEach((obj) => {
      const header = Object.keys(obj || {})[0];
      if (!header) return;
      const meta = obj[header] || {};
      const type = String(meta.type || "").toLowerCase();

      if (type === "flat") {
        // PR: Names + Qty
        PR_GROUPS.push([
          { key: `PR|FLAT|${header}|NAMES`, label: header }, // names cell
          { key: `PR|FLAT|${header}|QTY`, label: "Qty" },
        ]);
        prSubBands.push({ title: header, count: 2 });

        // RP: Names + Qty + Cost
        RP_GROUPS.push([
          { key: `RP|FLAT|${header}|NAMES`, label: header },
          { key: `RP|FLAT|${header}|QTY`, label: "Qty" },
          { key: `RP|FLAT|${header}|COST`, label: "Cost" },
        ]);
        rpSubBands.push({ title: header, count: 3 });
      } else if (type === "tree") {
        const subs = extractSubHeaders(meta);
        const subCount = Math.max(1, subs.length);

        prSubBands.push({ title: header, count: subCount * 2 });
        rpSubBands.push({ title: header, count: subCount * 3 });

        if (!subs.length) {
          PR_GROUPS.push([
            { key: `PR|TREE|${header}|(unknown)|NAMES`, label: "(unknown)" },
            { key: `PR|TREE|${header}|(unknown)|QTY`, label: "Qty" },
          ]);
          RP_GROUPS.push([
            { key: `RP|TREE|${header}|(unknown)|NAMES`, label: "(unknown)" },
            { key: `RP|TREE|${header}|(unknown)|QTY`, label: "Qty" },
            { key: `RP|TREE|${header}|(unknown)|COST`, label: "Cost" },
          ]);
        } else {
          subs.forEach((sub) => {
            PR_GROUPS.push([
              { key: `PR|TREE|${header}|${sub}|NAMES`, label: sub },
              { key: `PR|TREE|${header}|${sub}|QTY`, label: "Qty" },
            ]);
            RP_GROUPS.push([
              { key: `RP|TREE|${header}|${sub}|NAMES`, label: sub },
              { key: `RP|TREE|${header}|${sub}|QTY`, label: "Qty" },
              { key: `RP|TREE|${header}|${sub}|COST`, label: "Cost" },
            ]);
          });
        }
      }
    });

    // static right (exact order)
    const right = [
      { key: "Action Taken", label: "Action Taken" },
      { key: "Packing Status", label: "Packing Status" },
      { key: "Packing Date", label: "Packing Date" },
      { key: "New Sr No.", label: "New Sr No." },
      { key: "Remarks", label: "Remarks" },
    ];

    // bands (row A)
    const prStart = left.length;
    const prColsCount = PR_GROUPS.reduce((s, g) => s + g.length, 0);
    const rpStart = prStart + prColsCount;
    const rpColsCount = RP_GROUPS.reduce((s, g) => s + g.length, 0);

    const bands = [];
    if (prColsCount) bands.push({ title: "Parts Required", startIndex: prStart, endIndex: prStart + prColsCount - 1 });
    if (rpColsCount) bands.push({ title: "Parts Replaced", startIndex: rpStart, endIndex: rpStart + rpColsCount - 1 });

    const columns = [
      ...left,
      ...PR_GROUPS.flat(),
      ...RP_GROUPS.flat(),
      ...right,
    ];
    const subBands = { partsRequired: prSubBands, partsReplaced: rpSubBands };

    return { columns, groups: { bands, subBands } };
  };

  /* ---------- mapper from API records to row values ---------- */
  const mapRecordsToRows = (records, cols) => {
    const rowsOut = [];
    const colKeys = cols.map((c) => c.key);

    for (const rec of records || []) {
      // base static fields (exact keys as we agreed)
      const base = {
        "Date": rec["Date"] ?? "—",
        "Product": rec["Product"] ?? "—",
        "Model No": rec["Model No"] ?? "—",
        "Product Sr No.": rec["Product Sr No."] ?? "—",
        "Fault Reported": rec["Fault Reported"] ?? "—",
        "Fault Analysed(Functional)": rec["Fault Analysed(Functional)"] ?? "—",
        "Cosmetic Problem": rec["Cosmetic Problem"] ?? "—",
        "Action Taken": rec["Action Taken"] ?? "—",
        "Packing Status": rec["Packing Status"] ?? "—",
        "Packing Date": rec["Packing Date"] ?? "—",
        "New Sr No.": rec["New Sr No."] ?? "—",
        "Remarks": rec["Remarks"] ?? "—",
      };

      const merged = { ...base };

      // PR values come as { flat:[{header, industryNames, qty}], tree:[{header, subHeader, industryNames, qty}] }
      const pr = rec?.partsRequired || {};
      for (const r of pr.flat || []) {
        merged[`PR|FLAT|${r.header}|NAMES`] = r.industryNames || "";
        merged[`PR|FLAT|${r.header}|QTY`] = Number(r.qty || 0);
      }
      for (const r of pr.tree || []) {
        merged[`PR|TREE|${r.header}|${r.subHeader}|NAMES`] = r.industryNames || "";
        merged[`PR|TREE|${r.header}|${r.subHeader}|QTY`] = Number(r.qty || 0);
      }

      // RP values { flat:[{header, industryNames, qty, cost}], tree:[{header, subHeader, industryNames, qty, cost}] }
      const rp = rec?.partsReplaced || {};
      for (const r of rp.flat || []) {
        merged[`RP|FLAT|${r.header}|NAMES`] = r.industryNames || "";
        merged[`RP|FLAT|${r.header}|QTY`] = Number(r.qty || 0);
        merged[`RP|FLAT|${r.header}|COST`] = Number(r.cost || 0);
      }
      for (const r of rp.tree || []) {
        merged[`RP|TREE|${r.header}|${r.subHeader}|NAMES`] = r.industryNames || "";
        merged[`RP|TREE|${r.header}|${r.subHeader}|QTY`] = Number(r.qty || 0);
        merged[`RP|TREE|${r.header}|${r.subHeader}|COST`] = Number(r.cost || 0);
      }

      // ensure all keys exist
      for (const k of colKeys) {
        if (typeof merged[k] === "undefined") {
          merged[k] =
            k.endsWith("|QTY") || k.endsWith("|COST")
              ? 0
              : ""; // names cells default blank
        }
      }

      rowsOut.push(merged);
    }
    return rowsOut;
  };

  /* ---------- fetch & wire ---------- */
  const fetchEverything = async (opts = {}) => {
    const from = opts.dateFrom ?? dateFrom;
    const to = opts.dateTo ?? dateTo;

    if (!from || !to) {
      toast.error("Both From and To dates are required.");
      return;
    }
    if (new Date(to) < new Date(from)) {
      toast.error("To date cannot be before From date.");
      return;
    }

    setLoading(true);
    try {
      // 1) Catalog (headers & subheaders universe)
      const catRes = await listPartsRequiredHeaderSubheader();
      const catItems = catRes?.data?.data?.items || catRes?.data?.items || [];
      setCatalog(catItems);
      const { columns: cols, groups: grp } = buildColumnsFromCatalog(catItems);
      setColumns(cols);
      setGroups(grp);

      // 2) Report data
      const params = {
        scope: "range",
        dateFrom: from,
        dateTo: to,
        q: q || undefined,
        productName: productName || undefined,
        modelNumber: modelNumber || undefined,
        productSrNo: productSrNo || undefined,
        packingStatus: packingStatus || undefined,
      };
      const repRes = await getRmReport(params);
      const records =
        repRes?.data?.data?.records ||
        repRes?.data?.records ||
        repRes?.data?.data?.record || // fallback if older name
        repRes?.data?.record ||
        [];

      setRows(mapRecordsToRows(records, cols));
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to load report");
      setColumns([]);
      setRows([]);
      setGroups(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEverything({ dateFrom, dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    const r = currentMonthRangeIST();
    setDateFrom(r.dateFrom);
    setDateTo(r.dateTo);
    setQ("");
    setProductName("");
    setModelNumber("");
    setProductSrNo("");
    setPackingStatus("");
  };

  /* ---------- header meta for bands/sub-bands ---------- */
  const headerMeta = useMemo(() => {
    const cols = columns || [];
    const g = groups || {};
    const bands = Array.isArray(g.bands) ? g.bands : [];

    let detailsSpan = 0;
    if (bands.length && typeof bands[0].startIndex === "number") {
      detailsSpan = Math.max(0, bands[0].startIndex);
    } else {
      detailsSpan = cols.length;
    }
    const bandSpans = bands.map((b) => {
      const s = Number(b.startIndex) || 0;
      const e = Number(b.endIndex) || s;
      return { title: b.title || "", span: e - s + 1 };
    });
    return { detailsSpan, bandSpans };
  }, [columns, groups]);

  /* ---------- download Excel ---------- */
  const handleDownload = async () => {
    try {
      setLoading(true);
      const params = {
        scope: "range",
        dateFrom,
        dateTo,
        q: q || undefined,
        productName: productName || undefined,
        modelNumber: modelNumber || undefined,
        productSrNo: productSrNo || undefined,
        packingStatus: packingStatus || undefined,
      };
      const res = await exportRmReport(params);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Try to read filename from header; fallback
      const cd = res.headers?.["content-disposition"] || "";
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
      const filename = decodeURIComponent(match?.[1] || match?.[2] || `rm-report-${dateFrom}_to_${dateTo}.xlsx`);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to download Excel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pt-24 text-white">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
          <Spinner />
        </div>
      )}

      {/* Filters */}
      <div className="relative z-[60] flex flex-col gap-4 mb-4">
        <div className={`${cardCls} overflow-visible`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">From (Date)</label>
              <input
                type="date"
                className={inputCls}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">To (Date)</label>
              <input
                type="date"
                className={inputCls}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Search (q)</label>
              <input
                className={inputCls}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Text search"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Product Name</label>
              <input
                className={inputCls}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. STABILIZER"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Model Number</label>
              <input
                className={inputCls}
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                placeholder="e.g. ARIZOR 4150"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Product Serial No.</label>
              <input
                className={inputCls}
                value={productSrNo}
                onChange={(e) => setProductSrNo(e.target.value)}
                placeholder="e.g. 25_xxx_00001"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Packing Status</label>
              <select
                className={inputCls}
                value={packingStatus}
                onChange={(e) => setPackingStatus(e.target.value)}
              >
                <option value="">Any</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="md:col-span-4 flex items-end gap-2">
              <button
                type="button"
                onClick={() => fetchEverything()}
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
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                title="Download Excel"
              >
                Download Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="w-full min-w-[1200px] table-auto border-collapse">
          {columns.length > 0 && (
            <thead>
              {/* Row A: Bands (Details / Parts Required / Parts Replaced) */}
              <tr>
                {headerMeta.detailsSpan > 0 && (
                  <th
                    className="sticky top-0 bg-[#FFC000] text-black px-4 py-2 border border-[#162134] text-center"
                    colSpan={headerMeta.detailsSpan}
                  >
                    Details
                  </th>
                )}
                {headerMeta.bandSpans.map((b, i) => (
                  <th
                    key={`band-${i}`}
                    className="sticky top-0 bg-[#FFC000] text-black px-4 py-2 border border-[#162134] text-center"
                    colSpan={b.span}
                  >
                    {b.title}
                  </th>
                ))}
              </tr>

              {/* Row B: Sub-bands (each header title centered, spans its leaf cols) */}
              {groups?.subBands ? (
                <tr>
                  {/* spacer for Details */}
                  {headerMeta.detailsSpan > 0 && (
                    <th
                      className="sticky top-[40px] bg-slate-200 text-black px-4 py-2 border border-[#162134]"
                      colSpan={headerMeta.detailsSpan}
                    />
                  )}
                  {/* partsRequired sub-bands */}
                  {(groups?.subBands?.partsRequired || []).map((s, i) => (
                    <th
                      key={`pr-${i}`}
                      className="sticky top-[40px] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-center"
                      colSpan={Number(s.count) || 1}
                    >
                      {s.title}
                    </th>
                  ))}
                  {/* partsReplaced sub-bands */}
                  {(groups?.subBands?.partsReplaced || []).map((s, i) => (
                    <th
                      key={`rp-${i}`}
                      className="sticky top-[40px] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-center"
                      colSpan={Number(s.count) || 1}
                    >
                      {s.title}
                    </th>
                  ))}
                </tr>
              ) : null}

              {/* Row C: Leaf column labels */}
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="sticky top-[80px] bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left"
                    title={c.key}
                  >
                    {c.label || c.key}
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, columns.length)}
                  className="text-center text-white/80 px-4 py-6"
                >
                  No rows.
                </td>
              </tr>
            ) : (
              rows.map((r, ri) => (
                <tr
                  key={ri}
                  className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors"
                >
                  {columns.map((c) => {
                    const val = r[c.key];
                    const display =
                      typeof val === "number" ? val : (val ?? "");
                    return (
                      <td
                        key={c.key}
                        className="border border-[#162134] px-4 py-2 whitespace-nowrap"
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
