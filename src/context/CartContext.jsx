import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useMenu } from "./MenuContext";
import { api } from "../services/api";
import {
  startOrResumeVisit,
  getVisitOrders,
  startFreshVisit,
} from "../services/visits";
import { computeDinerShares } from "../utils/splitBillCalc";

const CartContext = createContext(null);

const ACTIVE_TABLE_KEY = "sea-palace-active-table";

const CGST_RATE = 0.025;
const SGST_RATE = 0.025;
const VAT_RATE = 0.1;

function buildKey(itemId, variantId) {
  return variantId ? `${itemId}::${variantId}` : String(itemId);
}

function parseKey(key) {
  const [itemId, variantId] = String(key).split("::");
  return { itemId, variantId: variantId || null };
}

function parseTableParam(search) {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const tableParam = params.get("table");
  if (tableParam === null) return null;
  const trimmed = tableParam.trim();
  const num = parseInt(trimmed, 10);
  if (Number.isInteger(num) && String(num) === trimmed && num > 0) {
    return num;
  }
  return "invalid";
}

function getStoredTable() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(ACTIVE_TABLE_KEY);
    if (stored) {
      const num = parseInt(stored, 10);
      if (Number.isInteger(num) && num > 0) return num;
    }
  } catch {}
  return null;
}

function getStoredCart(tableNum) {
  if (!tableNum || typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(`sea-palace-cart-${tableNum}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveStoredCart(tableNum, cartData) {
  if (!tableNum || typeof window === "undefined") return;
  try {
    if (!cartData || Object.keys(cartData).length === 0) {
      window.localStorage.removeItem(`sea-palace-cart-${tableNum}`);
    } else {
      window.localStorage.setItem(`sea-palace-cart-${tableNum}`, JSON.stringify(cartData));
    }
  } catch {
    // ignore
  }
}

export function CartProvider({ children }) {
  const location = useLocation();
  const { allItems } = useMenu();

  // Initial table resolution
  const [tableNumber, setTableNumber] = useState(() => {
    const urlTable = parseTableParam(location?.search);
    if (urlTable === "invalid") return null;
    if (typeof urlTable === "number") {
      try {
        window.localStorage.setItem(ACTIVE_TABLE_KEY, String(urlTable));
      } catch {}
      return urlTable;
    }
    return getStoredTable();
  });

  // 'checking' | 'valid' | 'invalid' | 'unselected' | 'error'
  const [tableStatus, setTableStatus] = useState(() => {
    const urlTable = parseTableParam(location?.search);
    if (urlTable === "invalid") return "invalid";
    if (typeof urlTable === "number" || getStoredTable() !== null) return "checking";
    return "unselected";
  });

  const [availableTables, setAvailableTables] = useState([]);
  const [tableCheckCounter, setTableCheckCounter] = useState(0);

  // Synchronize table when URL search parameter changes
  useEffect(() => {
    const urlTable = parseTableParam(location?.search);
    if (urlTable === "invalid") {
      setTableNumber(null);
      setTableStatus("invalid");
    } else if (typeof urlTable === "number") {
      try {
        window.localStorage.setItem(ACTIVE_TABLE_KEY, String(urlTable));
      } catch {}
      if (urlTable !== tableNumber) {
        setTableNumber(urlTable);
        setTableStatus("checking");
      }
    }
  }, [location?.search, tableNumber]);

  // Demo fallback table selector action
  const selectTable = useCallback((selectedNum) => {
    const num = parseInt(selectedNum, 10);
    if (!Number.isInteger(num) || num < 1) return;
    try {
      window.localStorage.setItem(ACTIVE_TABLE_KEY, String(num));
    } catch {}
    setTableNumber(num);
    setTableStatus("valid");
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("table", String(num));
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);

  // Unsent cart is restored on refresh for this table/browser
  const [cart, setCartState] = useState(() => getStoredCart(tableNumber));
  const cartRef = useRef(cart);

  const setCart = useCallback(
  (actionOrValue) => {
    const next =
      typeof actionOrValue === "function"
        ? actionOrValue(cartRef.current)
        : actionOrValue;

    cartRef.current = next;
    saveStoredCart(tableNumber, next);
    setCartState(next);
  },
  [tableNumber]
);

  const [isSplitActive, setIsSplitActiveState] = useState(() => {
    if (!tableNumber) return false;
    try {
      return window.localStorage.getItem(`sea-palace-split-active-${tableNumber}`) === "true";
    } catch {
      return false;
    }
  });

  const setIsSplitActive = useCallback(
    (val) => {
      setIsSplitActiveState(val);
      if (!tableNumber) return;
      try {
        if (val) {
          window.localStorage.setItem(`sea-palace-split-active-${tableNumber}`, "true");
        } else {
          window.localStorage.removeItem(`sea-palace-split-active-${tableNumber}`);
        }
      } catch {}
    },
    [tableNumber]
  );

  const [diners, setDinersState] = useState(() => {
    if (tableNumber) {
      try {
        const saved = window.localStorage.getItem(`sea-palace-split-diners-${tableNumber}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [
      { id: 1, name: "You" },
      { id: 2, name: "Friend" },
    ];
  });

  const setDiners = useCallback(
    (actionOrVal) => {
      setDinersState((prev) => {
        const next = typeof actionOrVal === "function" ? actionOrVal(prev) : actionOrVal;
        if (tableNumber) {
          try {
            window.localStorage.setItem(`sea-palace-split-diners-${tableNumber}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    [tableNumber]
  );

  const [assignments, setAssignmentsState] = useState(() => {
    if (tableNumber) {
      try {
        const saved = window.localStorage.getItem(`sea-palace-split-assignments-${tableNumber}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") return parsed;
        }
      } catch {}
    }
    return {};
  });

  const setAssignments = useCallback(
    (actionOrVal) => {
      setAssignmentsState((prev) => {
        const next = typeof actionOrVal === "function" ? actionOrVal(prev) : actionOrVal;
        if (tableNumber) {
          try {
            window.localStorage.setItem(`sea-palace-split-assignments-${tableNumber}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    [tableNumber]
  );

  // Reload state when active table changes
  useEffect(() => {
    if (tableNumber) {
      const restoredCart = getStoredCart(tableNumber);
cartRef.current = restoredCart;
setCartState(restoredCart);
      try {
        setIsSplitActiveState(
          window.localStorage.getItem(`sea-palace-split-active-${tableNumber}`) === "true"
        );
        const savedDiners = window.localStorage.getItem(`sea-palace-split-diners-${tableNumber}`);
        if (savedDiners) {
          const parsed = JSON.parse(savedDiners);
          if (Array.isArray(parsed) && parsed.length > 0) setDinersState(parsed);
          else setDinersState([{ id: 1, name: "You" }, { id: 2, name: "Friend" }]);
        } else {
          setDinersState([{ id: 1, name: "You" }, { id: 2, name: "Friend" }]);
        }
        const savedAssignments = window.localStorage.getItem(
          `sea-palace-split-assignments-${tableNumber}`
        );
        if (savedAssignments) {
          setAssignmentsState(JSON.parse(savedAssignments));
        } else {
          setAssignmentsState({});
        }
      } catch {}
    } else {
      cartRef.current = {};
setCartState({});
      setIsSplitActiveState(false);
      setAssignmentsState({});
      setDinersState([
        { id: 1, name: "You" },
        { id: 2, name: "Friend" },
      ]);
    }
    setVisit(null);
    setVisitOrders([]);
    setActiveBill(null);
    setFeedback(null);
  }, [tableNumber]);

  // Visit state
  const [visit, setVisit] = useState(null);
  const [visitOrders, setVisitOrders] = useState([]);
  const [activeBill, setActiveBill] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [visitLoading, setVisitLoading] = useState(false);

  const retryTableCheck = useCallback(() => {
    setTableStatus("checking");
    setTableCheckCounter((c) => c + 1);
  }, []);

  // Check table validity against backend database
  useEffect(() => {
    let cancelled = false;

    api
      .get("/tables")
      .then((res) => {
        if (cancelled) return;
        const tables = res?.data || [];
        setAvailableTables(tables);

        if (!tableNumber) {
          setTableStatus((prev) => (prev === "invalid" ? "invalid" : "unselected"));
          return;
        }

        const exists = tables.some((t) => Number(t.table_number) === Number(tableNumber));
        setTableStatus(exists ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setTableStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [tableNumber, tableCheckCounter]);

  // Synchronize or resume visit details
  const refreshVisit = useCallback(async () => {
    if (tableStatus !== "valid" || !tableNumber) return;
    setVisitLoading(true);
    try {
      // First ensure visit session is initialized
      const visitData = await startOrResumeVisit(tableNumber);
      setVisit(visitData);

      // Now fetch full orders, active bill, and feedback
      const data = await getVisitOrders(tableNumber);
      if (data) {
        if (data.visit) setVisit(data.visit);
        if (data.orders) setVisitOrders(data.orders);
        if (data.activeBill !== undefined) setActiveBill(data.activeBill);
        if (data.feedback !== undefined) setFeedback(data.feedback);
      }
    } catch (err) {
      // If visit ended or session invalid, keep visit status reflective
      if (err?.message?.includes("ended")) {
        setVisit((prev) => (prev ? { ...prev, status: "closed" } : { status: "closed" }));
      }
    } finally {
      setVisitLoading(false);
    }
  }, [tableNumber, tableStatus]);

  useEffect(() => {
    if (tableStatus === "valid") {
      refreshVisit();
    }
  }, [tableStatus, refreshVisit]);

  const startFreshVisitSession = useCallback(async () => {
    setCart({});
    const newVisit = await startFreshVisit(tableNumber);
    setVisit(newVisit);
    setVisitOrders([]);
    setActiveBill(null);
    setFeedback(null);
    setIsSplitActive(false);
    setAssignmentsState({});
    setDinersState([
      { id: 1, name: "You" },
      { id: 2, name: "Friend" },
    ]);
    try {
      window.localStorage.removeItem(`sea-palace-split-active-${tableNumber}`);
      window.localStorage.removeItem(`sea-palace-split-diners-${tableNumber}`);
      window.localStorage.removeItem(`sea-palace-split-assignments-${tableNumber}`);
    } catch {}
    await refreshVisit();
  }, [tableNumber, setCart, refreshVisit, setIsSplitActive]);

  const [lastOrder, setLastOrderState] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem("sea-palace-last-order");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

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
  const removeSubmittedItems = (submittedItems) => {
  const next = { ...cartRef.current };

  for (const item of submittedItems) {
    const key = buildKey(item.menuItemId, item.variantId);
    const remaining =
      Number(next[key] || 0) - Number(item.quantity);

    if (remaining > 0) {
      next[key] = remaining;
    } else {
      delete next[key];
    }
  }

  setCart(next);

  return Object.values(next).some((quantity) => Number(quantity) > 0);
};


  const toggleAssignment = (dishId, dinerId) => {
    setAssignments((p) => {
      const current = p[dishId] || [];
      const next = current.includes(dinerId)
        ? current.filter((d) => d !== dinerId)
        : [...current, dinerId];
      return { ...p, [dishId]: next };
    });
    setIsSplitActive(true);
  };

  const addDiner = () => {
    const nextId = Date.now();
    setDiners((prev) => [...prev, { id: nextId, name: `Person ${prev.length + 1}` }]);
    setIsSplitActive(true);
  };

  const updateDinerName = (id, name) => {
    setDiners((prev) =>
      prev.map((diner) => (diner.id === id ? { ...diner, name } : diner))
    );
    setIsSplitActive(true);
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
    setIsSplitActive(true);
  };

  const setDishAssignments = (dishId, dinerIds) => {
    setAssignments((prev) => ({ ...prev, [dishId]: dinerIds }));
    setIsSplitActive(true);
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

  const foodSubtotal = useMemo(
    () => cartDishes.filter((d) => !d.isAlcoholic).reduce((sum, d) => sum + d.price * d.qty, 0),
    [cartDishes]
  );
  const alcoholSubtotal = useMemo(
    () => cartDishes.filter((d) => d.isAlcoholic).reduce((sum, d) => sum + d.price * d.qty, 0),
    [cartDishes]
  );
  const subtotal = foodSubtotal + alcoholSubtotal;
  const cgst = useMemo(() => Math.round(foodSubtotal * CGST_RATE * 100) / 100, [foodSubtotal]);
  const sgst = useMemo(() => Math.round(foodSubtotal * SGST_RATE * 100) / 100, [foodSubtotal]);
  const vat = useMemo(() => Math.round(alcoholSubtotal * VAT_RATE * 100) / 100, [alcoholSubtotal]);
  const taxAmount = cgst + sgst + vat;
  const grandTotal = subtotal + taxAmount;

  // --------------------------------------------------------------------------
  // SPLIT BILL: Submitted non-cancelled items & Preview calculations
  // --------------------------------------------------------------------------
  // All confirmed, non-cancelled order items in the current visit
  const submittedOrderItems = useMemo(() => {
    const items = [];
    (visitOrders || []).forEach((order) => {
      if ((order.status || "").toLowerCase() === "cancelled") return;
      (order.items || []).forEach((it) => {
        items.push({
          id: String(it.id),
          menuItemId: it.menu_item_id,
          name: it.name + (it.variant_label ? ` (${it.variant_label})` : ""),
          price: Number(it.unit_price || 0),
          qty: Number(it.quantity || 1),
          lineTotal: Number(it.line_total || Number(it.unit_price || 0) * Number(it.quantity || 1)),
          isAlcoholic: Boolean(it.is_alcoholic),
          orderNumber: order.order_number,
        });
      });
    });
    return items;
  }, [visitOrders]);

  // Dishes to split: finalized bill snapshot if available; otherwise submitted order items
  const dishesToSplit = useMemo(() => {
    if (activeBill) {
      const rawSnapshot = activeBill.items_snapshot;
      const list = Array.isArray(rawSnapshot)
        ? rawSnapshot
        : typeof rawSnapshot === "string"
          ? JSON.parse(rawSnapshot || "[]")
          : [];
      return list.map((item, idx) => ({
        id: String(item.id || item.menuItemId || `billed-${idx}`),
        menuItemId: item.menuItemId,
        name: item.name + (item.variantLabel || item.variant_label ? ` (${item.variantLabel || item.variant_label})` : ""),
        price: Number(item.unitPrice || item.unit_price || 0),
        qty: Number(item.quantity || 1),
        lineTotal: Number(item.lineTotal || item.line_total || Number(item.unitPrice || 0) * Number(item.quantity || 1)),
        isAlcoholic: Boolean(item.isAlcoholic || item.is_alcoholic),
      }));
    }
    return submittedOrderItems;
  }, [activeBill, submittedOrderItems]);

  // Prune assignments when dishes are cancelled or removed
  useEffect(() => {
    if (dishesToSplit.length === 0) return;
    const validIds = new Set(dishesToSplit.map((d) => String(d.id)));
    setAssignmentsState((prev) => {
      let changed = false;
      const next = {};
      Object.entries(prev).forEach(([id, assignedDiners]) => {
        if (validIds.has(String(id))) {
          next[id] = assignedDiners;
        } else {
          changed = true;
        }
      });
      if (changed) {
        try {
          window.localStorage.setItem(`sea-palace-split-assignments-${tableNumber}`, JSON.stringify(next));
        } catch {}
        return next;
      }
      return prev;
    });
  }, [dishesToSplit, tableNumber]);

  const splitFoodSubtotal = useMemo(() => {
    if (activeBill) return Number(activeBill.food_subtotal || 0);
    return (
      Math.round(
        dishesToSplit.filter((d) => !d.isAlcoholic).reduce((sum, d) => sum + d.lineTotal, 0) * 100
      ) / 100
    );
  }, [activeBill, dishesToSplit]);

  const splitAlcoholSubtotal = useMemo(() => {
    if (activeBill) return Number(activeBill.alcohol_subtotal || 0);
    return (
      Math.round(
        dishesToSplit.filter((d) => d.isAlcoholic).reduce((sum, d) => sum + d.lineTotal, 0) * 100
      ) / 100
    );
  }, [activeBill, dishesToSplit]);

  const splitSubtotal = useMemo(() => {
    if (activeBill) return Number(activeBill.subtotal || 0);
    return Math.round((splitFoodSubtotal + splitAlcoholSubtotal) * 100) / 100;
  }, [activeBill, splitFoodSubtotal, splitAlcoholSubtotal]);

  const splitCgst = useMemo(() => {
    if (activeBill) return Number(activeBill.cgst_amount || 0);
    return Math.round(splitFoodSubtotal * CGST_RATE * 100) / 100;
  }, [activeBill, splitFoodSubtotal]);

  const splitSgst = useMemo(() => {
    if (activeBill) return Number(activeBill.sgst_amount || 0);
    return Math.round(splitFoodSubtotal * SGST_RATE * 100) / 100;
  }, [activeBill, splitFoodSubtotal]);

  const splitVat = useMemo(() => {
    if (activeBill) return Number(activeBill.vat_amount || 0);
    return Math.round(splitAlcoholSubtotal * VAT_RATE * 100) / 100;
  }, [activeBill, splitAlcoholSubtotal]);

  const splitTaxAmount = useMemo(() => {
    if (activeBill) return Number(activeBill.tax_amount || 0);
    return Math.round((splitCgst + splitSgst + splitVat) * 100) / 100;
  }, [activeBill, splitCgst, splitSgst, splitVat]);

  const splitTotalAmount = useMemo(() => {
    if (activeBill) return Number(activeBill.total_amount || 0);
    return Math.round((splitSubtotal + splitTaxAmount) * 100) / 100;
  }, [activeBill, splitSubtotal, splitTaxAmount]);

  // Compute exact diner shares
  const splitDinerShares = useMemo(() => {
    if (dishesToSplit.length === 0 || diners.length === 0) return new Map();
    return computeDinerShares({
      diners,
      dishes: dishesToSplit,
      assignments,
      subtotal: splitSubtotal,
      gst: splitTaxAmount,
      grandTotal: splitTotalAmount,
    });
  }, [diners, dishesToSplit, assignments, splitSubtotal, splitTaxAmount, splitTotalAmount]);

  const applyEqualSplit = useCallback(() => {
    if (diners.length === 0) return;
    const next = {};
    dishesToSplit.forEach((dish) => {
      next[dish.id] = diners.map((diner) => diner.id);
    });
    setAssignments(next);
    setIsSplitActive(true);
  }, [diners, dishesToSplit, setAssignments, setIsSplitActive]);

  const resetSplit = useCallback(() => {
    setIsSplitActive(false);
    setAssignments({});
    setDiners([
      { id: 1, name: "You" },
      { id: 2, name: "Friend" },
    ]);
  }, [setIsSplitActive, setAssignments, setDiners]);

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
        removeSubmittedItems,
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
        resetSplit,
        isSplitActive,
        setIsSplitActive,
        submittedOrderItems,
        dishesToSplit,
        splitFoodSubtotal,
        splitAlcoholSubtotal,
        splitSubtotal,
        splitCgst,
        splitSgst,
        splitVat,
        splitTaxAmount,
        splitTotalAmount,
        splitDinerShares,
        tableNumber,
        tableStatus,
        hasTable: tableStatus === "valid",
        retryTableCheck,
        availableTables,
        selectTable,
        buildOrderPayload,
        lastOrder,
        setLastOrder,
        visit,
        visitOrders,
        activeBill,
        feedback,
        visitLoading,
        refreshVisit,
        startFreshVisitSession,
        isVisitClosed: visit?.status === "closed",
        isBillRequested: visit?.status === "bill_requested",
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
