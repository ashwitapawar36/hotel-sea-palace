import { createContext, useCallback, useContext, useEffect, useMemo, useRef , useState } from "react";
import { api, authStorage, ApiError } from "../services/api";
import { connectManagerSocket, disconnectManagerSocket } from "../services/socket";
import { getManagerSummary } from "../utils/managerUtils";
import { useToast } from "./ToastContext";

const ManagerContext = createContext(null);

// Socket.IO delivers new orders/status changes instantly; this poll is just
// a safety net in case a socket event is missed (reconnect gap, etc.).
const POLL_INTERVAL_MS = 20000;

function displayStatus(status) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Turns a backend order row (snake_case, items as {name, variantLabel, quantity})
// into the flat shape the manager UI (OrderManagement, ManagerDashboard) was
// already written against.
function normalizeOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    table: row.table_number || "-",
    createdAt: row.created_at,
    time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    items: (row.items || []).map((it) => `${it.name}${it.variantLabel ? ` (${it.variantLabel})` : ""} x${it.quantity}`),
    total: Number(row.total_amount || 0),
    status: displayStatus(row.status),
    paymentStatus: row.payment_status,
  };
}

export function ManagerProvider({ children }) {
  const { showToast } = useToast();
  const seenOrderIds = useRef(new Set());
const ordersInitialized = useRef(false);
const alertsActive = useRef(false);

useEffect(() => {
  alertsActive.current = true;

  return () => {
    alertsActive.current = false;
  };
}, []);

const notifyNewOrder = useCallback(
  (id, message) => {
    if (
      !alertsActive.current ||
      !id ||
      seenOrderIds.current.has(id)
    ) {
      return;
    }

    seenOrderIds.current.add(id);
    showToast(message, 10000);
  },
  [showToast]
);
  const [manager, setManager] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!authStorage.getAccessToken());
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  // Notifications live in PostgreSQL (the `notifications` table) - this is
  // just a client-side mirror of it, so the unread count survives a page
  // refresh instead of resetting to 0 the way an in-memory-only counter
  // would.
  const [notifications, setNotifications] = useState([]);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  // Dashboard statistics (revenue, order-status breakdown, popular dishes,
  // menu/specials/stock counts) all come from GET /api/dashboard, which is
  // the single source of truth for aggregated numbers - nothing here is
  // recomputed client-side from the `orders` list.
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const fetchOrders = useCallback(
    async ({ silent } = {}) => {
      if (!authStorage.getAccessToken()) return;
      if (!silent) setOrdersLoading(true);
      try {
        const res = await api.get("/orders", { auth: true });
        const normalized = (res?.data || []).map(normalizeOrder);
        if (!alertsActive.current) return;

      if (!ordersInitialized.current) {
        // Existing orders on first load are not new notifications.
        normalized.forEach((order) => {
          seenOrderIds.current.add(order.id);
        });
        ordersInitialized.current = true;
      } else {
        normalized.forEach((order) => {
          notifyNewOrder(
            order.id,
            `New order — Table ${order.table}: ${order.orderNumber}`
          );
        });
      }

      setOrders(normalized);
        setOrdersError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setIsAuthenticated(false);
          authStorage.clearTokens();
        } else {
          setOrdersError(err.message || "Failed to load orders");
        }
      } finally {
        if (!silent) setOrdersLoading(false);
      }
    },
    [notifyNewOrder]
  );

  // PostgreSQL is the source of truth for notification state: this always
  // reflects what's actually stored, so a refresh restores the real unread
  // count instead of guessing from in-memory events.
  const fetchNotifications = useCallback(async () => {
    if (!authStorage.getAccessToken()) return;
    try {
      const res = await api.get("/notifications", { auth: true });
      setNotifications(res?.data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false);
        authStorage.clearTokens();
      }
      // Non-fatal otherwise - the bell just keeps showing the last known count.
    }
  }, []);

  const fetchDashboard = useCallback(async ({ silent } = {}) => {
    if (!authStorage.getAccessToken()) return;
    if (!silent) setDashboardLoading(true);
    try {
      const res = await api.get("/dashboard", { auth: true });
      setDashboard(res?.data || null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIsAuthenticated(false);
        authStorage.clearTokens();
      }
      // Non-fatal otherwise - the dashboard just keeps showing the last known numbers.
    } finally {
      if (!silent) setDashboardLoading(false);
    }
  }, []);

  // Hydrate the manager's own profile after a page refresh (the JWT
  // survives in localStorage, but the `manager` object in memory doesn't).
  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get("/auth/profile", { auth: true })
      .then((res) => setManager(res.data))
      .catch(() => {
        setIsAuthenticated(false);
        authStorage.clearTokens();
      });
  }, [isAuthenticated]);

  // REST polling - always on while authenticated, as a fallback for missed
  // socket events (reconnects, tab was backgrounded, etc.). Notifications and
  // dashboard stats are fetched from PostgreSQL the same way orders are, so a
  // refresh (or a missed socket event) always restores the real numbers.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    fetchOrders();
    fetchNotifications();
    fetchDashboard();
    const intervalId = window.setInterval(() => {
      fetchOrders({ silent: true });
      fetchNotifications();
      fetchDashboard({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, fetchOrders, fetchNotifications, fetchDashboard]);

  // Real-time push via Socket.IO. The backend's socket auth middleware only
  // accepts a valid manager JWT, so this channel is manager-only by
  // construction - customers never open a socket connection at all.
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectManagerSocket();
      return undefined;
    }

    const token = authStorage.getAccessToken();
    if (!token) return undefined;

    const socket = connectManagerSocket(token);

    const handleNewOrder = (payload) => {
      notifyNewOrder(
        payload?.orderId,
        payload?.orderNumber
          ? `New order received: ${payload.orderNumber}`
          : "New order received"
      );
      // The backend already wrote a persistent notification row for this
      // order (orderController.placeOrder) - pull it in from Postgres
      // rather than guessing the unread count client-side.
      fetchOrders({ silent: true });
      fetchNotifications();
      fetchDashboard({ silent: true });
    };

    const handleStatusUpdated = (payload) => {
      if (!payload?.orderId) return;
      setOrders((prev) =>
        prev.map((order) => (order.id === payload.orderId ? { ...order, status: displayStatus(payload.status) } : order))
      );
      fetchDashboard({ silent: true });
    };

    socket.on("new_order", handleNewOrder);
    socket.on("order_status_updated", handleStatusUpdated);

    return () => {
      socket.off("new_order", handleNewOrder);
      socket.off("order_status_updated", handleStatusUpdated);
      disconnectManagerSocket();
      };
      }, [
        isAuthenticated,
        fetchOrders,
        fetchNotifications,
        fetchDashboard,
        notifyNewOrder,
      ]);

  const login = useCallback(
    async (username, password) => {
      if (!username.trim() || !password.trim()) {
        showToast("Please enter username and password");
        return { ok: false, message: "Please enter username and password" };
      }
      try {
        const res = await api.post("/auth/login", { username: username.trim(), password: password.trim() });
        const { accessToken, refreshToken, manager: managerData } = res.data;
        authStorage.setTokens({ accessToken, refreshToken });
        setManager(managerData);
        setIsAuthenticated(true);
        showToast("Login successful");
        return { ok: true };
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Unable to sign in right now.";
        showToast(message);
        return { ok: false, message };
      }
    },
    [showToast]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {}, { auth: true });
    } catch {
      // best-effort - clear local session regardless of network state
    }
    disconnectManagerSocket();
    authStorage.clearTokens();
    setManager(null);
    setIsAuthenticated(false);
    seenOrderIds.current.clear();
    ordersInitialized.current = false;
    setOrders([]);
    setNotifications([]);
    setDashboard(null);
  }, []);

  const updateOrderStatus = useCallback(
    async (id, displayStatusValue) => {
      const status = displayStatusValue.toLowerCase();
      const previous = orders;
      setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, status: displayStatusValue } : order)));
      try {
        await api.patch(`/orders/${id}/status`, { status }, { auth: true });
      } catch (err) {
        setOrders(previous);
        showToast(err instanceof ApiError ? err.message : "Failed to update order status");
      }
    },
    [orders, showToast]
  );

  // Persists the "read" state in PostgreSQL (source of truth) and only then
  // updates the local mirror, so unreadCount stays correct after a refresh.
  const clearUnread = useCallback(async () => {
    if (notifications.every((n) => n.is_read)) return;
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.patch("/notifications/read", {}, { auth: true });
    } catch {
      setNotifications(previous);
    }
  }, [notifications]);

  const summary = useMemo(() => getManagerSummary(orders), [orders]);

  return (
    <ManagerContext.Provider
      value={{
        manager,
        orders,
        ordersLoading,
        ordersError,
        reloadOrders: fetchOrders,
        updateOrderStatus,
        notifications,
        unreadCount,
        clearUnread,
        dashboard,
        dashboardLoading,
        reloadDashboard: fetchDashboard,
        summary,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </ManagerContext.Provider>
  );
}

export function useManager() {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error("useManager must be used within ManagerProvider");
  return ctx;
}
