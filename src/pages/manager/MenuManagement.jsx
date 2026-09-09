import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ImagePlus,
  X,
  Loader2,
} from "lucide-react";

import TopBar from "../../components/TopBar";
import { useManagerMenu } from "../../hooks/useManagerMenu";
import { api, ApiError } from "../../services/api";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const SECTIONS = [
  { key: "vegetarian", label: "Veg" },
  { key: "non-vegetarian", label: "Non-Veg" },
  { key: "common", label: "Snacks & Sides" },
  { key: "bar", label: "Bar" },
];

function categorySection(category) {
  if (category?.menu_type === "bar") return "bar";
  return category?.food_group || "unassigned";
}

function imageUrl(value) {
  if (!value) return "";
  if (value.startsWith("/uploads/")) {
    return `${BACKEND_ORIGIN}${value}`;
  }
  return value;
}

function emptyDraft(section = "vegetarian", categoryId = "") {
  return {
    section,
    categoryId,
    name: "",
    desc: "",
    price: "",
    image: "",
    available: true,
    isSpecial: false,
    isVeg: section !== "non-vegetarian",
    isAlcoholic: false,
    variants: [],
  };
}

function message(error, fallback) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function MenuManagement() {
  const {
    items,
    categories,
    loading,
    error,
    reload,
    createItem,
    updateItem,
    deleteItem,
    toggleSpecial,
    toggleAvailability,
  } = useManagerMenu();

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [originalType, setOriginalType] = useState(null);
  const [originalSpecial, setOriginalSpecial] = useState(false);

  const [draft, setDraft] = useState(() => emptyDraft());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const busy = saving || uploading;
  const isBar = draft.section === "bar";

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filterCategories = categories.filter(
    (c) =>
      sectionFilter === "all" ||
      categorySection(c) === sectionFilter
  );

  const formCategories = categories.filter(
    (c) => categorySection(c) === draft.section
  );

  const filtered = items.filter((item) => {
    const category = categoryMap.get(item.categoryId);

    const section =
      categorySection(category) !== "unassigned"
        ? categorySection(category)
        : item.menuType === "bar"
          ? "bar"
          : item.foodGroup || "unassigned";

    return (
      item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (sectionFilter === "all" || section === sectionFilter) &&
      (categoryFilter === "all" || item.categoryId === categoryFilter)
    );
  });

  const setField = (key, value) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const openAdd = () => {
    const section =
      sectionFilter === "all" ? "vegetarian" : sectionFilter;
    const category = categories.find(
      (c) => categorySection(c) === section
    );

    setEditingId(null);
    setOriginalType(null);
    setOriginalSpecial(false);
    setFormError("");
    setDraft(emptyDraft(section, category?.id || ""));
    setShowForm(true);
  };

  const openEdit = (item) => {
    const category = categoryMap.get(item.categoryId);
    const section =
      item.menuType === "bar"
        ? "bar"
        : category?.food_group || item.foodGroup || "common";

    setEditingId(item.id);
    setOriginalType(item.menuType);
    setOriginalSpecial(item.isSpecial);
    setFormError("");

    setDraft({
      section,
      categoryId: item.categoryId,
      name: item.name,
      desc: item.desc || "",
      price: item.price,
      image: item.image || "",
      available: item.available,
      isSpecial: item.isSpecial,
      isVeg: item.isVeg,
      isAlcoholic: item.isAlcoholic,
      variants: (item.variants || []).map((v) => ({ ...v })),
    });

    setShowForm(true);
  };

  const changeDraftSection = (section) => {
    const category = categories.find(
      (c) => categorySection(c) === section
    );

    setDraft((previous) => ({
      ...previous,
      section,
      categoryId: category?.id || "",
      isVeg:
        section === "vegetarian"
          ? true
          : section === "non-vegetarian"
            ? false
            : previous.isVeg,
      isAlcoholic:
        section === "bar" ? previous.isAlcoholic : false,
    }));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFormError("");
    setUploading(true);

    try {
      const response = await api.uploadImage(file);
      setField("image", response.data.imageUrl);
    } catch (err) {
      setFormError(message(err, "Image upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const updateVariant = (index, field, value) => {
    setDraft((previous) => ({
      ...previous,
      variants: previous.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const saveDish = async (event) => {
    event.preventDefault();
    setFormError("");

    const category = categoryMap.get(draft.categoryId);

    if (!draft.name.trim()) {
      setFormError("Enter an item name.");
      return;
    }

    if (!category || categorySection(category) !== draft.section) {
      setFormError("Choose a category from the selected section.");
      return;
    }

    const payload = {
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      description: draft.desc,
      imageUrl: draft.image,
      isAvailable: draft.available,
      isVeg:
        draft.section === "vegetarian"
          ? true
          : draft.section === "non-vegetarian"
            ? false
            : draft.isVeg,
      isAlcoholic: isBar ? draft.isAlcoholic : false,
      type: isBar ? "bar" : "food",
    };

    if (isBar) {
      if (!draft.variants.length) {
        setFormError("Add at least one serving size and price.");
        return;
      }

      const labels = new Set();
      const variants = [];

      for (const [index, variant] of draft.variants.entries()) {
        const label = variant.label.trim();
        const price = Number(variant.price);

        if (
          !label ||
          String(variant.price).trim() === "" ||
          !Number.isFinite(price) ||
          price < 0
        ) {
          setFormError("Every serving size needs a label and valid price.");
          return;
        }

        if (labels.has(label.toLowerCase())) {
          setFormError("Serving labels must be unique.");
          return;
        }

        labels.add(label.toLowerCase());

        variants.push({
          ...(variant.id ? { id: variant.id } : {}),
          label,
          price,
          displayOrder: index,
        });
      }

      payload.variants = variants;
      payload.price = Math.min(...variants.map((v) => v.price));
    } else {
      const price = Number(draft.price);

      if (
        String(draft.price).trim() === "" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        setFormError("Enter a valid price.");
        return;
      }

      payload.price = price;
    }

    setSaving(true);
    let itemSaved = false;

    try {
      let id = editingId;
      let savedItem;

      if (id) {
        savedItem = await updateItem(id, payload);
      } else {
        savedItem = await createItem(payload);
        id = savedItem.id;

        // A failed special update must not create another item on retry.
        setEditingId(id);
        setOriginalType(payload.type);
      }

      itemSaved = true;

      // Keep newly generated variant IDs for retries.
      if (Array.isArray(savedItem.variants)) {
        setDraft((previous) => ({
          ...previous,
          variants: savedItem.variants.map((v) => ({
            id: v.id,
            label: v.label,
            price: Number(v.price),
          })),
        }));
      }

      if (draft.isSpecial !== originalSpecial) {
        await toggleSpecial(id, draft.isSpecial);
        setOriginalSpecial(draft.isSpecial);
      }

      setShowForm(false);
    } catch (err) {
      setFormError(
        (itemSaved ? "Item saved, but the special status failed. " : "") +
          message(err, "Could not finish saving. Please try again.")
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (item, action) => {
    setBusyId(item.id);
    setActionError("");

    try {
      await action();
    } catch (err) {
      setActionError(message(err, "Could not update this item."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="app-shell">
      <TopBar title="Menu Management" />

      <div
        className="page menu-management-page"
        style={{ paddingBottom: 110 }}
      >
        <div className="search-bar">
          <input
            className="text-input"
            aria-label="Search items"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search
            size={16}
            color="var(--muted)"
            style={{ margin: "0 14px" }}
          />
        </div>

        <div
          className="chip-row"
          role="group"
          aria-label="Menu section filters"
          style={{ marginBottom: 12 }}
        >
          {[{ key: "all", label: "All" }, ...SECTIONS].map((section) => (
            <button
              type="button"
              key={section.key}
              className={`chip ${sectionFilter === section.key ? "active" : ""}`}
              aria-pressed={sectionFilter === section.key}
              onClick={() => {
                setSectionFilter(section.key);
                setCategoryFilter("all");
              }}
            >
              {section.label}
            </button>
          ))}
        </div>

        <select
          className="text-input"
          aria-label="Filter category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ marginBottom: 12 }}
        >
          <option value="all">All Categories</option>
          {filterCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {actionError && (
          <p role="alert" style={{ color: "var(--red)", fontSize: 13 }}>
            {actionError}
          </p>
        )}

        {showForm && (
          <form
            className="card menu-form-card"
            onSubmit={saveDish}
          >
            <fieldset
              disabled={busy}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <p className="section-title">
                  {editingId ? "Edit Item" : "Add Item"}
                </p>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Close form"
                  onClick={() => setShowForm(false)}
                >
                  <X size={16} />
                </button>
              </div>

              {formError && (
                <p
                  role="alert"
                  style={{ color: "var(--red)", fontSize: 13 }}
                >
                  {formError}
                </p>
              )}

              <div className="menu-form-grid">
                <label>
                  <span className="field-label">Section</span>
                  <select
                    className="text-input"
                    value={draft.section}
                    onChange={(e) => changeDraftSection(e.target.value)}
                  >
                    {SECTIONS.map((section) => (
                      <option
                        key={section.key}
                        value={section.key}
                        disabled={
                          Boolean(editingId) &&
                          ((originalType === "bar") !==
                            (section.key === "bar"))
                        }
                      >
                        {section.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="field-label">Category</span>
                  <select
                    className="text-input"
                    value={draft.categoryId}
                    onChange={(e) => setField("categoryId", e.target.value)}
                    required
                  >
                    <option value="">Choose category</option>
                    {formCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="field-label">Item name</span>
                  <input
                    className="text-input"
                    value={draft.name}
                    maxLength={150}
                    onChange={(e) => setField("name", e.target.value)}
                    required
                  />
                </label>

                <label>
                  <span className="field-label">Description</span>
                  <input
                    className="text-input"
                    value={draft.desc}
                    onChange={(e) => setField("desc", e.target.value)}
                  />
                </label>

                {!isBar && (
                  <label>
                    <span className="field-label">Price (₹)</span>
                    <input
                      className="text-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.price}
                      onChange={(e) => setField("price", e.target.value)}
                      required
                    />
                  </label>
                )}

                <label>
                  <span className="field-label">Image URL</span>
                  <input
                    className="text-input"
                    value={draft.image}
                    onChange={(e) => setField("image", e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <label className="outline-btn" style={{ cursor: "pointer" }}>
                  {uploading ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <ImagePlus size={14} />
                  )}
                  {uploading ? " Uploading..." : " Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImageUpload}
                  />
                </label>
              </div>

              {isBar && (
                <div style={{ marginTop: 14 }}>
                  <p className="field-label">Serving sizes and prices</p>

                  {draft.variants.map((variant, index) => (
                    <div
                      key={variant.id || `new-${index}`}
                      style={{ display: "flex", gap: 6, marginBottom: 8 }}
                    >
                      <input
                        className="text-input"
                        aria-label={`Serving ${index + 1}`}
                        placeholder="30 ml, 650 ml, Serving..."
                        value={variant.label}
                        maxLength={50}
                        onChange={(e) =>
                          updateVariant(index, "label", e.target.value)
                        }
                        style={{ flex: 1, minWidth: 0 }}
                        required
                      />
                      <input
                        className="text-input"
                        aria-label={`Price for serving ${index + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="₹"
                        value={variant.price}
                        onChange={(e) =>
                          updateVariant(index, "price", e.target.value)
                        }
                        style={{ width: 90 }}
                        required
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove serving ${index + 1}`}
                        onClick={() =>
                          setField(
                            "variants",
                            draft.variants.filter((_, i) => i !== index)
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() =>
                      setField("variants", [
                        ...draft.variants,
                        { label: "", price: "" },
                      ])
                    }
                  >
                    <Plus size={14} /> Add serving size
                  </button>

                  <p style={{ color: "var(--muted)", fontSize: 12 }}>
                    Sizes used in previous orders cannot be removed or renamed.
                    Their prices can be updated.
                  </p>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                  marginTop: 16,
                  fontSize: 13,
                }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={draft.available}
                    onChange={(e) => setField("available", e.target.checked)}
                  />{" "}
                  In stock
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={draft.isSpecial}
                    onChange={(e) => setField("isSpecial", e.target.checked)}
                  />{" "}
                  Today’s Special
                </label>

                {draft.section === "common" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.isVeg}
                      onChange={(e) => setField("isVeg", e.target.checked)}
                    />{" "}
                    Vegetarian
                  </label>
                )}

                {isBar && (
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.isAlcoholic}
                      onChange={(e) =>
                        setField("isAlcoholic", e.target.checked)
                      }
                    />{" "}
                    Alcoholic
                  </label>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => setShowForm(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button type="submit" className="gold-btn" style={{ flex: 1 }}>
                  {saving ? "Saving..." : "Save Item"}
                </button>
              </div>
            </fieldset>
          </form>
        )}

        {loading ? (
          <p role="status">Loading menu…</p>
        ) : error ? (
          <div role="alert">
            <p style={{ color: "var(--red)" }}>{error}</p>
            <button
              type="button"
              className="outline-btn"
              onClick={() => reload()}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--muted)", textAlign: "center" }}>
            No items match these filters.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((item) => {
              const variants = item.variants || [];

              return (
                <div key={item.id} className="card menu-item-card">
                  {item.image && (
                    <img
                      src={imageUrl(item.image)}
                      alt={item.name}
                      className="menu-item-image"
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="menu-item-title">{item.name}</p>

                    <p style={{ color: "var(--gold)", fontWeight: 700 }}>
                      {variants.length
                        ? `From ₹${Math.min(...variants.map((v) => v.price))}`
                        : `₹${item.price}`}
                    </p>

                    <p style={{ color: "var(--muted)", fontSize: 12 }}>
                      {item.category}
                    </p>

                    {variants.length > 0 && (
                      <p style={{ color: "var(--muted)", fontSize: 11 }}>
                        {variants
                          .map((v) => `${v.label} ₹${v.price}`)
                          .join(" · ")}
                      </p>
                    )}

                    <p style={{ fontSize: 12 }}>{item.desc}</p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.isSpecial && (
                        <span className="mini-pill active">Special</span>
                      )}
                      <span className="mini-pill">
                        {item.menuType === "bar"
                          ? item.isAlcoholic
                            ? "Alcoholic"
                            : "Non-alcoholic"
                          : item.isVeg
                            ? "Veg"
                            : "Non-Veg"}
                      </span>
                      <span className={`mini-pill ${item.available ? "" : "danger"}`}>
                        {item.available ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="outline-btn"
                      style={{ marginTop: 10, fontSize: 12 }}
                      disabled={busyId !== null || showForm}
                      onClick={() =>
                        runAction(item, () =>
                          toggleAvailability(item.id, !item.available)
                        )
                      }
                    >
                      {item.available ? "Mark unavailable" : "Mark available"}
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={showForm || busyId !== null}
                      aria-label={`Edit ${item.name}`}
                      onClick={() => openEdit(item)}
                    >
                      <Pencil size={15} color="var(--gold)" />
                    </button>

                    <button
                      type="button"
                      className="icon-btn"
                      disabled={showForm || busyId !== null}
                      aria-label={`Delete ${item.name}`}
                      onClick={() => {
                        if (window.confirm(`Delete "${item.name}"?`)) {
                          runAction(item, () => deleteItem(item.id));
                        }
                      }}
                    >
                      <Trash2 size={15} color="var(--red)" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!showForm && (
        <button
          type="button"
          className="gold-btn"
          disabled={loading || Boolean(error) || busyId !== null}
          onClick={openAdd}
          style={{
            position: "fixed",
            bottom: "calc(24px + env(safe-area-inset-bottom))",
            width: "calc(100% - 32px)",
            maxWidth: 398,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <Plus size={16} /> Add Item
        </button>
      )}
    </div>
  );
}