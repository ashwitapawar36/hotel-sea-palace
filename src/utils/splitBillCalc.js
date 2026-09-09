// Mirrors backend/controllers/splitBillController.js's buildShares() exactly,
// so the pre-checkout preview on the Split Bill screen always matches what
// the server will actually persist once the order is placed. All money math
// is done in integer paise so that rounding never leaves the sum of every
// diner's share short of (or over) the real Grand Total.
function toPaise(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function fromPaise(paise) {
  return Math.round(paise) / 100;
}

// dishes: cart-shaped items with { id, price, qty }
// assignments: { [dishId]: dinerId[] } - an empty/missing entry means the
//   dish is shared equally by everyone (matches the "equal split" fallback
//   used server-side).
// Returns a Map<dinerId, amount> whose values always sum to exactly `grandTotal`.
export function computeDinerShares({ diners, dishes, assignments, subtotal, gst, grandTotal }) {
  const result = new Map(diners.map((d) => [d.id, 0]));
  if (diners.length === 0) return result;

  const subtotalPaise = toPaise(subtotal);
  const taxPaise = toPaise(gst);
  const totalPaise = toPaise(grandTotal);

  const sharesPaise = new Map(diners.map((d) => [d.id, 0]));

  dishes.forEach((dish) => {
    const linePaise = toPaise(dish.price * dish.qty);
    const assigned = assignments[dish.id] || [];
    const sharers = assigned.length > 0 ? assigned : diners.map((d) => d.id);
    const base = Math.floor(linePaise / sharers.length);
    let remainder = linePaise - base * sharers.length;

    sharers.forEach((dinerId) => {
      let portion = base;
      if (remainder > 0) {
        portion += 1;
        remainder -= 1;
      }
      sharesPaise.set(dinerId, (sharesPaise.get(dinerId) || 0) + portion);
    });
  });

  // Distribute GST proportionally to each diner's pre-tax share, same as the
  // backend, so the previewed total already includes their slice of GST.
  let taxRemainder = taxPaise;
  const entries = diners.map((d) => {
    const preTax = sharesPaise.get(d.id) || 0;
    const tax = subtotalPaise > 0 ? Math.floor((preTax * taxPaise) / subtotalPaise) : 0;
    return { id: d.id, preTax, tax };
  });
  entries.forEach((e) => {
    taxRemainder -= e.tax;
  });
  if (taxRemainder > 0 && entries.length > 0) {
    const biggest = [...entries].sort((a, b) => b.preTax - a.preTax)[0];
    biggest.tax += taxRemainder;
  }

  let sumPaise = 0;
  const amountsPaise = new Map();
  entries.forEach((e) => {
    const amount = e.preTax + e.tax;
    amountsPaise.set(e.id, amount);
    sumPaise += amount;
  });

  // Guarantee the sum of every diner's share equals the real Grand Total,
  // paisa for paisa, even after independent per-item/per-tax rounding above.
  const diff = totalPaise - sumPaise;
  if (diff !== 0 && entries.length > 0) {
    const targetId = [...amountsPaise.entries()].sort((a, b) => b[1] - a[1])[0][0];
    amountsPaise.set(targetId, amountsPaise.get(targetId) + diff);
  }

  amountsPaise.forEach((paise, id) => result.set(id, fromPaise(paise)));
  return result;
}
