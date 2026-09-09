import { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, Star, PackageX, ImagePlus, Leaf, X, Loader2 } from "lucide-react";
import TopBar from "../../components/TopBar";
import { useManagerMenu } from "../../hooks/useManagerMenu";
import { api, ApiError } from "../../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, "");

function emptyDraft(defaultCategoryId) {
  return {
    name: "",
    desc: "",
    price: "",
    categoryId: defaultCategoryId || "",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=480&h=340&fit=crop&auto=format",
    available: true,
    isSpecial: false,
    isVeg: false,
    variants: [{ label: "", price: "" }],
  };
}

export default function MenuManagement() {
  const { items, categories, loading, error, reload, createItem, updateItem, deleteItem, toggleSpecial } = useManagerMenu();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(() => emptyDraft());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  const categoryNames = useMemo(() => Array.from(new Set(categories.map((c) => c.name))), [categories]);
  const selectedCategory = categories.find((c) => c.id === draft.categoryId);
  const isBarCategory = selectedCategory?.menu_type === "bar";

  const filtered = items.filter((d) => {
    const matchSearch = (d.name || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || d.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openAdd = () => {
    setEditingId(null);
    setFormError("");
    setDraft(emptyDraft(categories[0]?.id));
    setShowForm(true);
  };

  const openEdit = (dish) => {
    setEditingId(dish.id);
    setFormError("");
    setDraft({
      name: dish.name,
      desc: dish.desc,
      price: dish.price,
      categoryId: dish.categoryId,
      image: dish.image,
      available: dish.available,
      isSpecial: dish.isSpecial,
      isVeg: dish.isVeg,
      variants: dish.variants.length ? dish.variants.map((v) => ({ ...v })) : [{ label: "", price: "" }],
    });
    setShowForm(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      const url = res.data.imageUrl;
      setDraft((prev) => ({ ...prev, image: url.startsWith("http") ? url : `${BACKEND_ORIGIN}${url}` }));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const addVariantRow = () => setDraft((prev) => ({ ...prev, variants: [...prev.variants, { label: "", price: "" }] }));
  const removeVariantRow = (index) => setDraft((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  const updateVariantRow = (index, field, value) =>
    setDraft((prev) => ({ ...prev, variants: prev.variants.map((v, i) => (i === index ? { ...v, [field]: value } : v)) }));

  const saveDish = async () => {
    setFormError("");
    if (!draft.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!draft.categoryId) {
      setFormError("Please choose a category.");
      return;
    }

    const payload = {
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      description: draft.desc,
      imageUrl: draft.image,
      isVeg: draft.isVeg,
      isAvailable: draft.available,
      type: isBarCategory ? "bar" : "food",
    };

    if (isBarCategory) {
      const cleanVariants = draft.variants
        .filter((v) => v.label.trim() && v.price !== "" && Number(v.price) >= 0)
        .map((v, i) => ({ label: v.label.trim(), price: Number(v.price), displayOrder: i }));
      if (cleanVariants.length === 0) {
        setFormError("Add at least one pour size (e.g. 30 ml) with a price.");
        return;
      }
      payload.variants = cleanVariants;
      payload.price = Math.min(...cleanVariants.map((v) => v.price));
    } else {
      const price = Number(draft.price);
      if (!Number.isFinite(price) || price < 0) {
        setFormError("Enter a valid price.");
        return;
      }
      payload.price = price;
    }

    setSaving(true);
    try {
      let id = editingId;
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        const created = await createItem(payload);
        id = created.id;
      }
      // Specials go through their own endpoint (todays_specials table), not
      // a column on menu_items, so it's a second call after create/update.
      await toggleSpecial(id, draft.isSpecial);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteItem(id);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not delete this item.");
    }
  };

  return (
    <div className="app-shell">
      <TopBar title="Menu Management" />
      <div className="page menu-management-page">
        <div className="search-bar">
          <input className="text-input" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ padding: "0 14px" }}>
            <Search size={16} color="var(--muted)" />
          </div>
        </div>

        <select className="text-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ marginBottom: 12, appearance: "none" }}>
          <option value="All">All Categories</option>
          {categoryNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {showForm && (
          <div className="card menu-form-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <p className="section-title">{editingId ? "Edit Item" : "Add Item"}</p>
              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setShowForm(false)} aria-label="Close">
                <X size={14} color="var(--muted)" />
              </button>
            </div>

            {formError && <p style={{ color: "var(--red, #e53935)", fontSize: 11.5, marginBottom: 8 }}>{formError}</p>}

            <div className="menu-form-grid">
              <input className="text-input" placeholder="Item name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <input className="text-input" placeholder="Description" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} />
              {!isBarCategory && (
                <input className="text-input" placeholder="Price" type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
              )}
              <select className="text-input" value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>
                <option value="" disabled>
                  Choose category
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.menu_type === "bar" ? "(Bar)" : ""}
                  </option>
                ))}
              </select>
              <label className="outline-btn" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {uploading ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
                {uploading ? "Uploading..." : "Upload Image"}
                <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
              </label>
            </div>

            {isBarCategory && (
              <div style={{ marginTop: 10 }}>
                <p className="field-label">Pour sizes (ml) &amp; price</p>
                {draft.variants.map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input
                      className="text-input"
                      placeholder="e.g. 30 ml"
                      value={v.label}
                      onChange={(e) => updateVariantRow(i, "label", e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      className="text-input"
                      placeholder="Price"
                      type="number"
                      min="0"
                      value={v.price}
                      onChange={(e) => updateVariantRow(i, "price", e.target.value)}
                      style={{ width: 90 }}
                    />
                    <button type="button" className="icon-btn" style={{ width: 36 }} onClick={() => removeVariantRow(i)} aria-label="Remove size">
                      <Trash2 size={13} color="var(--red)" />
                    </button>
                  </div>
                ))}
                <button type="button" className="outline-btn" style={{ padding: "8px 0", fontSize: 11.5 }} onClick={addVariantRow}>
                  <Plus size={13} /> Add pour size
                </button>
              </div>
            )}

            <div className="toggle-row">
              <button type="button" className={`toggle-pill ${draft.isSpecial ? "active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, isSpecial: !prev.isSpecial }))}>
                <Star size={13} /> Add to Today's Specials
              </button>
              {!isBarCategory && (
                <button type="button" className={`toggle-pill ${draft.isVeg ? "active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, isVeg: !prev.isVeg }))}>
                  <Leaf size={13} /> {draft.isVeg ? "Veg" : "Non-Veg"}
                </button>
              )}
              <button type="button" className={`toggle-pill ${draft.available ? "" : "active"}`} onClick={() => setDraft((prev) => ({ ...prev, available: !prev.available }))}>
                <PackageX size={13} /> {draft.available ? "In Stock" : "Out of Stock"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="outline-btn" style={{ flex: 1, padding: "10px 0", fontSize: 12 }} onClick={() => setShowForm(false)} disabled={saving}>
                Cancel
              </button>
              <button className="gold-btn" style={{ flex: 1, padding: "10px 0", fontSize: 12 }} onClick={saveDish} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading menu…</p>
        ) : error ? (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <p style={{ color: "var(--red, #e53935)", fontSize: 13, marginBottom: 10 }}>{error}</p>
            <button className="outline-btn" style={{ maxWidth: 140, margin: "0 auto" }} onClick={reload}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((d) => (
              <div key={d.id} className="card menu-item-card">
                <img src={d.image} alt={d.name} className="menu-item-image" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <p className="menu-item-title">{d.name}</p>
                    <span style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: 12.5, color: "var(--gold)" }}>
                      {d.variants.length > 0 ? `From ₹${Math.min(...d.variants.map((v) => v.price))}` : `₹${d.price}`}
                    </span>
                  </div>
                  <p style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{d.category}</p>
                  {d.variants.length > 0 && (
                    <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{d.variants.map((v) => `${v.label} ₹${v.price}`).join(" · ")}</p>
                  )}
                  <p style={{ fontSize: 11, color: "var(--white)", marginTop: 4, lineHeight: 1.45 }}>{d.desc}</p>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <span className={`mini-pill ${d.isSpecial ? "active" : ""}`}>
                      <Star size={10} /> Special
                    </span>
                    {d.menuType !== "bar" && (
                      <span className={`mini-pill ${d.isVeg ? "active" : ""}`}>
                        <Leaf size={10} /> {d.isVeg ? "Veg" : "Non-Veg"}
                      </span>
                    )}
                    <span className={`mini-pill ${d.available ? "" : "danger"}`}>
                      <PackageX size={10} /> {d.available ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => openEdit(d)} aria-label={`Edit ${d.name}`}>
                    <Pencil size={13} color="var(--gold)" />
                  </button>
                  <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => remove(d.id)} aria-label={`Delete ${d.name}`}>
                    <Trash2 size={13} color="var(--red)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="gold-btn"
        style={{ position: "fixed", bottom: "calc(24px + env(safe-area-inset-bottom))", width: "calc(100% - 32px)", maxWidth: 398, left: "50%", transform: "translateX(-50%)", boxShadow: "0 8px 24px rgba(212,175,55,0.35)" }}
        onClick={openAdd}
      >
        <Plus size={16} /> Add Item
      </button>
    </div>
  );
}
