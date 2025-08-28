import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Spinner from "../components/Spinner";
import DotLoader from "../components/DotLoader";
import { getAllUsers, createUser, updateUser, deleteUser } from "../api/api";
import Dropdown from "../components/Dropdown";

/* Utils */
const getInitials = (name = "", userId = "") => {
  const src = name || userId || "";
  const parts = src.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const PALETTE = [
  "from-indigo-500 to-indigo-600",
  "from-sky-500 to-sky-600",
  "from-emerald-500 to-emerald-600",
  "from-purple-500 to-purple-600",
  "from-rose-500 to-rose-600",
  "from-amber-500 to-amber-600",
  "from-fuchsia-500 to-fuchsia-600",
];
const pickColorIdx = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
};
const roleBadge = (role) => {
  const r = (role || "").toLowerCase();
  const map = {
    admin: "bg-red-500/20 text-red-300 border-red-500/40",
    ima: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    deo: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    user: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    viewer: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  };
  return map[r] || "bg-slate-500/20 text-slate-300 border-slate-500/40";
};
const nice = (s = "") => (s ? s : "-");

/* Reusable field styles (border-only, transparent bg) */
const inputCls =
  "w-full px-4 py-2 rounded-lg bg-transparent text-white placeholder-white/60 " +
  "border-2 border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const labelCls = "block text-sm text-white/80 mb-1";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    userId: "",
    password: "",
    role: "viewer", // admin|ima|deo|user|viewer
    jobRole: "",
    email: "",
    phoneNumber: "",
    dateOfJoining: "",
  });

  // Edit modal
  const [editUser, setEditUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    userId: "",
    password: "",
    phoneNumber: "",
    email: "",
    role: "",
    jobRole: "",
    dateOfJoining: "",
  });

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await getAllUsers();
      const raw = res?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(res)
        ? res
        : [];
      setUsers(list);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------- Create ------------------------- */
  const openCreate = () => {
    setCreateForm({
      name: "",
      userId: "",
      password: "",
      role: "viewer",
      jobRole: "",
      email: "",
      phoneNumber: "",
      dateOfJoining: "",
    });
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    if (
      !createForm.name.trim() ||
      !createForm.userId.trim() ||
      !createForm.password.trim() ||
      !createForm.role
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCreating(true);
    try {
      await createUser({ ...createForm });
      toast.success("User created successfully");
      setShowCreate(false);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  /* -------------------------- Edit -------------------------- */
  const openEditModal = (u) => {
    setEditUser(u);
    setForm({
      name: u.name || "",
      userId: u.userId || "",
      password: "",
      phoneNumber: u.phoneNumber || "",
      email: u.email || "",
      role: (u.role || "").toLowerCase(),
      jobRole: u.jobRole || "",
      dateOfJoining: u.dateOfJoining
        ? String(u.dateOfJoining).slice(0, 10)
        : "",
    });
  };

  const closeEditModal = () => {
    setEditUser(null);
    setForm({
      name: "",
      userId: "",
      password: "",
      phoneNumber: "",
      email: "",
      role: "",
      jobRole: "",
      dateOfJoining: "",
    });
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    if (!editUser?.userId) return;
    setModalLoading(true);
    try {
      const updates = {};
      const cmp = (k, curr, orig) => {
        if ((curr ?? "") !== (orig ?? "")) updates[k] = curr;
      };
      cmp("name", form.name, editUser.name || "");
      cmp("phoneNumber", form.phoneNumber, editUser.phoneNumber || "");
      cmp("email", form.email, editUser.email || "");
      cmp(
        "role",
        (form.role || "").toLowerCase(),
        (editUser.role || "").toLowerCase()
      );
      cmp("jobRole", form.jobRole, editUser.jobRole || "");
      cmp(
        "dateOfJoining",
        form.dateOfJoining,
        editUser.dateOfJoining
          ? String(editUser.dateOfJoining).slice(0, 10)
          : ""
      );
      if (form.password?.trim()) updates.password = form.password.trim();

      await updateUser(editUser.userId, updates);
      toast.success("User updated successfully");
      closeEditModal();
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Update failed");
    } finally {
      setModalLoading(false);
    }
  };

  /* ------------------------- Delete ------------------------- */
  const openDeleteModal = (user) => setDeleteTarget(user);
  const closeDeleteModal = () => setDeleteTarget(null);

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setModalLoading(true);
    try {
      await deleteUser(deleteTarget.userId);
      toast.success("User deleted successfully");
      closeDeleteModal();
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setModalLoading(false);
    }
  };

  /* --------------------- Filter & group ---------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.userId, u.email, u.phoneNumber, u.role]
        .map((x) => (x || "").toString().toLowerCase())
        .some((f) => f.includes(q))
    );
  }, [users, search]);

  const ROLE_ORDER = ["admin", "ima", "deo", "user", "viewer"];
  const ROLE_LABEL = {
    admin: "Admins",
    ima: "IMA",
    deo: "DEO",
    user: "Users",
    viewer: "Viewers",
  };

  const grouped = useMemo(() => {
    const g = { admin: [], ima: [], deo: [], user: [], viewer: [] };
    filtered.forEach((u) => {
      const key = (u.role || "").toLowerCase();
      if (g[key]) g[key].push(u);
    });
    return g;
  }, [filtered]);

  /* --------------------------- UI --------------------------- */
  return (
    <div className="min-h-screen bg-gray-950 p-4 pt-24">
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Spinner />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl text-white font-bold">
          User Management
        </h1>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-[40%]">
          <input
            type="text"
            placeholder="Search name, userId, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} w-full`}
          />
          <button
            onClick={openCreate}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold hover:from-indigo-600 hover:to-indigo-700 transition-shadow shadow-md hover:shadow-lg"
          >
            + Create User
          </button>
        </div>
      </div>

      {/* Sections per role */}
      {ROLE_ORDER.map((roleKey) => {
        const list = grouped[roleKey] || [];
        if (list.length === 0) return null;
        return (
          <section key={roleKey} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-6 rounded bg-indigo-500/70" />
              <h2 className="text-2xl text-white font-semibold">
                {ROLE_LABEL[roleKey]}
              </h2>
              <span className="text-white/60">({list.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {list.map((u) => {
                const initials = getInitials(u.name, u.userId);
                const grad = PALETTE[pickColorIdx(u.userId || u.name || "")];
                return (
                  <div
                    key={u._id || u.userId}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/20 hover:from-slate-900/70 hover:to-slate-900/30 transition shadow-xl"
                  >
                    {/* Accent blur */}
                    <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-25 bg-indigo-600 group-hover:opacity-40 transition" />

                    {/* Header */}
                    <div className="px-6 pt-6 flex flex-col items-center">
                      <div
                        className={`w-20 h-20 rounded-full bg-gradient-to-br ${grad} text-white flex items-center justify-center text-2xl font-bold shadow-md ring-4 ring-white/10`}
                      >
                        {initials}
                      </div>
                      <div className="mt-4 text-center">
                        <div className="text-white text-xl font-semibold">
                          {nice(u.name)}
                        </div>
                        <div className="text-white/60 text-sm">
                          @{nice(u.userId)}
                        </div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Role</span>
                        <span
                          className={`px-2.5 py-1 rounded-full border text-xs ${roleBadge(
                            u.role
                          )}`}
                        >
                          {(u.role || "").toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Email</span>
                        <span className="text-white">{nice(u.email)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Phone</span>
                        <span className="text-white">
                          {nice(u.phoneNumber)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 pb-6 pt-2 flex gap-3">
                      <button
                        onClick={() => openEditModal(u)}
                        className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(u)}
                        className="px-4 py-2 rounded-xl bg-transparent border border-red-500/60 text-red-300 hover:bg-red-500/10 font-medium transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {users.length === 0 && !loading && (
        <div className="text-center text-white/70">No users found.</div>
      )}

      {/* CREATE MODAL — scrollable overlay + clamped panel */}
      {showCreate && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-white/10 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl text-white font-semibold mb-5 text-center">
              Create User
            </h3>
            <form onSubmit={submitCreate} className="space-y-4">
              <div>
                <label className={labelCls}>Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className={inputCls}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={labelCls}>User ID *</label>
                <input
                  type="text"
                  value={createForm.userId}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, userId: e.target.value }))
                  }
                  className={inputCls}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className={labelCls}>Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className={inputCls}
                  autoComplete="new-password"
                />
              </div>

              <Dropdown
                label="Role *"
                options={["Admin", "IMA", "DEO", "User", "Viewer"]}
                value={
                  (createForm.role || "").charAt(0).toUpperCase() +
                  (createForm.role || "").slice(1)
                }
                onChange={(val) =>
                  setCreateForm((f) => ({
                    ...f,
                    role: (val || "").toLowerCase(),
                  }))
                }
                disableSearch
              />

              <div>
                <label className={labelCls}>Job Role</label>
                <input
                  type="text"
                  value={createForm.jobRole}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, jobRole: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputCls}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input
                  type="tel"
                  value={createForm.phoneNumber}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      phoneNumber: e.target.value,
                    }))
                  }
                  className={inputCls}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className={labelCls}>Date of Joining</label>
                <input
                  type="date"
                  value={createForm.dateOfJoining}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      dateOfJoining: e.target.value,
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl transition text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center text-white"
                >
                  {creating ? <DotLoader /> : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL — same overlay/panel pattern */}
      {editUser && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-white/10 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl text-white font-semibold mb-5 text-center">
              Update User
            </h3>
            <form onSubmit={submitUpdate} className="space-y-4">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>User ID</label>
                <input
                  type="text"
                  value={form.userId}
                  disabled
                  className={`${inputCls} disabled:opacity-70`}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Password (leave blank to keep same)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>

              <Dropdown
                label="Role"
                options={["Admin", "IMA", "DEO", "User", "Viewer"]}
                value={
                  (form.role || "").charAt(0).toUpperCase() +
                  (form.role || "").slice(1)
                }
                onChange={(val) =>
                  setForm((f) => ({ ...f, role: (val || "").toLowerCase() }))
                }
                disableSearch
              />

              <div>
                <label className={labelCls}>Job Role</label>
                <input
                  type="text"
                  value={form.jobRole}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, jobRole: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Date of Joining</label>
                <input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dateOfJoining: e.target.value }))
                  }
                  className={inputCls}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl transition text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center text-white"
                >
                  {modalLoading ? <DotLoader /> : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM — same overlay/panel pattern */}
      {deleteTarget && (
        <div className="fixed top-1/3 inset-0 z-[120]  flex items-start justify-center p-4 pt-10 overflow-y-auto">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-2xl w-full max-w-xs text-white border border-white/10 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Confirm Delete</h3>
            <p>
              Are you sure you want to delete{" "}
              <span className="font-bold">{deleteTarget?.name || "-"}</span>?
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={submitDelete}
                disabled={modalLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl transition flex items-center"
              >
                {modalLoading ? <DotLoader /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
