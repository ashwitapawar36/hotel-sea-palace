export function createOrderFromCart({ cartDishes, tableNumber, orderId, invoiceNumber, createdAt }) {
  return {
    id: orderId,
    invoiceNumber,
    table: tableNumber,
    createdAt,
    items: cartDishes.map((dish) => `${dish.name} x${dish.qty}`),
    total: cartDishes.reduce((sum, dish) => sum + dish.price * dish.qty, 0),
    status: 'Pending',
    time: 'Just now',
  };
}

function isSameCalendarDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getManagerSummary(orders, now = new Date()) {
  const pendingCount = orders.filter((order) => ['Pending', 'Preparing', 'Ready'].includes(order.status)).length;
  const revenueToday = orders
    .filter((order) => order.createdAt && isSameCalendarDay(new Date(order.createdAt), now))
    .reduce((sum, order) => sum + (order.total || 0), 0);

  return {
    totalOrders: orders.length,
    pendingOrders: pendingCount,
    revenueToday,
    recentOrders: orders.slice(0, 4),
  };
}
