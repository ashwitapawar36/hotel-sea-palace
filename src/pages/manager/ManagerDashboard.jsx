import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, TrendingUp, ShoppingBag, Users, Clock, UtensilsCrossed, ClipboardList, BellRing, CheckCircle2, ArrowRight, Star, Percent, PackageX } from "lucide-react";
import { useManager } from "../../context/ManagerContext";

const ACTIONS = [
  { label: "Manage Menu", icon: UtensilsCrossed, path: "/manager/menu" },
  { label: "Orders", icon: ClipboardList, path: "/manager/orders" },
];

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { orders, ordersLoading, dashboard, unreadCount, clearUnread, logout, isAuthenticated } = useManager();

  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/manager/login");
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  // Every value below comes straight from GET /api/dashboard (real
  // PostgreSQL aggregates) - nothing here is recalculated from the `orders`
  // list in React. Before the first successful fetch (or with zero real
  // data) every metric correctly falls back to 0 / ₹0.
  const metrics = useMemo(
    () => [
      { label: "Revenue", value: `₹${(dashboard?.revenue || 0).toLocaleString("en-IN")}`, icon: TrendingUp, accent: "gold" },
      { label: "Pending Orders", value: dashboard?.pendingOrders || 0, icon: Clock, accent: "amber" },
      { label: "Preparing Orders", value: dashboard?.preparingOrders || 0, icon: ShoppingBag, accent: "blue" },
      { label: "Completed Orders", value: dashboard?.completedOrders || 0, icon: CheckCircle2, accent: "green" },
      { label: "Total Orders", value: dashboard?.todayOrders || 0, icon: Users, accent: "neutral" },
    ],
    [dashboard]
  );

  const topDish = dashboard?.popularDishes?.[0] || null;
  const menuStats = dashboard?.menuStatistics || null;
  const specialsCount = dashboard?.specials?.length || 0;
  const outOfStockCount = Number(dashboard?.stockStatus?.out_of_stock || 0);

  const insights = useMemo(
    () => [
      { label: "Top Dish", value: topDish ? topDish.name : "No sales yet", icon: Star, accent: "gold" },
      { label: "Menu Items", value: menuStats ? `${menuStats.available_items || 0}/${menuStats.total_items || 0}` : "0/0", icon: UtensilsCrossed, accent: "blue" },
      { label: "Today's Specials", value: specialsCount, icon: Percent, accent: "green" },
      { label: "Out of Stock", value: outOfStockCount, icon: PackageX, accent: outOfStockCount > 0 ? "amber" : "neutral" },
    ],
    [topDish, menuStats, specialsCount, outOfStockCount]
  );

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <p className="page-title">Manager Overview</p>
          <p className="page-subtitle">Sea Palace • {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="icon-btn" onClick={() => navigate("/manager/dashboard")}
            style={{ position: "relative" }} aria-label="Notifications">
            <BellRing size={16} color="var(--muted)" />
            {unreadCount > 0 ? <span className="notification-badge badge-pop">{unreadCount}</span> : null}
          </button>
          <button type="button" className="icon-btn" onClick={() => { logout(); navigate("/manager/login"); }} aria-label="Logout">
            <LogOut size={16} color="var(--muted)" />
          </button>
        </div>
      </div>

      <div className="page dashboard-page">
        <div className="card dashboard-hero">
          <div>
            <p className="eyebrow">Operations Center</p>
            <h2>Stay ahead of service with a polished command view.</h2>
            <p>Track live orders, order status, and revenue in one place.</p>
          </div>
          <div className="hero-badge">Live</div>
        </div>

        <div className="stats-grid">
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="card metric-card">
                <div className={`metric-icon ${item.accent}`}>
                  <Icon size={16} color="var(--white)" />
                </div>
                <p className="metric-value">{item.value}</p>
                <p className="metric-label">{item.label}</p>
              </div>
            );
          })}
        </div>

        <div className="stats-grid">
          {insights.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="card metric-card">
                <div className={`metric-icon ${item.accent}`}>
                  <Icon size={16} color="var(--white)" />
                </div>
                <p className="metric-value" style={{ fontSize: 15 }}>{item.value}</p>
                <p className="metric-label">{item.label}</p>
              </div>
            );
          })}
        </div>

        <div className="card dashboard-panel">
          <div className="section-header">
            <div>
              <p className="section-title">Recent Orders</p>
              <div className="section-underline" />
            </div>
            <button className="text-link" onClick={() => navigate("/manager/orders")}>View all <ArrowRight size={14} /></button>
          </div>

          <div className="orders-table-wrap">
            {ordersLoading && recentOrders.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>Loading orders…</p>
            ) : recentOrders.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12.5, textAlign: "center", padding: "24px 0" }}>No orders yet</p>
            ) : (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Table</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const statusKey = order.status;
                    const statusClass =
                      statusKey === "Pending"
                        ? "status-pending"
                        : statusKey === "Accepted"
                          ? "status-accepted"
                          : statusKey === "Preparing"
                            ? "status-preparing"
                            : statusKey === "Ready"
                              ? "status-ready"
                              : statusKey === "Cancelled"
                                ? "status-cancelled"
                                : "status-completed";

                    return (
                      <tr key={order.id}>
                        <td>
                          <div className="order-cell">
                            <strong>{order.orderNumber || order.id}</strong>
                            <span>{order.items?.[0] || "Chef special"}</span>
                          </div>
                        </td>
                        <td>{order.table}</td>
                        <td><span className={`status-pill ${statusClass}`}>{order.status}</span></td>
                        <td>₹{(order.total || 0).toLocaleString("en-IN")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card dashboard-panel">
          <div className="section-header">
            <div>
              <p className="section-title">Quick Actions</p>
              <div className="section-underline" />
            </div>
          </div>
          <div className="quick-actions-grid">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button type="button" key={action.label} className="quick-action-btn" onClick={() => navigate(action.path)}>
                  <Icon size={18} color="var(--gold)" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
