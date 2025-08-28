import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Spinner from "../components/Spinner";
import { getRmReport, listPartsRequiredHeaderSubheader } from "../api/api";

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
  // end = today (not month end) as per your “start and end of current month”
  return {
    dateFrom: toISTDateKey(start),
    dateTo: toISTDateKey(today),
  };
}

/* --------------- sample (for instant preview) --------------- */
const SAMPLE_RECORD = [
  {
    "Date": "2025-08-28",
    "Product": "STABLIZER",
    "Model No": "ARIZOR 4150",
    "Product Sr No.": "25_altech_00001",
    "Fault Reported": "YES",
    "Fault Analysed(Functional)": "NOT WORKING",
    "Cosmetic Problem": "BODY DAMAGE",
    partsRequired: [
      {
        header: "PACKING MATERIALS",
        type: "tree",
        subHeader: "BABY CARTON",
        industryName: "baby crtnbn290x275x187 vg 100 supreme cherry",
        qty: 20,
      },
    ],
    partsReplaced: [
      {
        header: "PACKING MATERIALS",
        type: "tree",
        subHeader: "BABY CARTON",
        industryName: "baby crtnbn290x275x187 vg 100 supreme cherry",
        qty: 20,
        rate: 7.5,
      },
    ],
    totalCost: 150,
    "Action Taken": "",
    "Packing Status": "Completed",
    "Packing Date": "2025-08-28",
    "New Sr No.": "7539514862",
    Remarks: "",
    assignedTo: ["aneesh", "JAIDEV", "dilip"],
    submittedBy: "ayush",
  },
];

/* ---------------- styles ---------------- */
const inputCls =
  "w-full px-3 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";
const cardCls =
  "w-full p-4 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

/* ============================================================
   Dashboard
   ============================================================ */
export default function Dashboard() {
  /* ---------- filters (default to current month IST) ---------- */
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

  /* ---------- data ---------- */
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState([]); // listPartsRequiredHeaderSubheader().data.items
  const [columns, setColumns] = useState([]); // final columns to render
  const [rows, setRows] = useState([]);       // mapped rows
  const [groups, setGroups] = useState(null); // {bands, subBands}
  const [usingDemo, setUsingDemo] = useState(false);

  /* ---------- build columns (core + PR + RP) from catalog ---------- */
  const buildColumnsFromCatalog = (items) => {
    // Core "Details" columns
    const coreCols = [
      { key: "date", label: "Date" },
      { key: "product", label: "Product" },
      { key: "modelNumber", label: "Model No" },
      { key: "productSrNo", label: "Product Sr No." },
      { key: "faultReported", label: "Fault Reported" },
      { key: "faultAnalyzed", label: "Fault Analysed(Functional)" },
      { key: "cosmeticProblem", label: "Cosmetic Problem" },
      { key: "actionTaken", label: "Action Taken" },
      { key: "packingStatus", label: "Packing Status" },
      { key: "packingDate", label: "Packing Date" },
      { key: "newSrNo", label: "New Sr No." },
      { key: "remarks", label: "Remarks" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "submittedBy", label: "Submitted By" },
      { key: "totalCost", label: "Total Cost" },
    ];

    const prCols = [];
    const rpCols = [];
    const prSubBands = []; // [{title, count}]
    const rpSubBands = []; // [{title, count}]

    const list = Array.isArray(items) ? items : [];

    list.forEach((obj) => {
      const header = Object.keys(obj || {})[0];
      if (!header) return;
      const meta = obj[header] || {};
      const type = String(meta.type || "").toLowerCase();

      if (type === "flat") {
        // PR: one qty column
        prCols.push({
          key: `PR|FLAT|${header}`,
          label: `PR • ${header} • Qty`,
        });
        prSubBands.push({ title: header, count: 1 });

        // RP: qty + cost
        rpCols.push(
          { key: `RP|FLAT|${header}|QTY`, label: `RP • ${header} • Qty` },
          { key: `RP|FLAT|${header}|COST`, label: `RP • ${header} • Cost` }
        );
        rpSubBands.push({ title: header, count: 2 });
      } else if (type === "tree") {
        const subs = Array.isArray(meta.subHeaders) ? meta.subHeaders : [];
        // PR: one column per subHeader
        prSubBands.push({ title: header, count: subs.length || 1 });
        // RP: two per subHeader
        rpSubBands.push({ title: header, count: (subs.length || 1) * 2 });

        if (!subs.length) {
          // fallback: just a single unknown subHeader
          prCols.push({
            key: `PR|TREE|${header}|(unknown)`,
            label: `PR • ${header} • (unknown) — Qty`,
          });
          rpCols.push(
            {
              key: `RP|TREE|${header}|(unknown)|QTY`,
              label: `RP • ${header} • (unknown) — Qty`,
            },
            {
              key: `RP|TREE|${header}|(unknown)|COST`,
              label: `RP • ${header} • (unknown) — Cost`,
            }
          );
        } else {
          subs.forEach((subObj) => {
            const subHeader = Object.keys(subObj || {})[0];
            if (!subHeader) return;
            prCols.push({
              key: `PR|TREE|${header}|${subHeader}`,
              label: `PR • ${header} • ${subHeader} — Qty`,
            });
            rpCols.push(
              {
                key: `RP|TREE|${header}|${subHeader}|QTY`,
                label: `RP • ${header} • ${subHeader} — Qty`,
              },
              {
                key: `RP|TREE|${header}|${subHeader}|COST`,
                label: `RP • ${header} • ${subHeader} — Cost`,
              }
            );
          });
        }
      }
    });

    // Bands
    const detailsSpan = coreCols.length;
    const prStart = detailsSpan;
    const prEnd = prStart + prCols.length - 1;
    const rpStart = prEnd + 1;
    const rpEnd = rpStart + rpCols.length - 1;

    const bands = [];
    if (prCols.length) bands.push({ title: "Parts Required", startIndex: prStart, endIndex: prEnd });
    if (rpCols.length) bands.push({ title: "Parts Replaced", startIndex: rpStart, endIndex: rpEnd });

    const cols = [...coreCols, ...prCols, ...rpCols];
    const subBands = { partsRequired: prSubBands, partsReplaced: rpSubBands };

    return { columns: cols, groups: { bands, subBands } };
  };

  /* ---------- map API record[] to row objects that match columns ---------- */
  const mapRecordsToRows = (recordList, cols) => {
    const rowsOut = [];
    const colKeys = cols.map((c) => c.key);

    (Array.isArray(recordList) ? recordList : []).forEach((rec) => {
      // Core
      const base = {
        date: rec["Date"] ?? "—",
        product: rec["Product"] ?? "—",
        modelNumber: rec["Model No"] ?? "—",
        productSrNo: rec["Product Sr No."] ?? "—",
        faultReported: rec["Fault Reported"] ?? "—",
        faultAnalyzed: rec["Fault Analysed(Functional)"] ?? "—",
        cosmeticProblem: rec["Cosmetic Problem"] ?? "—",
        actionTaken: rec["Action Taken"] ?? "—",
        packingStatus: rec["Packing Status"] ?? "—",
        packingDate: rec["Packing Date"] ?? "—",
        newSrNo: rec["New Sr No."] ?? "—",
        remarks: rec["Remarks"] ?? "—",
        assignedTo: Array.isArray(rec.assignedTo) ? rec.assignedTo.join(", ") : (rec.assignedTo || "—"),
        submittedBy: rec.submittedBy ?? "—",
        totalCost: rec.totalCost ?? 0,
      };

      // PR values
      const prVals = {};
      const prArr = Array.isArray(rec.partsRequired) ? rec.partsRequired : [];
      prArr.forEach((item) => {
        const header = item.header || "";
        const type = (item.type || "").toLowerCase();
        const sub = item.subHeader || "";
        const qty = Number(item.qty || 0);

        let key;
        if (type === "tree") {
          key = `PR|TREE|${header}|${sub}`;
        } else {
          key = `PR|FLAT|${header}`;
        }
        prVals[key] = (prVals[key] || 0) + qty;
      });

      // RP values (Qty + Cost)
      const rpVals = {};
      const rpArr = Array.isArray(rec.partsReplaced) ? rec.partsReplaced : [];
      rpArr.forEach((item) => {
        const header = item.header || "";
        const type = (item.type || "").toLowerCase();
        const sub = item.subHeader || "";
        const qty = Number(item.qty || 0);
        const rate = Number(item.rate || 0);
        let qtyKey, costKey;

        if (type === "tree") {
          qtyKey = `RP|TREE|${header}|${sub}|QTY`;
          costKey = `RP|TREE|${header}|${sub}|COST`;
        } else {
          qtyKey = `RP|FLAT|${header}|QTY`;
          costKey = `RP|FLAT|${header}|COST`;
        }

        rpVals[qtyKey] = (rpVals[qtyKey] || 0) + qty;
        rpVals[costKey] = (rpVals[costKey] || 0) + qty * rate;
      });

      // merge + ensure all col keys exist
      const merged = { ...base, ...prVals, ...rpVals };
      colKeys.forEach((k) => {
        if (typeof merged[k] === "undefined") merged[k] = k.includes("COST") || k === "totalCost" ? 0 : 0;
      });

      rowsOut.push(merged);
    });

    return rowsOut;
  };

  /* ---------- querying ---------- */
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
    setUsingDemo(false);
    try {
      // 1) fetch catalog (headers / subheaders)
      const catRes = await listPartsRequiredHeaderSubheader();
      const catItems = catRes?.data?.data?.items || catRes?.data?.items || [];
      setCatalog(catItems);

      const { columns: cols, groups: grp } = buildColumnsFromCatalog(catItems);
      setColumns(cols);
      setGroups(grp);

      // 2) fetch report
      const params = {
        dateFrom: from,
        dateTo: to,
        q: q || undefined,
        productName: productName || undefined,
        modelNumber: modelNumber || undefined,
        productSrNo: productSrNo || undefined,
        packingStatus: packingStatus || undefined,
      };
      const repRes = await getRmReport(params);
      const record = repRes?.data?.data?.record || repRes?.data?.record || [];

      // If API returns empty, show sample
      const finalRows = record && record.length ? mapRecordsToRows(record, cols) : mapRecordsToRows(SAMPLE_RECORD, cols);
      setRows(finalRows);
      if (!record || !record.length) {
        setUsingDemo(true);
        toast.info("API returned no rows — showing sample data.");
      }
    } catch (e) {
      console.error(e);
      setUsingDemo(true);
      toast.error(e?.response?.data?.message || "Failed to load report. Showing sample.");
      // Try to build columns from a minimal synthetic catalog for sample
      const syntheticCatalog = [
        { "PACKING MATERIALS": { type: "tree", subHeaders: [{ "BABY CARTON": {} }] } },
      ];
      setCatalog(syntheticCatalog);
      const { columns: cols, groups: grp } = buildColumnsFromCatalog(syntheticCatalog);
      setColumns(cols);
      setGroups(grp);
      setRows(mapRecordsToRows(SAMPLE_RECORD, cols));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load with current month range
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
                placeholder="e.g. STABLIZER"
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

            <div className="md:col-span-3 flex items-end gap-2">
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
                onClick={() => {
                  // build columns from minimal synthetic catalog + load sample row
                  const syntheticCatalog = [
                    { "PACKING MATERIALS": { type: "tree", subHeaders: [{ "BABY CARTON": {} }] } },
                  ];
                  const { columns: cols, groups: grp } = buildColumnsFromCatalog(syntheticCatalog);
                  setColumns(cols);
                  setGroups(grp);
                  setRows(mapRecordsToRows(SAMPLE_RECORD, cols));
                  setUsingDemo(true);
                  toast.success("Loaded sample data");
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
              >
                Load sample data
              </button>
            </div>
          </div>
          {usingDemo && (
            <div className="mt-3 text-amber-300 text-sm">
              Showing sample data. Click <b>Apply</b> to hit the API.
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="w-full min-w-[1200px] table-auto border-collapse">
          {columns.length > 0 && (
            <thead>
              {/* Row A: Bands */}
              <tr>
                {headerMeta.detailsSpan > 0 && (
                  <th
                    className="sticky top-0 bg-gradient-to-b from-slate-200 to-slate-300 text-black px-4 py-2 border border-[#162134] text-left"
                    colSpan={headerMeta.detailsSpan}
                  >
                    Details
                  </th>
                )}
                {headerMeta.bandSpans.map((b, i) => (
                  <th
                    key={`band-${i}`}
                    className="sticky top-0 bg-gradient-to-b from-slate-200 to-slate-300 text-black px-4 py-2 border border-[#162134] text-left"
                    colSpan={b.span}
                  >
                    {b.title}
                  </th>
                ))}
              </tr>

              {/* Row B: Sub-bands */}
              {groups?.subBands ? (
                <tr>
                  {/* spacer for Details */}
                  {headerMeta.detailsSpan > 0 && (
                    <th
                      className="sticky top-[37px] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left"
                      colSpan={headerMeta.detailsSpan}
                    />
                  )}
                  {/* partsRequired sub-bands */}
                  {(groups?.subBands?.partsRequired || []).map((s, i) => (
                    <th
                      key={`pr-${i}`}
                      className="sticky top-[37px] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left"
                      colSpan={Number(s.count) || 1}
                    >
                      {s.title}
                    </th>
                  ))}
                  {/* partsReplaced sub-bands */}
                  {(groups?.subBands?.partsReplaced || []).map((s, i) => (
                    <th
                      key={`rp-${i}`}
                      className="sticky top-[37px] bg-slate-200 text-black px-4 py-2 border border-[#162134] text-left"
                      colSpan={Number(s.count) || 1}
                    >
                      {s.title}
                    </th>
                  ))}
                </tr>
              ) : null}

              {/* Row C: Actual column labels */}
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="sticky top-[74px] bg-slate-300 text-black px-4 py-2 border border-[#162134] text-left"
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
                      typeof val === "number" ? val : (val ?? "—");
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
