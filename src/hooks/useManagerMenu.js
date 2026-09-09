import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../services/api";

function normalizeItem(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    desc: row.description || "",
    price: Number(row.price),
    image: row.image_url,
    category: row.category_name,
    menuType: row.menu_type,
    foodGroup: row.food_group || null,
    available: row.is_available !== false,
    isSpecial: Boolean(row.is_special),
    isVeg: Boolean(row.is_veg),
    isAlcoholic: Boolean(row.is_alcoholic),
    variants: (row.variants || []).map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: Number(variant.price),
      displayOrder: Number(variant.display_order ?? 0),
    })),
  };
}

// Manager-only counterpart to MenuContext: this always asks for every item
// (including currently-unavailable ones, via ?all=true which the backend
// only honors for an authenticated manager) and exposes the mutation
// endpoints so MenuManagement/SpecialsManagement/StockManagement all read
// and write the same PostgreSQL-backed source of truth instead of the old
// static menuData.js.
export function useManagerMenu() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, catRes] = await Promise.all([
        api.get("/menu/items?type=all&all=true", { auth: true }),
        api.get("/menu/categories"),
      ]);
      setItems((itemsRes?.data || []).map(normalizeItem));
      setCategories(catRes?.data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the menu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createItem = useCallback(
    async (payload) => {
      const res = await api.post("/menu/items", payload, { auth: true });
      await load();
      return res.data;
    },
    [load]
  );

  const updateItem = useCallback(
    async (id, payload) => {
      const res = await api.put(`/menu/items/${id}`, payload, { auth: true });
      await load();
      return res.data;
    },
    [load]
  );

  const deleteItem = useCallback(
    async (id) => {
      await api.delete(`/menu/items/${id}`, { auth: true });
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    []
  );

  const toggleSpecial = useCallback(async (id, isSpecial) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isSpecial } : i)));
    try {
      await api.patch(`/menu/items/${id}/special`, { isSpecial }, { auth: true });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isSpecial: !isSpecial } : i)));
      throw err;
    }
  }, []);

  const toggleAvailability = useCallback(async (id, available) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, available } : i)));
    try {
      await api.put(`/menu/items/${id}`, { isAvailable: available }, { auth: true });
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, available: !available } : i)));
      throw err;
    }
  }, []);

  return { items, categories, loading, error, reload: load, createItem, updateItem, deleteItem, toggleSpecial, toggleAvailability };
}
