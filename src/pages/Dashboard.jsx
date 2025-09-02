import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import Spinner from "../components/Spinner";
import Dropdown from "../components/Dropdown"; // Make sure the path is correct

// API
import {
  getRmReport,
  listPartsRequiredHeaderSubheader,
  exportRmReport,
} from "../api/api";

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";

const cardCls =
  "w-full p-4 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

export default function Dashboard() {
  // Filters State
  const [scope, setScope] = useState("thisMonth"); // 'thisMonth', 'range', 'today', 'all'
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [productName, setProductName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [productSrNo, setProductSrNo] = useState("");
  const [packingStatus, setPackingStatus] = useState("");

  // Data State
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState(null);

  /* ---------- helpers: read catalog structure ---------- */
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
    const left = [
      { key: "srNo", label: "Sr. No." },
      { key: "Date", label: "Date" },
      { key: "Product", label: "Product" },
      { key: "Model No", label: "Model No" },
      { key: "Product Sr No.", label: "Product Sr No." },
      { key: "Fault Reported", label: "Fault Reported" },
      {
        key: "Fault Analysed(Functional)",
        label: "Fault Analysed(Functional)",
      },
      { key: "Cosmetic Problem", label: "Cosmetic Problem" },
    ];

    const PR_GROUPS = [];
    const RP_GROUPS = [];
    const prSubBands = [];
    const rpSubBands = [];

    const safeItems = Array.isArray(items) ? items : [];
    safeItems.forEach((obj) => {
      const header = Object.keys(obj || {})[0];
      if (!header) return;
      const meta = obj[header] || {};
      const type = String(meta.type || "").toLowerCase();

      if (type === "flat") {
        PR_GROUPS.push([
          { key: `PR|FLAT|${header}|NAMES`, label: header },
          { key: `PR|FLAT|${header}|QTY`, label: "Qty" },
        ]);
        prSubBands.push({ title: header, count: 2, type: "flat" });

        RP_GROUPS.push([
          { key: `RP|FLAT|${header}|NAMES`, label: header },
          { key: `RP|FLAT|${header}|QTY`, label: "Qty" },
          { key: `RP|FLAT|${header}|COST`, label: "Cost" },
        ]);
        rpSubBands.push({ title: header, count: 3, type: "flat" });
      } else if (type === "tree") {
        const subs = extractSubHeaders(meta);
        const subCount = Math.max(1, subs.length);
        prSubBands.push({ title: header, count: subCount * 2, type: "tree" });
        rpSubBands.push({ title: header, count: subCount * 3, type: "tree" });
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

    const right = [
      { key: "Action Taken", label: "Action Taken" },
      { key: "Packing Status", label: "Packing Status" },
      { key: "Packing Date", label: "Packing Date" },
      { key: "New Sr No.", label: "New Sr No." },
      { key: "Remarks", label: "Remarks" },
    ];

    const prStart = left.length;
    const prColsCount = PR_GROUPS.reduce((s, g) => s + g.length, 0);
    const rpStart = prStart + prColsCount;
    const rpColsCount = RP_GROUPS.reduce((s, g) => s + g.length, 0);

    const bands = [];
    if (prColsCount > 0)
      bands.push({
        title: "Parts Required",
        startIndex: prStart,
        endIndex: prStart + prColsCount - 1,
      });
    if (rpColsCount > 0)
      bands.push({
        title: "Parts Replaced",
        startIndex: rpStart,
        endIndex: rpStart + rpColsCount - 1,
      });

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
    return (records || []).map((rec, index) => {
      const base = {
        srNo: index + 1,
        Date: rec["Date"] ?? "—",
        Product: rec["Product"] ?? "—",
        "Model No": rec["Model No"] ?? "—",
        "Product Sr No.": rec["Product Sr No."] ?? "—",
        "Fault Reported": rec["Fault Reported"] ?? "—",
        "Fault Analysed(Functional)": rec["Fault Analysed(Functional)"] ?? "—",
        "Cosmetic Problem": rec["Cosmetic Problem"] ?? "—",
        "Action Taken": rec["Action Taken"] ?? "—",
        "Packing Status": rec["Packing Status"] ?? "—",
        "Packing Date": rec["Packing Date"] ?? "—",
        "New Sr No.": rec["New Sr No."] ?? "—",
        Remarks: rec["Remarks"] ?? "—",
      };

      const merged = { ...base };
      const pr = rec?.partsRequired || {};
      (pr.flat || []).forEach((r) => {
        merged[`PR|FLAT|${r.header}|NAMES`] = r.industryNames || "";
        merged[`PR|FLAT|${r.header}|QTY`] = Number(r.qty || 0);
      });
      (pr.tree || []).forEach((r) => {
        merged[`PR|TREE|${r.header}|${r.subHeader}|NAMES`] =
          r.industryNames || "";
        merged[`PR|TREE|${r.header}|${r.subHeader}|QTY`] = Number(r.qty || 0);
      });

      const rp = rec?.partsReplaced || {};
      (rp.flat || []).forEach((r) => {
        merged[`RP|FLAT|${r.header}|NAMES`] = r.industryNames || "";
        merged[`RP|FLAT|${r.header}|QTY`] = Number(r.qty || 0);
        merged[`RP|FLAT|${r.header}|COST`] = Number(r.cost || 0);
      });
      (rp.tree || []).forEach((r) => {
        merged[`RP|TREE|${r.header}|${r.subHeader}|NAMES`] =
          r.industryNames || "";
        merged[`RP|TREE|${r.header}|${r.subHeader}|QTY`] = Number(r.qty || 0);
        merged[`RP|TREE|${r.header}|${r.subHeader}|COST`] = Number(r.cost || 0);
      });

      cols.forEach((c) => {
        if (typeof merged[c.key] === "undefined") {
          merged[c.key] =
            c.key.endsWith("|QTY") || c.key.endsWith("|COST") ? 0 : "";
        }
      });
      return merged;
    });
  };

  /* ---------- API parameter builder ---------- */
  const buildApiParams = () => {
    const params = {
      scope,
      q: q || undefined,
      productName: productName || undefined,
      modelNumber: modelNumber || undefined,
      productSrNo: productSrNo || undefined,
      packingStatus: packingStatus || undefined,
    };
    if (scope === "range") {
      params.dateFrom = dateFrom;
      params.dateTo = dateTo;
    }
    return params;
  };

  /* ---------- fetch & wire ---------- */
  const fetchEverything = async () => {
    if (scope === "range" && (!dateFrom || !dateTo)) {
      toast.error("Both From and To dates are required for Date Range scope.");
      return;
    }
    if (scope === "range" && new Date(dateTo) < new Date(dateFrom)) {
      toast.error("To date cannot be before From date.");
      return;
    }

    setLoading(true);
    try {
      const catRes = await listPartsRequiredHeaderSubheader();
      const catItems = catRes?.data?.data?.items || catRes?.data?.items || [];
      const { columns: cols, groups: grp } = buildColumnsFromCatalog(catItems);
      setColumns(cols);
      setGroups(grp);

      const apiParams = buildApiParams();
      const repRes = await getRmReport(apiParams);
      const records =
        repRes?.data?.data?.records || repRes?.data?.records || [];
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
    fetchEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setScope("thisMonth");
    setDateFrom("");
    setDateTo("");
    setQ("");
    setProductName("");
    setModelNumber("");
    setProductSrNo("");
    setPackingStatus("");
  };

  /* ---------- header meta for bands/sub-bands ---------- */
  const headerMeta = useMemo(() => {
    if (!columns || !groups) return { detailsSpan: 0, bandSpans: [] };
    const bands = Array.isArray(groups.bands) ? groups.bands : [];
    const bandSpans = bands.map((b) => {
      const s = Number(b.startIndex) || 0;
      const e = Number(b.endIndex) || s;
      return { title: b.title || "", span: e - s + 1 };
    });
    return { bandSpans };
  }, [columns, groups]);

  /* ---------- download Excel ---------- */
  const handleDownload = async () => {
    try {
      setExporting(true);
      const apiParams = buildApiParams();
      const res = await exportRmReport(apiParams);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const cd = res.headers?.["content-disposition"] || "";
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
      const filename = decodeURIComponent(
        match?.[1] || match?.[2] || `rm-report.xlsx`
      );
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
      setExporting(false);
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
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-4 items-end">
            <div className="md:col-span-3">
              <Dropdown
                label="Scope"
                options={["This Month", "Date Range", "Today", "All"]}
                value={
                  scope === "thisMonth"
                    ? "This Month"
                    : scope === "range"
                    ? "Date Range"
                    : scope === "today"
                    ? "Today"
                    : "All"
                }
                onChange={(label) => {
                  const v =
                    label === "This Month"
                      ? "thisMonth"
                      : label === "Date Range"
                      ? "range"
                      : label === "Today"
                      ? "today"
                      : "all";
                  setScope(v);
                }}
                disableSearch
              />
            </div>

            {scope === "range" && (
              <>
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
              </>
            )}

            <div className="md:col-span-3">
              <label className="block text-sm mb-1">Search (q)</label>
              <input
                className={inputCls}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Text search"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">Product Name</label>
              <input
                className={inputCls}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. STABILIZER"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">Model Number</label>
              <input
                className={inputCls}
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                placeholder="e.g. ARIZOR 4150"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1">Product Serial No.</label>
              <input
                className={inputCls}
                value={productSrNo}
                onChange={(e) => setProductSrNo(e.target.value)}
                placeholder="e.g. 25_xxx_00001"
              />
            </div>
            <div className="md:col-span-3">
              <Dropdown
                label="Packing Status"
                options={["Any", "Pending", "Processing", "Completed"]}
                value={packingStatus || "Any"}
                onChange={(v) => setPackingStatus(v === "Any" ? "" : v)}
                disableSearch
              />
            </div>

            <div className="md:col-span-4 flex items-end gap-2">
              <button
                type="button"
                onClick={fetchEverything}
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
                disabled={exporting}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-shadow shadow-md hover:shadow-lg disabled:opacity-60"
                title="Export current selection as .xlsx"
              >
                {exporting ? "Exporting…" : "Export (.xlsx)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-auto custom-scrollbar max-h-[450px] rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
        <table className="w-full min-w-[1200px] table-auto border-collapse">
          {columns.length > 0 && (
            <thead className="text-black">
              {(() => {
                const dynamicStartIndex = columns.findIndex((c) =>
                  c.key.includes("|")
                );
                let dynamicEndIndex = -1;
                for (let i = columns.length - 1; i >= 0; i--) {
                  if (columns[i].key.includes("|")) {
                    dynamicEndIndex = i;
                    break;
                  }
                }
                const finalLeftCols =
                  dynamicStartIndex === -1
                    ? columns
                    : columns.slice(0, dynamicStartIndex);
                const dynamicCols =
                  dynamicStartIndex === -1
                    ? []
                    : columns.slice(dynamicStartIndex, dynamicEndIndex + 1);
                const finalRightCols =
                  dynamicStartIndex === -1
                    ? []
                    : columns.slice(dynamicEndIndex + 1);
                const staticColor = "#ffc000";
                const requiredColor = "#e6b8b7";
                const replacedColor = "#b8cce4";
                return (
                  <>
                    <tr>
                      {finalLeftCols.map((c) => (
                        <th
                          key={c.key}
                          className="sticky top-0 px-4 py-2 border border-[#162134] text-left align-middle"
                          style={{ backgroundColor: staticColor }}
                          rowSpan={3}
                        >
                          {c.label || c.key}
                        </th>
                      ))}
                      {headerMeta.bandSpans.map((b, i) => (
                        <th
                          key={`band-${i}`}
                          className="sticky top-0 px-4 py-2 border border-[#162134] text-center"
                          style={{
                            backgroundColor:
                              b.title === "Parts Required"
                                ? requiredColor
                                : replacedColor,
                          }}
                          colSpan={b.span}
                        >
                          {b.title}
                        </th>
                      ))}
                      {finalRightCols.map((c) => (
                        <th
                          key={c.key}
                          className="sticky top-0 px-4 py-2 border border-[#162134] text-left align-middle"
                          style={{ backgroundColor: staticColor }}
                          rowSpan={3}
                        >
                          {c.label || c.key}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {(groups?.subBands?.partsRequired || []).map((sb) => {
                        if (sb.type === "tree") {
                          return (
                            <th
                              key={`pr-sb-${sb.title}`}
                              className="sticky top-[40px] px-4 py-2 border border-[#162134] text-center"
                              style={{ backgroundColor: requiredColor }}
                              colSpan={sb.count}
                            >
                              {" "}
                              {sb.title}{" "}
                            </th>
                          );
                        } else {
                          const flatCols = dynamicCols.filter((c) =>
                            c.key.startsWith(`PR|FLAT|${sb.title}|`)
                          );
                          return flatCols.map((c) => (
                            <th
                              key={c.key}
                              className="sticky top-[40px] px-4 py-2 border border-[#162134] text-left align-middle"
                              style={{ backgroundColor: requiredColor }}
                              rowSpan={2}
                            >
                              {" "}
                              {c.label || c.key}{" "}
                            </th>
                          ));
                        }
                      })}
                      {(groups?.subBands?.partsReplaced || []).map((sb) => {
                        if (sb.type === "tree") {
                          return (
                            <th
                              key={`rp-sb-${sb.title}`}
                              className="sticky top-[40px] px-4 py-2 border border-[#162134] text-center"
                              style={{ backgroundColor: replacedColor }}
                              colSpan={sb.count}
                            >
                              {" "}
                              {sb.title}{" "}
                            </th>
                          );
                        } else {
                          const flatCols = dynamicCols.filter((c) =>
                            c.key.startsWith(`RP|FLAT|${sb.title}|`)
                          );
                          return flatCols.map((c) => (
                            <th
                              key={c.key}
                              className="sticky top-[40px] px-4 py-2 border border-[#162134] text-left align-middle"
                              style={{ backgroundColor: replacedColor }}
                              rowSpan={2}
                            >
                              {" "}
                              {c.label || c.key}{" "}
                            </th>
                          ));
                        }
                      })}
                    </tr>
                    <tr>
                      {dynamicCols
                        .filter((c) => c.key.includes("|TREE|"))
                        .map((c) => (
                          <th
                            key={c.key}
                            className="sticky top-[80px] px-4 py-2 border border-[#162134] text-left"
                            style={{
                              backgroundColor: c.key.startsWith("PR|")
                                ? requiredColor
                                : replacedColor,
                            }}
                            title={c.key}
                          >
                            {" "}
                            {c.label || c.key}{" "}
                          </th>
                        ))}
                    </tr>
                  </>
                );
              })()}
            </thead>
          )}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, columns.length)}
                  className="text-center text-white/80 px-4 py-6"
                >
                  {" "}
                  No rows.{" "}
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
                    const display = typeof val === "number" ? val : val ?? "";
                    return (
                      <td
                        key={c.key}
                        className="border border-[#162134] px-4 py-2 whitespace-nowrap"
                      >
                        {" "}
                        {display}{" "}
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
