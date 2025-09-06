// Roles
export const ROLES = {
  ADMIN: "admin",
  IMA: "ima",
  DEO: "deo",
  USER: "user",
  VIEWER: "viewer",
};

// Page-level permissions (route access)
export const PAGES = {
  DASHBOARD: "DASHBOARD",
  PART_ENTRIES: "PART_ENTRIES",
  USER_MGMT: "USER_MGMT",
  DAILY_CONSUMPTION: "DAILY_CONSUMPTION",
  PARTS_REQUIRED: "PARTS_REQUIRED",
  PRODUCT_DETAILS: "PRODUCT_DETAILS",
  RECORD_ENTRIES: "RECORD_ENTRIES",
  FINISHED_GOODS: "FINISHED_GOODS",
};

// Action-level permissions (in-page)
export const ACTIONS = {
  PART_ENTRY_CREATE: "PART_ENTRY_CREATE",
  PART_ENTRY_EDIT: "PART_ENTRY_EDIT",
  PART_ENTRY_DELETE: "PART_ENTRY_DELETE",

  RECORD_ENTRY_CREATE: "RECORD_ENTRY_CREATE",
  RECORD_ENTRY_EDIT: "RECORD_ENTRY_EDIT",
  RECORD_ENTRY_DELETE: "RECORD_ENTRY_DELETE",
  
};

// Role → allowed pages
export const ROLE_PAGES = {
  [ROLES.ADMIN]: Object.values(PAGES),
  [ROLES.IMA]: [PAGES.PART_ENTRIES , PAGES.PARTS_REQUIRED],
  [ROLES.DEO]: [PAGES.RECORD_ENTRIES, PAGES.PARTS_REQUIRED],
  [ROLES.USER]: [], // view-only page content inside component
  [ROLES.VIEWER]: [PAGES.DASHBOARD, PAGES.DAILY_CONSUMPTION, PAGES.PART_ENTRIES , PAGES.FINISHED_GOODS],
};

// Role → allowed actions
export const ROLE_ACTIONS = {
  [ROLES.ADMIN]: Object.values(ACTIONS),

  [ROLES.IMA]: [ACTIONS.PART_ENTRY_CREATE], // no edit/delete
  [ROLES.DEO]: [ACTIONS.RECORD_ENTRY_CREATE], // no edit/delete

  [ROLES.USER]: [], // view only inside the page component
  [ROLES.VIEWER]: [], // view only inside the page component
};

// helpers
export const canAccessPage = (role, page) =>
  (ROLE_PAGES[role] || []).includes(page);
export const canDo = (role, action) =>
  (ROLE_ACTIONS[role] || []).includes(action);
