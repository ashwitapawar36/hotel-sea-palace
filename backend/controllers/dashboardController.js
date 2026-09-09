const db = require('../config/db');

async function getDashboard(req, res, next) {
  try {
    const [ordersSummary, revenue, popularDishes, menuStats, specials, notifications, stockStatus, settings] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
           COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_orders,
           COUNT(*) FILTER (WHERE status = 'preparing') AS preparing_orders,
           COUNT(*) FILTER (WHERE status = 'ready') AS ready_orders,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
           COUNT(*) AS total_orders
         FROM orders`,
      ),
      // Revenue is money actually collected - driven by orders.payment_status
      // (set to 'paid' only by orderController.payOrder), not by order
      // status. A completed-but-unpaid order must not count.
      db.query(`SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE payment_status = 'paid'`),
      // Popularity is measured by total quantity actually sold, not the number
      // of order rows an item appears on, and cancelled orders never count.
      db.query(
        `SELECT oi.menu_item_id, mi.name, mi.image_url, mi.price, SUM(oi.quantity)::int AS total_quantity
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE o.status != 'cancelled'
         GROUP BY oi.menu_item_id, mi.name, mi.image_url, mi.price
         ORDER BY total_quantity DESC
         LIMIT 5`,
      ),
      db.query(`SELECT COUNT(*) FILTER (WHERE is_available = TRUE) AS available_items, COUNT(*) FILTER (WHERE is_available = FALSE) AS unavailable_items, COUNT(*) AS total_items FROM menu_items`),
      db.query(`SELECT mi.id, mi.name, ts.discount_percent FROM todays_specials ts JOIN menu_items mi ON mi.id = ts.menu_item_id WHERE ts.starts_at <= NOW() AND (ts.ends_at IS NULL OR ts.ends_at >= NOW()) ORDER BY ts.created_at DESC`),
      db.query(`SELECT id, title, message, type, is_read, created_at FROM notifications WHERE manager_id = $1 ORDER BY created_at DESC LIMIT 10`, [req.manager.id]),
      db.query(`SELECT COUNT(*) FILTER (WHERE is_available = TRUE) AS in_stock, COUNT(*) FILTER (WHERE is_available = FALSE) AS out_of_stock FROM menu_items`),
      db.query(`SELECT key, value FROM restaurant_settings ORDER BY key`),
    ]);

    const summary = ordersSummary.rows[0];

    res.json({
      success: true,
      data: {
        todayOrders: Number(summary.total_orders || 0),
        pendingOrders: Number(summary.pending_orders || 0),
        acceptedOrders: Number(summary.accepted_orders || 0),
        preparingOrders: Number(summary.preparing_orders || 0),
        readyOrders: Number(summary.ready_orders || 0),
        completedOrders: Number(summary.completed_orders || 0),
        cancelledOrders: Number(summary.cancelled_orders || 0),
        revenue: Number(revenue.rows[0].revenue || 0),
        popularDishes: popularDishes.rows,
        menuStatistics: menuStats.rows[0],
        specials: specials.rows,
        notifications: notifications.rows,
        stockStatus: stockStatus.rows[0],
        restaurantSettings: settings.rows,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboard };