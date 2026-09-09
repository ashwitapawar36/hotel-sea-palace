import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../services/api";

const MenuContext = createContext(null);

// Fallback categories shown while the network request is in flight so the
// chip row doesn't jump around; overwritten as soon as real data arrives.
const FALLBACK_STATE = {
  foodItems: [],
  barItems: [],
  foodCategories: [],
  barCategories: [],
  popularItems: [],
};

export function MenuProvider({ children }) {
  const [state, setState] = useState(FALLBACK_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [foodRes, barRes, catRes, popularRes] = await Promise.all([
        api.get("/menu/items?type=food"),
        api.get("/menu/items?type=bar"),
        api.get("/menu/categories"),
        api.get("/menu/popular"),
      ]);

      const categories = catRes?.data || [];

      setState({
        foodItems: (foodRes?.data || []).map(normalizeFoodItem),
        barItems: (barRes?.data || []).map(normalizeBarItem),
        foodCategories: categories.filter((c) => c.menu_type === "food").map((c) => c.name),
        barCategories: categories.filter((c) => c.menu_type === "bar").map((c) => c.name),
        // Real order-history popularity (total quantity sold, cancelled
        // orders excluded) - see GET /api/menu/popular. Empty when there's
        // no order history yet; the Home page shows a recommended state then.
        popularItems: (popularRes?.data || []).map(normalizeFoodItem),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the menu. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      allItems: [...state.foodItems, ...state.barItems],
      loading,
      error,
      reload: load,
    }),
    [state, loading, error]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

// The backend returns snake_case Postgres rows; the rest of the app (DishCard,
// Menu, Home, Cart) expects the shape the old static menuData.js used, so we
// translate once here rather than sprinkling `mi.image_url` vs `dish.image`
// everywhere.
function normalizeFoodItem(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description,
    price: Number(row.price),
    image: row.image_url,
    category: row.category_name,
    // 'vegetarian' | 'non-vegetarian' - the parent section a Food category
    // belongs to (menu_categories.food_group). Always null for Bar items.
    foodGroup: row.food_group || null,
    categoryOrder: row.category_display_order ?? 0,
    available: row.is_available !== false,
    isSpecial: !!row.is_special,
    isVeg: !!row.is_veg,
    // Food items are never alcoholic, but this is read straight off the
    // row (not assumed) so cartDishes/tax math always has a real value to
    // spread onto every cart line, regardless of item type.
    isAlcoholic: !!row.is_alcoholic,
  };
}

function normalizeBarItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category_name,
    image: row.image_url,
    available: row.is_available !== false,
    desc: row.description,
    // Not every Bar-menu item is alcohol (Cold Drinks & Others, Solkadhi,
    // Buttermilk, etc.) - this is the authoritative per-item flag used to
    // split CGST+SGST vs VAT everywhere tax is previewed client-side.
    isAlcoholic: !!row.is_alcoholic,
    // Each variant keeps its own DB id (menu_item_variants.id) - this is
    // what gets sent to the order API, never the label.
    variants: (row.variants || []).map((v) => ({ id: v.id, label: v.label, price: Number(v.price) })),
  };
}

export function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used within MenuProvider");
  return ctx;
}
