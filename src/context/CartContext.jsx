import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMenu } from "./MenuContext";
import { api } from "../services/api";

const CartContext = createContext(null);

const CGST_RATE = 0.025;
const SGST_RATE = 0.025;
const VAT_RATE = 0.1;

// Item/variant ids are Postgres UUIDs (strings), not numbers - so cart keys
// must never be run through Number(). A cart entry is keyed as:
//   "<itemId>"                -> a plain food dish
//   "<itemId>::<variantId>"   -> a specific pour size of a bar item,
//                                identified by menu_item_variants.id (not
//                                its label, which isn't guaranteed unique
//                                and isn't what the order API accepts).
function buildKey(itemId, variantId) {
  return variantId ? `${itemId}::${variantId}` : String(itemId);
}

function parseKey(key) {
  const [itemId, variantId] = String(key).split("::");
  return { itemId, variantId: variantId || null };
}

// Reads the table number from the URL ONLY, at the moment the app first
// mounts. The guest has no way to change it after this - there's no
// setter exported below, no localStorage read/write, and a plain refresh
// on "/" (no ?table=) always comes back null, never a previously-seen
// table. Every customer page (Menu -> Cart -> Split Bill -> Bill) reads
// this same in-memory value from CartContext as they navigate the SPA, so
// it stays consistent for the whole visit without ever being persisted.
function readTableNumberFromUrl() {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("table");
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function CartProvider({ children }) {
  const { allItems } = useMenu();
  const [cart, setCart] = useState({});
  const [diners, setDiners] = useState([
    { id: 1, name: "You" },
    { id: 2, name: "Friend" },
  ]);
  const [assignments, setAssignments] = useState({});
  const [tableNumber] = useState(readTableNumberFromUrl);
  // 'checking' | 'valid' | 'invalid'. A table number that isn't syntactically
  // valid (missing/zero/non-integer ?table=) never even reaches this check -
  // it's 'invalid' immediately. A syntactically valid one still has to match
  // a real row in restaurant_tables before ordering is allowed.
  const [tableStatus, setTableStatus] = useState(() => (tableNumber ? "checking" : "invalid"));

  useEffect(() => {
    if (!tableNumber) {
      setTableStatus("invalid");
      return;
    }
    let cancelled = false;
    api
      .get("/tables")
      .then((res) => {
        if (cancelled) return;
        const tables = res?.data || [];
        const exists = tables.some((t) => Number(t.table_number) === tableNumber);
        setTableStatus(exists ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setTableStatus("invalid");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [lastOrder, setLastOrderState] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem("sea-palace-last-order");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Persisted so a refresh on the Order Success / Feedback screens doesn't
  // lose the tie back to the order that was just placed (feedback itself is
  // safely stored in PostgreSQL the moment it's submitted either way - this
  // is only about not losing the ability to submit it in the first place).
  const setLastOrder = (order) => {
    setLastOrderState(order);
    if (typeof window !== "undefined") {
      if (order) {
        window.localStorage.setItem("sea-palace-last-order", JSON.stringify(order));
      } else {
        window.localStorage.removeItem("sea-palace-last-order");
      }
    }
  };

  // `item` can be a dish/bar-item object (has .id), or a raw id string.
  // `variant`, when provided, is the { id, label, price } the guest picked.
  const add = (item, variant) => {
    const itemId = typeof item === "object" && item !== null ? item.id : item;
    const key = buildKey(itemId, variant ? variant.id : null);
    setCart((p) => ({ ...p, [key]: (p[key] || 0) + 1 }));
  };

  const remove = (key) =>
    setCart((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });

  const setQty = (key, qty) =>
    setCart((p) => {
      if (qty <= 0) {
        const next = { ...p };
        delete next[key];
        return next;
      }
      return { ...p, [key]: qty };
    });

  const clear = () => setCart({});

  const toggleAssignment = (dishId, dinerId) =>
    setAssignments((p) => {
      const current = p[dishId] || [];
      const next = current.includes(dinerId)
        ? current.filter((d) => d !== dinerId)
        : [...current, dinerId];
      return { ...p, [dishId]: next };
    });

  const addDiner = () => {
    const nextId = Date.now();
    setDiners((prev) => [...prev, { id: nextId, name: `Person ${prev.length + 1}` }]);
  };

  const updateDinerName = (id, name) => {
  setDiners((prev) =>
    prev.map((diner) =>
      diner.id === id ? { ...diner, name } : diner
    )
  );
};

  const removeDiner = (id) => {
    setDiners((prev) => prev.filter((diner) => diner.id !== id));
    setAssignments((prev) => {
      const next = {};
      Object.entries(prev).forEach(([dishId, dinersForDish]) => {
        next[dishId] = dinersForDish.filter((dinerId) => dinerId !== id);
      });
      return next;
    });
  };

  const setDishAssignments = (dishId, dinerIds) => {
    setAssignments((prev) => ({ ...prev, [dishId]: dinerIds }));
  };

  const applyEqualSplit = () => {
    if (diners.length === 0) return;
    const next = {};
    cartDishes.forEach((dish) => {
      next[dish.id] = diners.map((diner) => diner.id);
    });
    setAssignments(next);
  };

  const cartDishes = useMemo(
    () =>
      Object.entries(cart)
        .map(([key, qty]) => {
          const { itemId, variantId } = parseKey(key);
          const item = allItems.find((d) => d.id === itemId);
          if (!item) return null;

          if (variantId) {
            const variant = (item.variants || []).find((v) => v.id === variantId);
            if (!variant) return null;
            return {
              ...item,
              id: key,
              itemId: item.id,
              variantId: variant.id,
              name: `${item.name} (${variant.label})`,
              price: variant.price,
              variantLabel: variant.label,
              available: item.available !== false,
              qty,
            };
          }

          return { ...item, id: key, itemId: item.id, variantId: null, qty };
        })
        .filter(Boolean),
    [cart, allItems]
  );

  const cartCount = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);

  // Split by tax treatment, same rule the backend applies when the order is
  // actually placed (orderController.js): CGST+SGST only ever apply to the
  // non-alcoholic subtotal, VAT only ever applies to the alcoholic one. This
  // is only a client-side preview - the backend recalculates all of it from
  // scratch and is the only thing that's ever billed.
  const foodSubtotal = useMemo(() => cartDishes.filter((d) => !d.isAlcoholic).reduce((sum, d) => sum + d.price * d.qty, 0), [cartDishes]);
  const alcoholSubtotal = useMemo(() => cartDishes.filter((d) => d.isAlcoholic).reduce((sum, d) => sum + d.price * d.qty, 0), [cartDishes]);
  const subtotal = foodSubtotal + alcoholSubtotal;
  const cgst = useMemo(() => Math.round(foodSubtotal * CGST_RATE * 100) / 100, [foodSubtotal]);
  const sgst = useMemo(() => Math.round(foodSubtotal * SGST_RATE * 100) / 100, [foodSubtotal]);
  const vat = useMemo(() => Math.round(alcoholSubtotal * VAT_RATE * 100) / 100, [alcoholSubtotal]);
  const taxAmount = cgst + sgst + vat;
  const grandTotal = subtotal + taxAmount;

  // Builds the payload the order API expects - menuItemId/variantId/quantity
  // only. Price is intentionally NOT sent: the backend always recalculates
  // it from the database, so nothing here is trusted for billing.
  const buildOrderPayload = ({ customerName, notes } = {}) => ({
    tableNumber,
    customerName,
    notes,
    items: cartDishes.map((d) => ({
      menuItemId: d.itemId,
      variantId: d.variantId || undefined,
      quantity: d.qty,
    })),
  });

  return (
    <CartContext.Provider
      value={{
        cart,
        add,
        remove,
        setQty,
        clear,
        cartCount,
        cartDishes,
        subtotal,
        foodSubtotal,
        alcoholSubtotal,
        cgst,
        sgst,
        vat,
        taxAmount,
        grandTotal,
        diners,
        setDiners,
        assignments,
        toggleAssignment,
        addDiner,
        updateDinerName,
        removeDiner,
        setDishAssignments,
        applyEqualSplit,
        tableNumber,
        // No setter is exposed on purpose - the table number comes from the
        // QR-scanned URL only (see readTableNumberFromUrl above) and the
        // guest has no in-app way to change it. hasTable reflects both a
        // syntactically valid number AND a confirmed match against a real
        // restaurant_tables row; hasTable === false while tableStatus is
        // still 'checking' so nothing renders as orderable before that
        // check resolves.
        tableStatus,
        hasTable: tableStatus === "valid",
        buildOrderPayload,
        lastOrder,
        setLastOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
