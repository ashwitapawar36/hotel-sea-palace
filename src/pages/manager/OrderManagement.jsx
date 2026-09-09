import TopBar from "../../components/TopBar";
import { useManager } from "../../context/ManagerContext";

const pillClass = {
  Pending: "status-pending",
  Accepted: "status-accepted",
  Preparing: "status-preparing",
  Ready: "status-ready",
  Completed: "status-completed",
  Cancelled: "status-cancelled",
};

// Must match the backend's orders_status_check constraint exactly
// (pending/accepted/preparing/ready/completed/cancelled) - updateOrderStatus
// lowercases whatever is selected here before it PATCHes /api/orders/:id/status.
const STATUSES = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Cancelled"];

export default function OrderManagement() {
  const { orders, ordersLoading, ordersError, reloadOrders, updateOrderStatus } = useManager();

  return (
    <div className="app-shell">
      <TopBar title="Order Management" />
      <div className="page" style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
        {ordersLoading && orders.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading orders…</p>
        ) : ordersError ? (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <p style={{ color: "var(--red, #e53935)", fontSize: 13, marginBottom: 10 }}>{ordersError}</p>
            <button className="outline-btn" style={{ maxWidth: 140, margin: "0 auto" }} onClick={() => reloadOrders()}>
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>No orders yet.</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 14, fontWeight: 700 }}>{o.orderNumber}</p>
                  <p style={{ color: "var(--muted)", fontSize: 11 }}>Table {o.table} · {o.time}</p>
                </div>
                <span className={`status-pill ${pillClass[o.status] || "status-pending"}`}>{o.status}</span>
              </div>

              <div style={{ marginBottom: 14 }}>
                {o.items.map((it, idx) => (
                  <p key={`${o.id}-${idx}`} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                    • {it}
                  </p>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Total</span>
                <span style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: 13, color: "var(--gold)" }}>₹{o.total.toLocaleString("en-IN")}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>Status</label>
                <select className="text-input" value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
