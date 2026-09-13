import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api, ApiError } from "../services/api";

const MenuContext = createContext(null);

const INITIAL_STATE = {
  foodItems: [],
  barItems: [],
  foodCategories: [],
  barCategories: [],
  categoryDetails: [],
  popularItems: [],
};

const GROUP_ORDER = {
  vegetarian: 1,
  "non-vegetarian": 2,
  common: 3,
};

function normalizeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    menuType: row.menu_type,
    foodGroup:
      row.menu_type === "food" ? row.food_group || null : null,
    displayOrder: Number(row.display_order ?? 0),
    isActive: row.is_active !== false,
  };
}

function sortCategories(a, b) {
  if (a.menuType !== b.menuType) {
    return a.menuType === "food" ? -1 : 1;
  }

  if (a.menuType === "food") {
    const groupDifference =
      (GROUP_ORDER[a.foodGroup] ?? 4) -
      (GROUP_ORDER[b.foodGroup] ?? 4);

    if (groupDifference !== 0) return groupDifference;
  }

  return (
    a.displayOrder - b.displayOrder ||
    a.name.localeCompare(b.name)
  );
}

// Keep the original food-item shape used by DishCard,
// Home and Cart. Group membership comes from the database.
function normalizeFoodItem(row) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description || "",
    price: Number(row.price),
    image: row.image_url || null,
    image_url: row.image_url || null,
    imageUrl: row.image_url || null,

    categoryId: row.category_id,
    category: row.category_name,
    categorySlug: row.category_slug,
    categoryOrder: Number(row.category_display_order ?? 0),

    menuType: "food",
    foodGroup: row.food_group || null,

    available:
      row.is_available !== false &&
      row.category_is_active !== false,

    isSpecial: Boolean(row.is_special),
    isVeg: Boolean(row.is_veg),
    isAlcoholic: Boolean(row.is_alcoholic),

    preparationTimeMinutes: Number(
      row.preparation_time_minutes ?? 15
    ),

    totalQuantity: Number(row.total_quantity ?? 0),
  };
}

function normalizeBarItem(row) {
  const variants = (row.variants || [])
    .map((variant, index) => ({
      id: variant.id,
      label: variant.label,
      price: Number(variant.price),
      displayOrder: Number(
        variant.display_order ??
          variant.displayOrder ??
          index
      ),
    }))
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.price - b.price
    );

  return {
    id: row.id,
    name: row.name,
    desc: row.description || "",
    image: row.image_url || null,
    image_url: row.image_url || null,
    imageUrl: row.image_url || null,
    price: Number(row.price),

    categoryId: row.category_id,
    category: row.category_name,
    categorySlug: row.category_slug,
    categoryOrder: Number(row.category_display_order ?? 0),

    menuType: "bar",
    foodGroup: null,

    available:
      row.is_available !== false &&
      row.category_is_active !== false,

    isSpecial: Boolean(row.is_special),
    isVeg: Boolean(row.is_veg),

    // Bar includes non-alcoholic drinks too.
    isAlcoholic: Boolean(row.is_alcoholic),

    // Preserve database IDs for order submission.
    variants,
  };
}

export function MenuProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Prevent an older request from overwriting a newer reload.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const [foodRes, barRes, categoryRes, popularRes] =
        await Promise.all([
          api.get("/menu/items?type=food"),
          api.get("/menu/items?type=bar"),
          api.get("/menu/categories"),
          api.get("/menu/popular"),
        ]);

      if (requestId !== requestIdRef.current) return;

      const categoryDetails = (categoryRes?.data || [])
        .map(normalizeCategory)
        .filter((category) => category.isActive)
        .sort(sortCategories);

      setState({
        foodItems: (foodRes?.data || []).map(
          normalizeFoodItem
        ),

        barItems: (barRes?.data || []).map(
          normalizeBarItem
        ),

        // Keep these as name arrays for existing consumers.
        foodCategories: categoryDetails
          .filter((category) => category.menuType === "food")
          .map((category) => category.name),

        barCategories: categoryDetails
          .filter((category) => category.menuType === "bar")
          .map((category) => category.name),

        // Full category metadata for the updated menu page.
        categoryDetails,

        // Popularity still comes from actual order history.
        popularItems: (popularRes?.data || []).map(
          normalizeFoodItem
        ),
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load the menu. Please try again."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();

    return () => {
      // Ignore pending responses after cleanup.
      requestIdRef.current += 1;
    };
  }, [load]);

  const value = useMemo(
    () => ({
      ...state,

      allItems: [...state.foodItems, ...state.barItems],

      vegItems: state.foodItems.filter(
        (item) => item.foodGroup === "vegetarian"
      ),

      nonVegItems: state.foodItems.filter(
        (item) => item.foodGroup === "non-vegetarian"
      ),

      commonItems: state.foodItems.filter(
        (item) => item.foodGroup === "common"
      ),

      loading,
      error,
      reload: load,
    }),
    [state, loading, error, load]
  );

  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);

  if (!context) {
    throw new Error(
      "useMenu must be used within MenuProvider"
    );
  }

  return context;
}