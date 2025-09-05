// src/router/routesConfig.jsx
import { lazy } from "react";
import { PAGES } from "../auth/permissions";

const Dashboard = lazy(() => import("../pages/Dashboard.jsx"));
const UserManagement = lazy(() => import("../pages/UserManagement.jsx"));
const DailyConsumption = lazy(() => import("../pages/DailyConsumption.jsx"));
const PartEntries = lazy(() => import("../pages/PartEntries.jsx"));
const PartsRequired = lazy(() => import("../pages/PartsRequired.jsx"));
const ProductDetails = lazy(() => import("../pages/ProductDetails.jsx"));
const RecordEntries = lazy(() => import("../pages/RecordEntries.jsx"));        // <-- list + modal
const RecordEntriesForm = lazy(() => import("../pages/RecordEntriesForm.jsx")); // <-- your form page (rename your current form file to this)
const Forbidden = lazy(() => import("../pages/Forbidden.jsx"));
const NotFound = lazy(() => import("../pages/NotFound.jsx"));
const SerialNumber = lazy(() => import("../pages/SerialnumberPage.jsx")); // optional standalone
const RecordEntriesFormDEO = lazy(() => import("../pages/RecordEntriesFormDEO.jsx"))

export const ROUTES = [
  { pageKey: PAGES.DASHBOARD, path: "/dashboard", element: <Dashboard />, label: "Dashboard" },
  { pageKey: PAGES.USER_MGMT, path: "/users", element: <UserManagement />, label: "User Management" },
  { pageKey: PAGES.DAILY_CONSUMPTION, path: "/daily", element: <DailyConsumption />, label: "Daily Consumption" },

  { pageKey: PAGES.PART_ENTRIES, path: "/part-entries", element: <PartEntries />, label: "Part Entries" },
  { pageKey: PAGES.PARTS_REQUIRED, path: "/parts-required", element: <PartsRequired />, label: "Parts Creation" },
  { pageKey: PAGES.PRODUCT_DETAILS, path: "/product-details", element: <ProductDetails />, label: "Model Creation" },

  // LIST page (now shows table + “Create Entry” opens Serial modal)
  { pageKey: PAGES.RECORD_ENTRIES, path: "/record-entries", element: <RecordEntries />, label: "Record Entries" },

  // FORM page (target after serial flow)
  { pageKey: PAGES.RECORD_ENTRIES, path: "/record-entries/form", element: <RecordEntriesForm />, hidden: true },
  { pageKey: PAGES.RECORD_ENTRIES, path: "/record-entries/form/deo", element: <RecordEntriesFormDEO />, hidden: true },


  // Optional standalone serial-number page (keep if you still want direct route; not in navbar)
  { pageKey: "SERIAL_NUMBER", path: "/serial-number", element: <SerialNumber />, label: "Serial Number", hidden: true },

  { pageKey: "FORBIDDEN", path: "/403", element: <Forbidden />, label: "Forbidden", hidden: true },
  { pageKey: "NOT_FOUND", path: "*", element: <NotFound />, label: "Not Found", hidden: true },
];
