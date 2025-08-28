// src/pages/DailyConsumption.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import Spinner from "../components/Spinner";
import Dropdown from "../components/Dropdown";

// API
import { getDailyConsumption, exportDailyConsumption } from "../api/api";

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border border-white transition-colors " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";

const cardCls =
  "w-full p-4 bg-white/10 backdrop-blur-md rounded-xl shadow-lg shadow-black/40 border border-white/10";

function toISTDateKey(d) {
  try {
    const date = new Date(d);
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 60 * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${ist.getFullYear()}-${pad(ist.getMonth() + 1)}-${pad(ist.getDate())}`;
  } catch {
    return "";
  }
}

// First day of current month (IST) and today's date (IST)
function thisMonthRangeIST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 60 * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = ist.getFullYear();
  const MM = pad(ist.getMonth() + 1);
  const from = `${YYYY}-${MM}-01`;
  const to = toISTDateKey(ist); // today in IST
  return { from, to };
}

export default function DailyConsumption() {
  // -------- loading / data ----------
  const [loading, setLoading] = useState(false);

  // modes: 'single' | 'range' | 'cumulative'
  const [mode, setMode] = useState("single");

  // data containers
  const [rows, setRows] = useState([]); // single & cumulative
  const [groupedDays, setGroupedDays] = useState([]); // range: [{dateKey, items, total?}, ...]

  // pagination (single & cumulative only)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);

  // server filters
  const [date, setDate] = useState(toISTDateKey(Date.now())); // for single
  const [dateFrom, setDateFrom] = useState(""); // for range/cumulative
  const [dateTo, setDateTo] = useState("");

  const [header, setHeader] = useState("");
  const [subHeader, setSubHeader] = useState("");
  const [industryName, setIndustryName] = useState("");
  const [partCode, setPartCode] = useState("");

  // NEW: "This month" toggle (applies only to range/cumulative)
  const [thisMonth, setThisMonth] = useState(false);

  // Exporting state
  const [exporting, setExporting] = useState(false);

  // ---- sorting
  const sortOptionsByMode = {
    single: [
      "Newest day",
      "Oldest day",
      "Closing ↓",
      "Closing ↑",
      "Opening ↓",
      "Opening ↑",
      "Received ↓",
      "Received ↑",
      "Consumed ↓",
      "Consumed ↑",
      "MSL ↓",
      "MSL ↑",
      "Qty Required ↓",
      "Qty Required ↑",
      "Industry ↑",
      "Industry ↓",
      "Part Code ↑",
      "Part Code ↓",
      "Header ↑",
      "Header ↓",
      "Sub Header ↑",
      "Sub Header ↓",
    ],
    range: [
      "Newest day",
      "Oldest day",
      "Closing ↓",
      "Closing ↑",
      "Opening ↓",
      "Opening ↑",
      "Received ↓",
      "Received ↑",
      "Consumed ↓",
      "Consumed ↑",
      "MSL ↓",
      "MSL ↑",
      "Qty Required ↓",
      "Qty Required ↑",
      "Industry ↑",
      "Industry ↓",
      "Part Code ↑",
      "Part Code ↓",
      "Header ↑",
      "Header ↓",
      "Sub Header ↑",
      "Sub Header ↓",
    ],
    cumulative: [
      "Closing @ end ↓",
      "Closing @ end ↑",
      "Opening @ start ↓",
      "Opening @ start ↑",
      "Received Σ ↓",
      "Received Σ ↑",
      "Consumed Σ ↓",
      "Consumed Σ ↑",
      "MSL ↓",
      "MSL↑",
      "Qty Req @ end ↓",
      "Qty Req @ end ↑",
      "Industry ↑",
      "Industry ↓",
      "Part Code ↑",
      "Part Code ↓",
      "Header ↑",
      "Header ↓",
      "Sub Header ↑",
      "Sub Header ↓",
    ],
  };

  // internal sortKey identifiers
  const [sortKey, setSortKey] = useState("date_desc"); // default for single/range

  // map UI sort keys to backend sortBy/order
  const sortParams = useMemo(() => {
    const common = (field, order) => ({ sortBy: field, order });
    if (mode === "cumulative") {
      switch (sortKey) {
        case "closing_desc":
          return common("closing", "desc");
        case "closing_asc":
          return common("closing", "asc");
        case "opening_desc":
          return common("opening", "desc");
        case "opening_asc":
          return common("opening", "asc");
        case "received_desc":
          return common("receivedQty", "desc");
        case "received_asc":
          return common("receivedQty", "asc");
        case "consumed_desc":
          return common("consumedQty", "desc");
        case "consumed_asc":
          return common("consumedQty", "asc");
        case "msl_desc":
          return common("msl", "desc");
        case "msl_asc":
          return common("msl", "asc");
        case "qtyreq_desc":
          return common("quantityRequired", "desc");
        case "qtyreq_asc":
          return common("quantityRequired", "asc");
        case "industry_asc":
          return common("industryName", "asc");
        case "industry_desc":
          return common("industryName", "desc");
        case "part_asc":
          return common("partCode", "asc");
        case "part_desc":
          return common("partCode", "desc");
        case "header_asc":
          return common("header", "asc");
        case "header_desc":
          return common("header", "desc");
        case "sub_asc":
          return common("subHeader", "asc");
        case "sub_desc":
          return common("subHeader", "desc");
        default:
          return common("closing", "desc");
      }
    }
    // single / range
    switch (sortKey) {
      case "date_desc":
        return { sortBy: "dateKey", order: "desc" };
      case "date_asc":
        return { sortBy: "dateKey", order: "asc" };
      case "closing_desc":
        return common("closing", "desc");
      case "closing_asc":
        return common("closing", "asc");
      case "opening_desc":
        return common("opening", "desc");
      case "opening_asc":
        return common("opening", "asc");
      case "received_desc":
        return common("receivedQty", "desc");
      case "received_asc":
        return common("receivedQty", "asc");
      case "consumed_desc":
        return common("consumedQty", "desc");
      case "consumed_asc":
        return common("consumedQty", "asc");
      case "msl_desc":
        return common("msl", "desc");
      case "msl_asc":
        return common("msl", "asc");
      case "qtyreq_desc":
        return common("quantityRequired", "desc");
      case "qtyreq_asc":
        return common("quantityRequired", "asc");
      case "industry_asc":
        return common("industryName", "asc");
      case "industry_desc":
        return common("industryName", "desc");
      case "part_asc":
        return common("partCode", "asc");
      case "part_desc":
        return common("partCode", "desc");
      case "header_asc":
        return common("header", "asc");
      case "header_desc":
        return common("header", "desc");
      case "sub_asc":
        return common("subHeader", "asc");
      case "sub_desc":
        return common("subHeader", "desc");
      default:
        return { sortBy: "dateKey", order: "desc" };
    }
  }, [sortKey, mode]);

  const sortLabel = useMemo(() => {
    // reflect current key to label set (just for showing in the dropdown)
    const map = {
      date_desc: "Newest day",
      date_asc: "Oldest day",
      closing_desc: mode === "cumulative" ? "Closing @ end ↓" : "Closing ↓",
      closing_asc: mode === "cumulative" ? "Closing @ end ↑" : "Closing ↑",
      opening_desc: mode === "cumulative" ? "Opening @ start ↓" : "Opening ↓",
      opening_asc: mode === "cumulative" ? "Opening @ start ↑" : "Opening ↑",
      received_desc: mode === "cumulative" ? "Received Σ ↓" : "Received ↓",
      received_asc: mode === "cumulative" ? "Received Σ ↑" : "Received ↑",
      consumed_desc: mode === "cumulative" ? "Consumed Σ ↓" : "Consumed ↓",
      consumed_asc: mode === "cumulative" ? "Consumed Σ ↑" : "Consumed ↑",
      msl_desc: mode === "cumulative" ? "MSL  ↓" : "MSL ↓",
      msl_asc: mode === "cumulative" ? "MSL ↑" : "MSL ↑",
      qtyreq_desc: mode === "cumulative" ? "Qty Req @ end ↓" : "Qty Required ↓",
      qtyreq_asc: mode === "cumulative" ? "Qty Req @ end ↑" : "Qty Required ↑",
      industry_asc: "Industry ↑",
      industry_desc: "Industry ↓",
      part_asc: "Part Code ↑",
      part_desc: "Part Code ↓",
      header_asc: "Header ↑",
      header_desc: "Header ↓",
      sub_asc: "Sub Header ↑",
      sub_desc: "Sub Header ↓",
    };
    return map[sortKey];
  }, [sortKey, mode]);

  // ---- change mode: reset sensible defaults
  const onModeChange = (value) => {
    setMode(value);
    setPage(1);
    if (value === "cumulative") {
      // cumulative doesn't support date sort; default to closing@End desc
      setSortKey("closing_desc");
    } else {
      // single/range default to newest day
      setSortKey("date_desc");
    }
  };

  const applyFilters = async (override = {}) => {
    setLoading(true);
    try {
      // gather params with possible overrides
      const localDate = date;
      const localDateFrom = override.dateFrom ?? dateFrom;
      const localDateTo = override.dateTo ?? dateTo;

      // basic param pack (NO "type" anymore)
      const params = {
        header: header || undefined,
        subHeader: subHeader || undefined,
        industryName: industryName || undefined,
        partCode: partCode || undefined,
        sortBy: sortParams.sortBy,
        order: sortParams.order,
      };

      // mode branching
      if (mode === "single") {
        params.date = localDate || undefined;
        params.page = page;
        params.limit = limit;
      } else if (mode === "range") {
        if (!localDateFrom || !localDateTo) {
          setLoading(false);
          toast.error("Both dateFrom and dateTo are required for range/cumulative modes");
          return;
        }
        // validate order
        if (new Date(localDateTo) < new Date(localDateFrom)) {
          setLoading(false);
          toast.error("To date cannot be before From date");
          return;
        }
        params.dateFrom = localDateFrom;
        params.dateTo = localDateTo;
      } else {
        // cumulative
        if (!localDateFrom || !localDateTo) {
          setLoading(false);
          toast.error("Both dateFrom and dateTo are required for range/cumulative modes");
          return;
        }
        if (new Date(localDateTo) < new Date(localDateFrom)) {
          setLoading(false);
          toast.error("To date cannot be before From date");
          return;
        }
        params.mode = "cumulative";
        params.dateFrom = localDateFrom;
        params.dateTo = localDateTo;
        params.page = page;
        params.limit = limit;
      }

      const res = await getDailyConsumption(params);
      const payload = res?.data?.data || res?.data || {};

      if (mode === "single") {
        const list = Array.isArray(payload.items) ? payload.items : [];
        setRows(list);
        setTotal(Number(payload.total || list.length || 0));
      } else if (mode === "range") {
        const days = Array.isArray(payload.days) ? payload.days : [];
        const normalized = days.map((d) => ({
          dateKey: d?.dateKey || "",
          total: Number(d?.total || (Array.isArray(d?.items) ? d.items.length : 0)),
          items: Array.isArray(d?.items) ? d.items : [],
        }));
        setGroupedDays(normalized);
      } else {
        const list = Array.isArray(payload.items) ? payload.items : [];
        setRows(list);
        setTotal(Number(payload.total || list.length || 0));
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to load daily consumption");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, page, limit, sortParams]);

  const clearFilters = () => {
    setHeader("");
    setSubHeader("");
    setIndustryName("");
    setPartCode("");
    setDate(toISTDateKey(Date.now()));
    setDateFrom("");
    setDateTo("");
    setThisMonth(false);
    setPage(1);
    if (mode === "cumulative") setSortKey("closing_desc");
    else setSortKey("date_desc");
  };

  // ===== Export support =====

  // Build export params from current UI state (mirrors what's applied)
  const buildExportParams = () => {
    // Common filters
    const base = {
      header: header || undefined,
      subHeader: subHeader || undefined,
      // "type" removed from UI; add here if you bring it back later
      industryName: industryName || undefined,
      partCode: partCode || undefined,
      sortBy: sortParams.sortBy,
      order: sortParams.order,
    };

    // Scope mapping:
    //  - single  -> scope=today, date=selected date
    //  - range/cumulative + "This month" -> scope=thisMonth, date=today(IST)
    //  - range/cumulative manual dates   -> scope=range, dateFrom/dateTo
    if (mode === "single") {
      return {
        ...base,
        scope: "today",
        date: date || toISTDateKey(Date.now()),
      };
    }

    if (thisMonth) {
      return {
        ...base,
        scope: "thisMonth",
        date: toISTDateKey(Date.now()), // any date within the month
      };
    }

    // manual range
    return {
      ...base,
      scope: "range",
      dateFrom,
      dateTo,
    };
  };

  const onExport = async () => {
    try {
      const params = buildExportParams();

      // Validate when scope=range
      if (params.scope === "range") {
        if (!params.dateFrom || !params.dateTo) {
          toast.error("Both From and To dates are required to export this range.");
          return;
        }
        if (new Date(params.dateTo) < new Date(params.dateFrom)) {
          toast.error("To date cannot be before From date.");
          return;
        }
      }

      setExporting(true);
      const res = await exportDailyConsumption(params);

      // Build a friendly filename
      let suffix = "";
      if (params.scope === "today") {
        suffix = params.date;
      } else if (params.scope === "thisMonth") {
        suffix = `this-month_${params.date}`;
      } else {
        suffix = `${params.dateFrom}_to_${params.dateTo}`;
      }
      const filename = `daily_export_${suffix}.xlsx`;

      // Download
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to export file");
    } finally {
      setExporting(false);
    }
  };

  /* ---------- table heads ---------- */
  const TableHeadDay = () => (
    <thead>
      <tr>
        {[
          "#",
          "Date",
          "Header",
          "Sub Header",
          "Industry",
          "Part Code",
          "MSL",
          "Opening",
          "Received",
          "Consumed",
          "Closing",
          "Qty Required",
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
  );

  const TableHeadCumulative = () => (
    <thead>
      <tr>
        {[
          "#",
          "Header",
          "Sub Header",
          "Industry",
          "Part Code",
          "Opening @ Start",
          "Received Σ",
          "Consumed Σ",
          "Closing @ End",
          "MSL",
          "Qty Req @ End",
          "Invoices",
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
  );

  /* ---------- row renderers ---------- */
  const renderRowDay = (item, idx, startIndex = 0) => {
    const belowMsl = Number(item.closing) < Number(item.msl);
    const needed = Number(item.quantityRequired) > 0;
    return (
      <tr
        key={`${item.dateKey}-${item.industryName}-${item.partCode}-${idx}`}
        className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors"
      >
        <td className="border border-[#162134] px-4 py-2">{startIndex + idx + 1}</td>
        <td className="border border-[#162134] px-4 py-2">{item.dateKey || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.header || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.subHeader || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.industryName || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.partCode || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.msl ?? "—"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.opening ?? "—"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.receivedQty ?? "—"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.consumedQty ?? "—"}</td>
        <td
          className={
            "border border-[#162134] px-4 py-2 " + (belowMsl ? "bg-red-900/30" : "")
          }
          title={belowMsl ? "Below MSL" : ""}
        >
          {item.closing ?? "—"}
        </td>
        <td
          className={
            "border border-[#162134] px-4 py-2 " + (needed ? "bg-amber-900/30" : "")
          }
          title={needed ? "Quantity required" : ""}
        >
          {item.quantityRequired ?? 0}
        </td>
      </tr>
    );
  };

  const renderRowCumulative = (item, idx, startIndex = 0) => {
    const belowMsl = Number(item.closingAtEnd) < Number(item.mslAtEnd);
    const needed = Number(item.quantityRequiredAtEnd) > 0;
    const invoices = Array.isArray(item.invoices) ? item.invoices : [];
    return (
      <tr
        key={`${item.industryName}-${item.partCode}-${idx}`}
        className="odd:bg-white/5 even:bg-transparent hover:bg-white/10 transition-colors"
      >
        <td className="border border-[#162134] px-4 py-2">{startIndex + idx + 1}</td>
        <td className="border border-[#162134] px-4 py-2">{item.header || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.subHeader || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.industryName || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.partCode || "-"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.openingAtStart ?? "—"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.receivedQtySum ?? "—"}</td>
        <td className="border border-[#162134] px-4 py-2">{item.consumedQtySum ?? "—"}</td>
        <td
          className={
            "border border-[#162134] px-4 py-2 " + (belowMsl ? "bg-red-900/30" : "")
          }
          title={belowMsl ? "Below MSL at end" : ""}
        >
          {item.closingAtEnd ?? "—"}
        </td>
        <td className="border border-[#162134] px-4 py-2">{item.mslAtEnd ?? "—"}</td>
        <td
          className={
            "border border-[#162134] px-4 py-2 " + (needed ? "bg-amber-900/30" : "")
          }
          title={needed ? "Quantity required at end" : ""}
        >
          {item.quantityRequiredAtEnd ?? 0}
        </td>
        <td className="border border-[#162134] px-4 py-2">
          {invoices.length ? invoices.join(", ") : "—"}
        </td>
      </tr>
    );
  };

  // map label back to sortKey when user picks from dropdown
  const onSortChange = (label) => {
    // cumulative labels
    if (mode === "cumulative") {
      switch (label) {
        case "Closing @ end ↓":
          return setSortKey("closing_desc");
        case "Closing @ end ↑":
          return setSortKey("closing_asc");
        case "Opening @ start ↓":
          return setSortKey("opening_desc");
        case "Opening @ start ↑":
          return setSortKey("opening_asc");
        case "Received Σ ↓":
          return setSortKey("received_desc");
        case "Received Σ ↑":
          return setSortKey("received_asc");
        case "Consumed Σ ↓":
          return setSortKey("consumed_desc");
        case "Consumed Σ ↑":
          return setSortKey("consumed_asc");
        case "MSL ↓":
          return setSortKey("msl_desc");
        case "MSL ↑":
          return setSortKey("msl_asc");
        case "Qty Req @ end ↓":
          return setSortKey("qtyreq_desc");
        case "Qty Req @ end ↑":
          return setSortKey("qtyreq_asc");
        case "Industry ↑":
          return setSortKey("industry_asc");
        case "Industry ↓":
          return setSortKey("industry_desc");
        case "Part Code ↑":
          return setSortKey("part_asc");
        case "Part Code ↓":
          return setSortKey("part_desc");
        case "Header ↑":
          return setSortKey("header_asc");
        case "Header ↓":
          return setSortKey("header_desc");
        case "Sub Header ↑":
          return setSortKey("sub_asc");
        case "Sub Header ↓":
          return setSortKey("sub_desc");
        default:
          return;
      }
    }
    // single/range labels
    switch (label) {
      case "Newest day":
        return setSortKey("date_desc");
      case "Oldest day":
        return setSortKey("date_asc");
      case "Closing ↓":
        return setSortKey("closing_desc");
      case "Closing ↑":
        return setSortKey("closing_asc");
      case "Opening ↓":
        return setSortKey("opening_desc");
      case "Opening ↑":
        return setSortKey("opening_asc");
      case "Received ↓":
        return setSortKey("received_desc");
      case "Received ↑":
        return setSortKey("received_asc");
      case "Consumed ↓":
        return setSortKey("consumed_desc");
      case "Consumed ↑":
        return setSortKey("consumed_asc");
      case "MSL ↓":
        return setSortKey("msl_desc");
      case "MSL ↑":
        return setSortKey("msl_asc");
      case "Qty Required ↓":
        return setSortKey("qtyreq_desc");
      case "Qty Required ↑":
        return setSortKey("qtyreq_asc");
      case "Industry ↑":
        return setSortKey("industry_asc");
      case "Industry ↓":
        return setSortKey("industry_desc");
      case "Part Code ↑":
        return setSortKey("part_asc");
      case "Part Code ↓":
        return setSortKey("part_desc");
      case "Header ↑":
        return setSortKey("header_asc");
      case "Header ↓":
        return setSortKey("header_desc");
      case "Sub Header ↑":
        return setSortKey("sub_asc");
      case "Sub Header ↓":
        return setSortKey("sub_desc");
      default:
        return;
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
        <div className={`${cardCls} overflow-visible min-h-[160px]`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Mode selector */}
            <div className="md:col-span-3">
              <Dropdown
                label="Mode"
                options={["Single day", "Per-day range", "Cumulative range"]}
                value={
                  mode === "single"
                    ? "Single day"
                    : mode === "range"
                    ? "Per-day range"
                    : "Cumulative range"
                }
                onChange={(label) => {
                  const v =
                    label === "Single day"
                      ? "single"
                      : label === "Per-day range"
                      ? "range"
                      : "cumulative";
                  onModeChange(v);
                }}
                disableSearch
              />
            </div>

            {/* Date(s) */}
            {mode === "single" ? (
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Date (IST)</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(1);
                  }}
                  className={inputCls}
                />
              </div>
            ) : (
              <>
                <div className="md:col-span-3">
                  <label className="block text-sm mb-1">From (Date)</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setThisMonth(false); // manual change disables "This month"
                    }}
                    className={inputCls}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm mb-1">To (Date)</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setThisMonth(false); // manual change disables "This month"
                    }}
                    className={inputCls}
                  />
                </div>

                {/* NEW: This month quick filter */}
                <div className="md:col-span-2 flex items-end">
                  <label className="inline-flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={thisMonth}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setThisMonth(checked);
                        if (checked) {
                          const { from, to } = thisMonthRangeIST();
                          setDateFrom(from);
                          setDateTo(to);
                          // auto-apply immediately with overrides
                          applyFilters({ dateFrom: from, dateTo: to });
                        }
                      }}
                    />
                    <span className="text-sm">This month</span>
                  </label>
                </div>
              </>
            )}

            {/* Filters */}
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Header</label>
              <input
                className={inputCls}
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder="e.g. PACKING MATERIAL"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Sub Header</label>
              <input
                className={inputCls}
                value={subHeader}
                onChange={(e) => setSubHeader(e.target.value)}
                placeholder="e.g. BUBBLE WRAP"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Industry Name</label>
              <input
                className={inputCls}
                value={industryName}
                onChange={(e) => setIndustryName(e.target.value)}
                placeholder="e.g. bby crtn"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Part Code</label>
              <input
                className={inputCls}
                value={partCode}
                onChange={(e) => setPartCode(e.target.value)}
                placeholder="e.g. 258258"
              />
            </div>

            <div className="md:col-span-3">
              <Dropdown
                label="Sort"
                options={sortOptionsByMode[mode]}
                value={sortLabel}
                onChange={onSortChange}
                disableSearch
              />
            </div>

            {(mode === "single" || mode === "cumulative") && (
              <div className="md:col-span-2">
                <Dropdown
                  options={["10", "25", "50", "100", "250", "500"]}
                  value={String(limit)}
                  onChange={(v) => {
                    setLimit(Number(v) || 50);
                    setPage(1);
                  }}
                  label="Limit"
                  disableSearch
                />
              </div>
            )}

            <div className="md:col-span-3 flex items-end gap-2">
              <button
                type="button"
                onClick={applyFilters}
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
                onClick={onExport}
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

      {/* Tables */}
      {mode === "single" && (
        <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
          <table className="w-full min-w-[1200px] table-auto border-collapse">
            <TableHeadDay />
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-white/80 px-4 py-6">
                    No data for the selected day.
                  </td>
                </tr>
              ) : (
                rows.map((item, idx) => renderRowDay(item, idx, (page - 1) * limit))
              )}
            </tbody>
          </table>
        </div>
      )}

      {mode === "range" && (
        <div className="space-y-6">
          {groupedDays.length === 0 ? (
            <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-6 text-center">
              No data for the selected range.
            </div>
          ) : (
            groupedDays.map((day, di) => (
              <div
                key={`${day.dateKey}-${di}`}
                className="w-full overflow-x-auto custom-scrollbar  rounded-xl bg-white/5 backdrop-blur-md border border-white/10"
              >
                <div className="px-4 pt-4 text-white/90 font-semibold">
                  Date: {day.dateKey || "—"}{" "}
                  {typeof day.total === "number" ? `• ${day.total} rows` : ""}
                </div>
                <table className="w-full min-w-[1200px] table-auto border-collapse mt-2">
                  <TableHeadDay />
                  <tbody>
                    {Array.isArray(day.items) && day.items.length ? (
                      day.items.map((item, idx) => renderRowDay(item, idx))
                    ) : (
                      <tr>
                        <td colSpan={12} className="text-center text-white/80 px-4 py-6">
                          No rows for this day.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {mode === "cumulative" && (
        <div className="w-full overflow-x-auto custom-scrollbar rounded-xl bg-white/5 backdrop-blur-md border border-white/10">
          <table className="w-full min-w-[1200px] table-auto border-collapse">
            <TableHeadCumulative />
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-white/80 px-4 py-6">
                    No data for the selected range.
                  </td>
                </tr>
              ) : (
                rows.map((item, idx) => renderRowCumulative(item, idx, (page - 1) * limit))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(mode === "single" || mode === "cumulative") && (
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded bg-gray-600 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-white/80">
            Page {page} / {Math.max(1, Math.ceil((total || 0) / (limit || 1)))}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.max(1, Math.ceil((total || 0) / (limit || 1)))}
            className="px-3 py-1 rounded bg-gray-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
