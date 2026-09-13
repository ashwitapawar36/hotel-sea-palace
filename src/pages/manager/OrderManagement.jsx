import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Users, RotateCcw, XCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import TopBar from "../../components/TopBar";
import { useManager } from "../../context/ManagerContext";
import { useToast } from "../../context/ToastContext";
import { api, ApiError } from "../../services/api";

const pillClass = {
  pending: "status-pending",
  accepted: "status-accepted",
  preparing: "status-preparing",
  ready: "status-ready",
  completed: "status-completed",
  cancelled: "status-cancelled",
};

const STATUSES = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Cancelled"];

export default function OrderManagement() {
  const { orders, ordersLoading, ordersError, reloadOrders, updateOrderStatus } = useManager();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("visits"); // "visits" | "all"
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const fetchActiveVisits = useCallback(async () => {
    setVisitsLoading(true);
    setVisitsError("");
    try {
      const res = await api.get("/visits/active", { auth: true });
      setVisits(res?.data || []);
    } catch (err) {
      setVisitsError(err instanceof ApiError ? err.message : "Failed to load active visits");
    } finally {
      setVisitsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveVisits();
  }, [fetchActiveVisits]);

  const handleReopenVisit = async (visitId) => {
    setActionLoading(`reopen-${visitId}`);
    try {
      await api.post(`/visits/${visitId}/reopen`, {}, { auth: true });
      showToast("Visit reopened. Previous bill invalidated so customer can order more.");
      await fetchActiveVisits();
      reloadOrders({ silent: true });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not reopen visit.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseVisit = async (visitId) => {
    if (!window.confirm("Are you sure you want to close this table visit? Further orders will be rejected.")) {
      return;
    }
    setActionLoading(`close-${visitId}`);
    try {
      await api.post(`/visits/${visitId}/close`, {}, { auth: true });
      showToast("Visit closed successfully.");
      await fetchActiveVisits();
      reloadOrders({ silent: true });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Could not close visit.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoundStatusChange = async (orderId, newStatus) => {
    await updateOrderStatus(orderId, newStatus);
    await fetchActiveVisits();
  };

  return (
    <div className="app-shell">
      <TopBar title="Order & Table Management" />

      <div className="page" style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={activeTab === "visits" ? "gold-btn" : "outline-btn"}
            style={{ flex: 1, padding: "9px 0", fontSize: 12.5 }}
            onClick={() => setActiveTab("visits")}
          >
            <Users size={14} /> Active Visits ({visits.length})
          </button>
          <button
            type="button"
            className={activeTab === "all" ? "gold-btn" : "outline-btn"}
            style={{ flex: 1, padding: "9px 0", fontSize: 12.5 }}
            onClick={() => setActiveTab("all")}
          >
            All Order Rounds ({orders.length})
          </button>
        </div>

        {/* ACTIVE VISITS VIEW */}
        {activeTab === "visits" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p className="section-title" style={{ marginBottom: 0 }}>
                Table Visits
              </p>
              <button
                type="button"
                onClick={fetchActiveVisits}
                style={{ background: "transparent", border: "none", color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {visitsLoading && visits.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Loading active visits…</p>
            ) : visitsError ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{visitsError}</p>
                <button className="outline-btn" style={{ maxWidth: 140, margin: "0 auto" }} onClick={fetchActiveVisits}>
                  Retry
                </button>
              </div>
            ) : visits.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
                No active visits right now. Customer visits will show here.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {visits.map((v) => {
                  const visitStatus = (v.status || "open").toLowerCase();
                  const isClosed = visitStatus === "closed";
                  const isBillReq = visitStatus === "bill_requested";

                  return (
                    <div
                      key={v.id}
                      className="card"
                      style={{
                        padding: 16,
                        borderLeft: isClosed
                          ? "3px solid var(--muted)"
                          : isBillReq
                            ? "3px solid var(--gold)"
                            : "3px solid #22c55e",
                      }}
                    >
                      {/* Visit Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 14, fontWeight: 700 }}>
                              {v.visitorLabel || `Table ${v.table_number}`}
                            </p>
                          </div>
                          <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                            Opened: {new Date(v.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {v.closed_at ? ` · Closed: ${new Date(v.closed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                          </p>
                        </div>
                        <span
                          className={`status-pill ${
                            isClosed
                              ? "status-cancelled"
                              : isBillReq
                                ? "status-ready"
                                : "status-accepted"
                          }`}
                        >
                          {v.status ? v.status.replace("_", " ").toUpperCase() : "OPEN"}
                        </span>
                      </div>

                      {/* Active Bill snapshot info if requested */}
                      {v.active_bill && (
                        <div style={{ background: "var(--gold-dim)", padding: "8px 12px", borderRadius: 8, margin: "8px 0 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700 }}>
                              Current Bill: {v.active_bill.bill_number}
                            </span>
                            {v.active_bill.revision > 1 && (
                              <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6 }}>
                                (Rev #{v.active_bill.revision})
                              </span>
                            )}
                          </div>
                          <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontWeight: 700, fontSize: 13 }}>
                            ₹{Number(v.active_bill.total_amount || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}

                      {/* Manager Controls for Visit */}
                      <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
                        {isBillReq && (
                          <button
                            type="button"
                            className="outline-btn"
                            disabled={actionLoading === `reopen-${v.id}`}
                            onClick={() => handleReopenVisit(v.id)}
                            style={{ flex: 1, fontSize: 11.5, padding: "7px 0", color: "var(--gold)", borderColor: "var(--gold)" }}
                          >
                            <RotateCcw size={13} /> Reopen for Items
                          </button>
                        )}
                        {!isClosed && (
                          <button
                            type="button"
                            className="outline-btn"
                            disabled={actionLoading === `close-${v.id}`}
                            onClick={() => handleCloseVisit(v.id)}
                            style={{ flex: 1, fontSize: 11.5, padding: "7px 0", color: "var(--red)", borderColor: "rgba(229,57,53,0.3)" }}
                          >
                            <XCircle size={13} /> Close Visit
                          </button>
                        )}
                      </div>

                      {/* Submitted Order Rounds */}
                      <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          Rounds ({v.orders?.length || 0})
                        </p>

                        {!v.orders?.length ? (
                          <p style={{ color: "var(--muted)", fontSize: 11.5 }}>No orders sent for this visit yet.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {v.orders.map((ord, roundIdx) => {
                              const ordStatus = (ord.status || "pending").toLowerCase();
                              return (
                                <div key={ord.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--white)" }}>
                                      Round #{roundIdx + 1}: {ord.order_number}
                                    </span>
                                    <select
                                      className="text-input"
                                      value={ord.status ? ord.status.charAt(0).toUpperCase() + ord.status.slice(1) : "Pending"}
                                      onChange={(e) => handleRoundStatusChange(ord.id, e.target.value)}
                                      style={{ padding: "4px 8px", fontSize: 11, maxWidth: 120, height: "auto" }}
                                    >
                                      {STATUSES.map((st) => (
                                        <option key={st} value={st}>
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
                                    {(ord.items || []).map((it, i) => (
                                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span>• {it.name}{it.variant_label ? ` (${it.variant_label})` : ""} × {it.quantity}</span>
                                        <span>₹{Number(it.line_total || 0).toLocaleString("en-IN")}</span>
                                      </div>
                                    ))}
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, marginTop: 4, paddingTop: 4, borderTop: "1px dashed var(--border)" }}>
                                    <span style={{ color: "var(--muted)" }}>Round Total</span>
                                    <span style={{ color: ordStatus === "cancelled" ? "var(--red)" : "var(--gold)" }}>
                                      ₹{Number(ord.total_amount || 0).toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FLAT ALL ORDERS VIEW */}
        {activeTab === "all" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p className="section-title" style={{ marginBottom: 0 }}>
                All Orders ({orders.length})
              </p>
              <button
                type="button"
                onClick={() => reloadOrders()}
                style={{ background: "transparent", border: "none", color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {ordersLoading && orders.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Loading orders…</p>
            ) : ordersError ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{ordersError}</p>
                <button className="outline-btn" style={{ maxWidth: 140, margin: "0 auto" }} onClick={() => reloadOrders()}>
                  Retry
                </button>
              </div>
            ) : orders.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No orders yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {orders.map((o) => (
                  <div key={o.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 14, fontWeight: 700 }}>
                          {o.orderNumber}
                        </p>
                        <p style={{ color: "var(--muted)", fontSize: 11 }}>
                          Table {o.table} · {o.time}
                        </p>
                      </div>
                      <span className={`status-pill ${pillClass[o.status.toLowerCase()] || "status-pending"}`}>
                        {o.status}
                      </span>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      {o.items.map((it, idx) => (
                        <p key={`${o.id}-${idx}`} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                          • {it}
                        </p>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Total</span>
                      <span style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: 13, color: "var(--gold)" }}>
                        ₹{o.total.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label className="field-label" style={{ marginBottom: 0 }}>Update Kitchen Status</label>
                      <select
                        className="text-input"
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
