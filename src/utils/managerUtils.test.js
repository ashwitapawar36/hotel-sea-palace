import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderFromCart, getManagerSummary } from './managerUtils.js';

test('createOrderFromCart builds a manager order from cart items', () => {
  const order = createOrderFromCart({
    cartDishes: [
      { id: 1, name: 'Butter Garlic Crab', price: 899, qty: 2 },
      { id: 2, name: 'Fish & Chips', price: 549, qty: 1 },
    ],
    tableNumber: 7,
    orderId: 'ORD-2001',
    invoiceNumber: 'INV-2001',
    createdAt: '2026-08-04',
  });

  assert.equal(order.id, 'ORD-2001');
  assert.equal(order.table, 7);
  assert.equal(order.status, 'Pending');
  assert.equal(order.items[0], 'Butter Garlic Crab x2');
  assert.equal(order.total, 2347);
});

test('getManagerSummary aggregates dashboard values', () => {
  const today = new Date('2026-08-04T12:00:00.000Z');
  const summary = getManagerSummary(
    [
      { id: '1', status: 'Pending', total: 1200, createdAt: '2026-08-04T09:00:00.000Z' },
      { id: '2', status: 'Preparing', total: 900, createdAt: '2026-08-04T10:30:00.000Z' },
      { id: '3', status: 'Ready', total: 650, createdAt: '2026-08-04T11:15:00.000Z' },
      { id: '4', status: 'Served', total: 1500, createdAt: '2026-08-03T18:00:00.000Z' },
    ],
    today
  );

  assert.equal(summary.totalOrders, 4);
  assert.equal(summary.pendingOrders, 3);
  assert.equal(summary.revenueToday, 2750);
  assert.equal(summary.recentOrders.length, 4);
});

test('getManagerSummary excludes orders without createdAt from revenueToday', () => {
  const today = new Date('2026-08-04T12:00:00.000Z');
  const summary = getManagerSummary(
    [
      { id: '1', status: 'Preparing', total: 999 },
      { id: '2', status: 'Served', total: 1500, createdAt: '2026-08-04T08:00:00.000Z' },
    ],
    today
  );

  assert.equal(summary.revenueToday, 1500);
});
