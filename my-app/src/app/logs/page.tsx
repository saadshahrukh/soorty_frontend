"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import { toast } from "@/store/toastStore";

type AuditLog = {
  _id: string;
  userId: { _id: string; name: string; email: string } | string;
  userName?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VIEW";
  entityType: string;
  entityId?: string;
  changes?: any;
  createdAt: string;
};

type DiffItem = { field: string; before: any; after: any };

function buildDiff(changes: any): DiffItem[] {
  if (!changes) return [];
  const before = changes.before || {};
  const after = changes.after || {};
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  );
  const diffs: DiffItem[] = [];
  keys.forEach((k) => {
    const b = (before as any)[k];
    const a = (after as any)[k];
    const same = JSON.stringify(b) === JSON.stringify(a);
    if (!same) diffs.push({ field: k, before: b, after: a });
  });
  return diffs;
}

function renderValue(val: any): string {
  if (val == null) return "—";
  if (Array.isArray(val)) {
    const items = val.map((v) => {
      if (v && typeof v === "object") {
        const oid = (v as any).orderId || (v as any)._id || "";
        const name = (v as any).productServiceName || (v as any).name || "";
        return [oid, name].filter(Boolean).join(" - ");
      }
      return String(v);
    });
    return items.join(", ");
  }
  if (typeof val === "object") {
    const keys = [
      "orderId",
      "productServiceName",
      "paymentStatus",
      "costPrice",
      "sellingPrice",
      "partialPaidAmount",
      "partialRemainingAmount",
      "name",
      "email",
      "role",
    ];
    const picked: any = {};
    keys.forEach((k) => {
      if (val[k] !== undefined) picked[k] = val[k];
    });
    const toShow = Object.keys(picked).length ? picked : val;
    try {
      return JSON.stringify(toShow);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export default function LogsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<
    "All" | "CREATE" | "UPDATE" | "DELETE" | "VIEW"
  >("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [limit, setLimit] = useState(200);

  // ✅ Accordion open state for each log
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [delStart, setDelStart] = useState("");
  const [delEnd, setDelEnd] = useState("");
  const [delAction, setDelAction] = useState<
    "All" | "CREATE" | "UPDATE" | "DELETE" | "VIEW"
  >("All");
  const [delEntity, setDelEntity] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    if (user?.role !== "Admin") {
      router.push("/orders");
      return;
    }
    fetchLogs();
  }, [isAuthenticated]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users/audit-logs", {
        params: { limit },
      });
      let items: AuditLog[] = data;
      if (actionFilter !== "All")
        items = items.filter((l) => l.action === actionFilter);
      if (startDate)
        items = items.filter(
          (l) => new Date(l.createdAt) >= new Date(startDate)
        );
      if (endDate)
        items = items.filter((l) => new Date(l.createdAt) <= new Date(endDate));
      if (entityFilter.trim())
        items = items.filter((l) =>
          l.entityType.toLowerCase().includes(entityFilter.trim().toLowerCase())
        );
      if (userQuery.trim()) {
        items = items.filter((l) => {
          if (typeof l.userId === "object") {
            const obj: any = l.userId;
            return (
              obj.name?.toLowerCase().includes(userQuery.toLowerCase()) ||
              obj.email?.toLowerCase().includes(userQuery.toLowerCase())
            );
          }
          return (l.userName || "")
            .toLowerCase()
            .includes(userQuery.toLowerCase());
        });
      }
      setLogs(items);
      toast.success(`Loaded ${items.length} logs`);
    } catch (e) {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const applyDelete = async () => {
    setDeleting(true);
    try {
      const payload: any = {};
      if (delStart) payload.startDate = new Date(delStart).toISOString();
      if (delEnd) payload.endDate = new Date(delEnd).toISOString();
      if (delAction !== "All") payload.action = delAction;
      if (delEntity.trim()) payload.entityType = delEntity.trim();
      const { data } = await api.delete("/users/audit-logs", { data: payload });
      setShowDeleteModal(false);
      setDelStart("");
      setDelEnd("");
      setDelAction("All");
      setDelEntity("");
      await fetchLogs();
      toast.success(`Deleted ${data?.deletedCount ?? 0} log(s)`);
    } catch {
      toast.error("Delete logs failed");
    } finally {
      setDeleting(false);
    }
  };

  const enhancedLogs = useMemo(
    () =>
      logs.map((l) => ({
        ...l,
        diffs: buildDiff(l.changes),
      })),
    [logs]
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1">
        <nav className="bg-white border-b sticky top-0 z-50">
          <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              PS
            </div>
            <button
              onClick={() => router.push("/orders")}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-md"
            >
              Orders
            </button>
          </div>
        </nav>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {/* --- Filters (unchanged) --- */}
          {/* Filters */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Action
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option>All</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="VIEW">VIEW</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Entity
                </label>
                <input
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value)}
                  placeholder="e.g., Order, User"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  User
                </label>
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="name or email"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Start
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  End
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Show
                </label>
                <select
                  value={String(limit)}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={fetchLogs}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setActionFilter("All");
                  setEntityFilter("");
                  setUserQuery("");
                  setStartDate("");
                  setEndDate("");
                  fetchLogs();
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md"
              >
                Reset
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-md"
              >
                Delete Logs by Filter
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-6">Loading...</div>
            ) : enhancedLogs.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6">No logs</div>
            ) : (
              enhancedLogs.map((log) => {
                const userName =
                  typeof log.userId === "object"
                    ? `${(log.userId as any).name} (${
                        (log.userId as any).email
                      })`
                    : log.userName || "Unknown";

                const header = `${log.action} ${log.entityType}${
                  log.entityId ? ` (${log.entityId})` : ""
                }`;
                const when = new Date(log.createdAt).toLocaleString();
                const open = openItems[log._id] ?? false;

                return (
                  <div
                    key={log._id}
                    className="bg-white rounded-xl shadow border border-gray-200"
                  >
                    {/* Accordion Header */}
                    <button
                      onClick={() =>
                        setOpenItems((prev) => ({ ...prev, [log._id]: !open }))
                      }
                      className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-lg flex items-center justify-center text-white font-semibold ${
                            log.action === "CREATE"
                              ? "bg-emerald-600"
                              : log.action === "UPDATE"
                              ? "bg-blue-600"
                              : log.action === "DELETE"
                              ? "bg-rose-600"
                              : "bg-gray-600"
                          }`}
                        >
                          {log.action[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {header}
                          </div>
                          <div className="text-sm text-gray-500">
                            {userName} • {when}
                          </div>
                        </div>
                      </div>

                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Accordion Body */}
                    {open && (
                      <div className="px-4 pb-4 border-t animate-fadeIn">
                        {log.diffs.length > 0 ? (
                          <div className="overflow-x-auto mt-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="px-4 py-2 text-left text-gray-600">
                                    Field
                                  </th>
                                  <th className="px-4 py-2 text-left text-gray-600">
                                    Before
                                  </th>
                                  <th className="px-4 py-2 text-left text-gray-600">
                                    After
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {log.diffs.map((d, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-800">
                                      {d.field}
                                    </td>
                                    <td className="px-4 py-2 text-gray-700">
                                      {renderValue(d.before)}
                                    </td>
                                    <td className="px-4 py-2 text-gray-900 font-semibold">
                                      {renderValue(d.after)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 mt-3">
                            No field changes recorded.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* --- Delete Modal (unchanged) --- */}
          {/* Delete Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6">
                <h3 className="text-lg font-bold mb-4">
                  Delete Logs by Filter
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Start
                    </label>
                    <input
                      type="datetime-local"
                      value={delStart}
                      onChange={(e) => setDelStart(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      End
                    </label>
                    <input
                      type="datetime-local"
                      value={delEnd}
                      onChange={(e) => setDelEnd(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Action
                    </label>
                    <select
                      value={delAction}
                      onChange={(e) => setDelAction(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option>All</option>
                      <option value="CREATE">CREATE</option>
                      <option value="UPDATE">UPDATE</option>
                      <option value="DELETE">DELETE</option>
                      <option value="VIEW">VIEW</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Entity
                    </label>
                    <input
                      value={delEntity}
                      onChange={(e) => setDelEntity(e.target.value)}
                      placeholder="e.g., Order"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded p-3 mb-4">
                  This action is permanent and cannot be undone.
                </div>
                <div className="flex justify-between">
                  <button
                    onClick={() => {
                      setDelStart("");
                      setDelEnd("");
                      setDelAction("All");
                      setDelEntity("");
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Clear
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={deleting}
                      onClick={applyDelete}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
