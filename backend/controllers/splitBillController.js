const db = require('../config/db');

// All money math below is done in integer paise (cents) rather than
// floating-point rupees, specifically so the sum of every person's rounded
// share can be forced to equal the order's total_amount exactly - see the
// remainder-distribution step at the bottom of buildShares().
function toPaise(amount) {
  return Math.round(Number(amount) * 100);
}

function fromPaise(paise) {
  return Math.round(paise) / 100;
}

// Splits an order's items across a list of people, honoring explicit
// per-item assignments where given and falling back to an equal split
// (across everyone) for anything left unassigned - which also covers the
// "no assignments at all" case, i.e. a plain equal split.
function buildShares({ people, orderItems, assignments, subtotalPaise, taxPaise, totalPaise }) {
  const sharesPaise = new Map(people.map((p) => [p.clientId, 0]));

  orderItems.forEach((item) => {
    const assigned = assignments[item.id];
    const itemLinePaise = toPaise(item.line_total);
    const sharers = assigned && assigned.length > 0 ? assigned : people.map((p) => p.clientId);
    const base = Math.floor(itemLinePaise / sharers.length);
    let remainder = itemLinePaise - base * sharers.length;

    sharers.forEach((clientId) => {
      let portion = base;
      if (remainder > 0) {
        portion += 1;
        remainder -= 1;
      }
      sharesPaise.set(clientId, (sharesPaise.get(clientId) || 0) + portion);
    });
  });

  // Distribute tax proportionally to each person's pre-tax share of the
  // subtotal, then fold it in so `amount` below is what that person
  // actually owes (item cost + their slice of GST).
  let taxRemainder = taxPaise;
  const entries = people.map((p, index) => {
    const preTax = sharesPaise.get(p.clientId) || 0;
    const proportionalTax = subtotalPaise > 0 ? Math.floor((preTax * taxPaise) / subtotalPaise) : 0;
    return { ...p, preTax, tax: proportionalTax, index };
  });
  entries.forEach((e) => {
    taxRemainder -= e.tax;
  });
  // Any leftover paise from the floor() above (a few cents at most) goes to
  // whoever has the largest pre-tax share, so the split's total tax always
  // matches the order's actual tax_amount exactly.
  if (taxRemainder > 0 && entries.length > 0) {
    const biggest = [...entries].sort((a, b) => b.preTax - a.preTax)[0];
    biggest.tax += taxRemainder;
  }

  let sumPaise = 0;
  const result = entries.map((e) => {
    const amountPaise = e.preTax + e.tax;
    sumPaise += amountPaise;
    return { clientId: e.clientId, name: e.name, amountPaise };
  });

  // Guarantee the individual shares add up to the order's real total,
  // paisa for paisa, even after all the independent per-item and per-tax
  // rounding above.
  const diff = totalPaise - sumPaise;
  if (diff !== 0 && result.length > 0) {
    const target = [...result].sort((a, b) => b.amountPaise - a.amountPaise)[0];
    target.amountPaise += diff;
  }

  return result.map((r) => ({ clientId: r.clientId, name: r.name, amount: fromPaise(r.amountPaise) }));
}

async function createSplitBill(req, res, next) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { orderId, people, assignments } = req.body;

    if (!orderId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }
    if (!Array.isArray(people) || people.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'At least one person is required' });
    }

    const { rows: orderRows } = await client.query(
      'SELECT id, order_number, subtotal, tax_amount, total_amount FROM orders WHERE id = $1',
      [orderId],
    );
    if (!orderRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const order = orderRows[0];

    // Idempotent: a second call for the same order returns the split that
    // already exists instead of creating a duplicate (split_bills.order_id
    // is UNIQUE, so this also protects against a race between two requests).
    const { rows: existingSplit } = await client.query('SELECT id FROM split_bills WHERE order_id = $1', [orderId]);
    if (existingSplit[0]) {
      const { rows: existingShares } = await client.query(
        'SELECT person_name AS name, amount, is_paid FROM split_bill_shares WHERE split_bill_id = $1 ORDER BY created_at ASC',
        [existingSplit[0].id],
      );
      await client.query('COMMIT');
      return res.status(200).json({
        success: true,
        data: { orderId, splitBillId: existingSplit[0].id, people: existingShares, totalAmount: Number(order.total_amount) },
        message: 'A split bill already exists for this order',
      });
    }

    const { rows: orderItems } = await client.query('SELECT id, line_total FROM order_items WHERE order_id = $1', [orderId]);
    const validItemIds = new Set(orderItems.map((i) => i.id));

    const normalizedAssignments = {};
    if (assignments && typeof assignments === 'object') {
      for (const [itemId, dinerIds] of Object.entries(assignments)) {
        if (!validItemIds.has(itemId)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: `Order item ${itemId} does not belong to order ${orderId}` });
        }
        if (!Array.isArray(dinerIds)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: `assignments["${itemId}"] must be an array of person ids` });
        }
        normalizedAssignments[itemId] = dinerIds;
      }
    }

    const normalizedPeople = people.map((p, index) => ({
      clientId: p.clientId ?? p.id ?? index,
      name: (p.name || `Person ${index + 1}`).toString().trim().slice(0, 150) || `Person ${index + 1}`,
    }));
    const knownClientIds = new Set(normalizedPeople.map((p) => p.clientId));
    for (const dinerIds of Object.values(normalizedAssignments)) {
      for (const dinerId of dinerIds) {
        if (!knownClientIds.has(dinerId)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, message: `Assignment references an unknown person id: ${dinerId}` });
        }
      }
    }

    const shares = buildShares({
      people: normalizedPeople,
      orderItems,
      assignments: normalizedAssignments,
      subtotalPaise: toPaise(order.subtotal),
      taxPaise: toPaise(order.tax_amount),
      totalPaise: toPaise(order.total_amount),
    });

    const { rows: splitRows } = await client.query(
      `INSERT INTO split_bills (order_id, people_count, total_amount) VALUES ($1, $2, $3) RETURNING id`,
      [orderId, normalizedPeople.length, order.total_amount],
    );
    const splitBillId = splitRows[0].id;

    const insertedShares = [];
    for (const share of shares) {
      const { rows } = await client.query(
        `INSERT INTO split_bill_shares (split_bill_id, person_name, amount) VALUES ($1, $2, $3) RETURNING person_name AS name, amount, is_paid`,
        [splitBillId, share.name, share.amount],
      );
      insertedShares.push(rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: { orderId, splitBillId, people: insertedShares, totalAmount: Number(order.total_amount) },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

async function getSplitBill(req, res, next) {
  try {
    const { orderId } = req.params;
    const { rows: splitRows } = await db.query('SELECT id, total_amount, people_count, created_at FROM split_bills WHERE order_id = $1', [orderId]);
    if (!splitRows[0]) {
      return res.status(404).json({ success: false, message: 'No split bill found for this order' });
    }
    const { rows: shares } = await db.query(
      'SELECT person_name AS name, amount, is_paid FROM split_bill_shares WHERE split_bill_id = $1 ORDER BY created_at ASC',
      [splitRows[0].id],
    );
    res.json({ success: true, data: { orderId, splitBillId: splitRows[0].id, totalAmount: Number(splitRows[0].total_amount), people: shares } });
  } catch (error) {
    next(error);
  }
}

module.exports = { createSplitBill, getSplitBill };
