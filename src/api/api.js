// src/api/api.js
// One tiny Axios client + helper functions for every endpoint.
// Human-friendly comments explain what each call does and what it returns.

import axios from "axios";

/* ============================================
   AXIOS: base URL + Bearer token from storage
   ============================================ */
const BASE_URL = "http://localhost:8000/api"; // change if needed

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT (if present) for protected routes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

/* ============================================
   AUTH (public)
   --------------------------------------------
   POST /auth/login       -> { success, message, data: { token, user } }
   GET  /auth/checkLogin  -> { success, message, data: { user } }
   ============================================ */
export async function auth(payload) {
  // payload: { userId, password }
  const res = await api.post("/auth/login", payload);
  return res.data;
}
export async function checkLogin() {
  const res = await api.get("/auth/checkLogin");
  return res.data;
}
export const generateSerialString = () => api.get("/generate-string");

/* ============================================
   USERS (admin)
   --------------------------------------------
   Create/Read/Update/Delete users
   GET /users/end-users/ids returns only {_id, userId} for role "user"
   ============================================ */
export async function createUser(payload) {
  const res = await api.post("/users/create", payload);
  return res.data;
}
export async function updateUser(userId, payload) {
  const res = await api.patch(`/users/${encodeURIComponent(userId)}`, payload);
  return res.data;
}
export async function deleteUser(userId) {
  const res = await api.delete(`/users/${encodeURIComponent(userId)}`);
  return res.data;
}
export async function getUser(userId) {
  const res = await api.get(`/users/${encodeURIComponent(userId)}`);
  return res.data;
}
export async function getAllUsers(params = {}) {
  // params: { q?, page?, limit? } if you add filters later
  const res = await api.get("/users", { params });
  return res.data;
}
export async function getEndUserIds() {
  // Returns only end-user ids for dropdowns/pickers
  const res = await api.get("/users/end-users/ids");
  return res.data;
}

/* ============================================
   PRODUCT DETAILS (admin|ima|deo for R/W as per doc)
   --------------------------------------------
   Unique per modelNumber. Includes grouped listing.
   ============================================ */
export async function createProductDetail(payload) {
  const res = await api.post("/product-details/create", payload);
  return res.data;
}
export async function updateProductDetail(productId, payload) {
  const res = await api.patch(
    `/product-details/${encodeURIComponent(productId)}`,
    payload
  );
  return res.data;
}
export async function deleteProductDetail(productId) {
  const res = await api.delete(
    `/product-details/${encodeURIComponent(productId)}`
  );
  return res.data;
}
export async function getProductDetailById(id) {
  const res = await api.get(`/product-details/${encodeURIComponent(id)}`);
  return res.data;
}
export async function getAllProductDetails(params = {}) {
  const res = await api.get("/product-details", { params });
  return res.data;
}
export async function getGroupedProductDetails() {
  // Returns [{ product, models: [...] }, ...]
  const res = await api.get("/product-details/grouped");
  return res.data;
}
export async function getGroupedProductDetailsWithIds() {
  // Returns [{ productName, models:[{ modelNumber, _id }] }]
  const res = await api.get("/product-details/grouped-with-ids");
  return res.data;
}

/* ============================================
   PARTS REQUIRED (definitions/master)
   --------------------------------------------
   Unique on (industryName, partCode). Normalized on server.
   Also exposes /unique lists and availability-by-industry.
   ============================================ */
export async function listPartsRequired(params = {}) {
  // params: { q?, page?, limit? }
  const res = await api.get("/parts-required", { params });
  return res.data;
}
export async function getPartRequired(id) {
  const res = await api.get(`/parts-required/${encodeURIComponent(id)}`);
  return res.data;
}
export async function createPartRequired(payload) {
  // { header*, industryName*, partCode*, type?, subHeader?, msl?, isActive?, note? }
  const res = await api.post("/parts-required", payload);
  return res.data;
}
export async function updatePartRequired(id, payload) {
  const res = await api.patch(
    `/parts-required/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}
export async function deletePartRequired(id) {
  const res = await api.delete(`/parts-required/${encodeURIComponent(id)}`);
  return res.data;
}
export async function listPartsRequiredHeaderSubheader() {
  // For dropdowns: distinct header/subHeader/industryName
  const res = await api.get("/parts-required/unique");
  return res.data;
}
export async function getPartsAvailabilityByIndustry(params = {}) {
  // Example: { industryName: "cabinet 4000x" }
  const res = await api.get("/parts-required/availability", { params });
  return res.data;
}

/* ============================================
   PART ENTRIES (stock batches; FIFO)
   --------------------------------------------
   Each entry is a purchased batch that contributes to stock.
   Includes bulk create + availability views.
   ============================================ */
export async function listPartEntries(params = {}) {
  // Filters supported by backend: q, industryName, partCode, invoiceNumber, dateFrom/dateTo, sortBy, order, page, limit
  const res = await api.get("/part-entries", { params });
  return res.data;
}
export async function getPartEntry(id) {
  const res = await api.get(`/part-entries/${encodeURIComponent(id)}`);
  return res.data;
}
export async function createPartEntry(payload) {
  // { industryName*, partCode*, quantity*, rate*, invoiceNumber?, purchaseDate?, notes? }
  const res = await api.post("/part-entries", payload);
  return res.data;
}
export async function bulkCreatePartEntries(payload) {
  // { invoiceNumber*, purchaseDate?, items:[{ industryName*, partCode*, quantity*, rate* }, ...] }
  const res = await api.post("/part-entries/bulk", payload);
  return res.data;
}
export async function updatePartEntry(id, payload) {
  // Careful: reduces blocked below consumed; server rebalances daily/stock
  const res = await api.patch(
    `/part-entries/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}
export async function deletePartEntry(id) {
  // Only if batch not consumed by any record
  const res = await api.delete(`/part-entries/${encodeURIComponent(id)}`);
  return res.data;
}
export async function getPartEntriesAvailability(params = {}) {
  // One row per (industryName, partCode) with per-batch breakdown
  const res = await api.get("/part-entries/availability", { params });
  return res.data;
}
export async function getPartEntriesInStock(params = {}) {
  // Same as availability but only pairs with stock > 0
  const res = await api.get("/part-entries/in-stock", { params });
  return res.data;
}
//returns industry name along with parts codes
export const listIndustryCodes = () =>
  api.get("/parts-required/industry-codes");

export async function getStockByIndustry() {
  // Returns [{ "<industry>": [{ "<code>": qty }, ...], total }]
  const res = await api.get("/part-entries/stock-by-industry");
  return res.data;
}
/* ============================================
   RECORD ENTRIES (full controller)
   --------------------------------------------
   Requirements & replacements; server enforces "replaced must be from required industry".
   ============================================ */
export async function listRecordEntries(params = {}) {
  // params: q, productSrNo, modelNumber, dateFrom/dateTo, packingStatus, sortBy, order, page, limit
  const res = await api.get("/record-entries", { params });
  return res.data;
}
export async function getRecordEntry(id) {
  const res = await api.get(`/record-entries/${encodeURIComponent(id)}`);
  return res.data;
}
export async function createRecordEntry(payload) {
  // See doc: includes product detail, requirementLines[], etc.
  const res = await api.post("/record-entries?autoPreferred=oldest", payload);
  return res.data;
}

// ⬇️ ADMIN SIMPLE UPDATE (matches new controller):
// payload shape can include any of these keys: { core, requirements, replacements }
export async function updateRecordEntry(id, payload) {
  const res = await api.patch(
    `/record-entries/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}
export async function deleteRecordEntry(id) {
  const res = await api.delete(`/record-entries/${encodeURIComponent(id)}`);
  return res.data;
}
export const getRecordEntryBySerial = (serial) =>
  api.get(`/record-entries/by-serial/${encodeURIComponent(serial)}`);

export async function updateRecordEntryComposite(id, payload) {
  // payload can contain any combination of:
  // { core: {...}, requirements: [...], replacements: [...] }
  const res = await api.patch(
    `/record-entries/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
}

/* ---------- Nested helpers on record-entries (admin|ima|deo) ---------- */
export async function addRequirementLines(recordId, lines) {
  // lines: [{ industryName, preferredPartCode?, qtyRequired, notes? }, ...]
  const res = await api.post(
    `/record-entries/${encodeURIComponent(recordId)}/requirements`,
    lines
  );
  return res.data;
}
export async function editRequirementLine(
  recordId,
  requirementLineId,
  payload
) {
  const res = await api.patch(
    `/record-entries/${encodeURIComponent(
      recordId
    )}/requirements/${encodeURIComponent(requirementLineId)}`,
    payload
  );
  return res.data;
}
export async function deleteRequirementLine(recordId, requirementLineId) {
  const res = await api.delete(
    `/record-entries/${encodeURIComponent(
      recordId
    )}/requirements/${encodeURIComponent(requirementLineId)}`
  );
  return res.data;
}
export async function autoAddReplacements(
  recordId,
  requirementLineId,
  payload
) {
  // payload: { quantity, dateReplaced }
  const res = await api.post(
    `/record-entries/${encodeURIComponent(
      recordId
    )}/replacements/${encodeURIComponent(requirementLineId)}/auto`,
    payload
  );
  return res.data;
}
export async function editReplacementLine(
  recordId,
  replacementLineId,
  payload
) {
  const res = await api.patch(
    `/record-entries/${encodeURIComponent(
      recordId
    )}/replacements/${encodeURIComponent(replacementLineId)}`,
    payload
  );
  return res.data;
}
export async function deleteReplacementLine(recordId, replacementLineId) {
  const res = await api.delete(
    `/record-entries/${encodeURIComponent(
      recordId
    )}/replacements/${encodeURIComponent(replacementLineId)}`
  );
  return res.data;
}

/* ============================================
   RECORD ENTRIES — DEO controller (restricted)
   --------------------------------------------
   One-shot or limited updates for DEO with auto-FIFO.
   ============================================ */
export async function deoCreateRecordEntry(payload) {
  const res = await api.post("/record-entries-deo/deo", payload);
  return res.data;
}
export async function deoUpddateRecordEntry(id, payload) {
  const res = await api.patch(
    `/record-entries-deo/${encodeURIComponent(id)}/deo`,
    payload
  );
  return res.data;
}

/* ============================================
   STOCKS (read-only helpers)
   --------------------------------------------
   Batch view for a specific PartRequired id.
   ============================================ */
export async function listBatchesForPart(partId) {
  const res = await api.get(`/stocks/${encodeURIComponent(partId)}/batches`);
  return res.data;
}

/* ============================================
   DAILY (analytics & snapshots)
   --------------------------------------------
   GET /daily               -> Today's (IST) roll-forward snapshot with filters.
   POST /daily/recompute    -> Recompute from a point in time (admin).
   (Legacy helpers kept for compatibility: /daily/consumption, /daily/stock)
   ============================================ */
export async function getDaily(params = {}) {
  // params: q, industryName, partCode, header, subHeader, type, isActive, belowMslOnly, onlyInStock, minClosing, maxClosing, sortBy, order, page, limit, dateKey
  const res = await api.get("/daily", { params });
  return res.data;
}
export async function recomputeDaily(payload = {}) {
  // payload: { partId?, productDetailId?, from?, to? }
  const res = await api.post("/daily/recompute", payload);
  return res.data;
}
// Legacy/optional:
export async function getDailyConsumption(params = {}) {
  const res = await api.get("/daily", { params });
  return res.data;
}
export async function getDailyStock(params = {}) {
  const res = await api.get("/daily/stock", { params });
  return res.data;
}

/* ============================================
   HEALTH
   --------------------------------------------
   Simple liveness check.
   ============================================ */
export async function healthCheck() {
  const res = await api.get("/health");
  return res.data;
}

/* ============================================
   Download excels
   ============================================ */

export function exportDailyConsumption(params) {
  return api.get("/daily/export", {
    params,
    responseType: "blob",
  });
}

export const exportRmReport = (params) =>
  api.get("/rm/export", { params, responseType: "blob" });

export const getRmReport = (params) => api.get("/rm/report", { params });

export default api;
