import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingCart,
  Loader2,
  UtensilsCrossed,
  Wine,
} from "lucide-react";

import DishCard from "../components/DishCard";
import NavDrawer from "../components/NavDrawer";
import { useCart } from "../context/CartContext";
import { useMenu } from "../context/MenuContext";

const SECTIONS = [
  {
    key: "vegetarian",
    label: "Veg",
    icon: UtensilsCrossed,
  },
  {
    key: "non-vegetarian",
    label: "Non-Veg",
    icon: UtensilsCrossed,
  },
  {
    key: "common",
    label: "Snacks & Sides",
    icon: UtensilsCrossed,
  },
  {
    key: "bar",
    label: "Bar",
    icon: Wine,
  },
];

// Only display labels change here.
// Database category IDs, names and slugs remain unchanged.
function categoryLabel(category) {
  switch (category.slug) {
    case "veg-biryani":
    case "non-veg-biryani":
      return "Biryani";

    case "veg-thali":
    case "non-veg-thali":
      return "Try Our Thali’s";

    default:
      return category.name;
  }
}

function itemCategoryKey(item) {
  return String(
    item.categoryId ||
      item.categorySlug ||
      item.category ||
      "uncategorized"
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 155px), 1fr))",
    gap: 10,
  },

  heading: {
    fontFamily: "Poppins, sans-serif",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--white)",
    margin: 0,
  },

  empty: {
    color: "var(--muted)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 36,
  },
};

function DishGrid({ items }) {
  return (
    <div style={styles.grid}>
      {items.map((dish) => (
        <DishCard key={dish.id} dish={dish} />
      ))}
    </div>
  );
}

export default function Menu() {
  const navigate = useNavigate();
  const { cartCount, tableNumber } = useCart();

  const {
    foodItems,
    barItems,
    categoryDetails = [],
    loading,
    error,
    reload,
  } = useMenu();

  const [section, setSection] = useState("vegetarian");
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const isBar = section === "bar";
  const currentSection = SECTIONS.find(
    (entry) => entry.key === section
  );

  const sectionItems = useMemo(() => {
    const items = isBar
      ? barItems
      : foodItems.filter(
          (item) => item.foodGroup === section
        );

    return items.filter(
      (item) => item.available !== false
    );
  }, [foodItems, barItems, isBar, section]);

  // Group dishes by actual category ID.
  // Use the same hierarchy for food and bar.
  const categories = useMemo(() => {
    const metadata = new Map(
      categoryDetails.map((category) => [
        String(category.id),
        category,
      ])
    );

    const grouped = new Map();

    sectionItems.forEach((item) => {
      const key = itemCategoryKey(item);
      const category = metadata.get(key);

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          name:
            category?.name ||
            item.category ||
            "Other",
          slug:
            category?.slug ||
            item.categorySlug ||
            "",
          order: Number(
            category?.displayOrder ??
              item.categoryOrder ??
              0
          ),
          items: [],
        });
      }

      grouped.get(key).items.push(item);
    });

    return [...grouped.values()].sort(
      (a, b) =>
        a.order - b.order ||
        a.name.localeCompare(b.name)
    );
  }, [sectionItems, categoryDetails]);

  // If a reload removes the selected category, show all.
  const selectedCategory =
    activeCategory === "all" ||
    categories.some(
      (category) => category.key === activeCategory
    )
      ? activeCategory
      : "all";

  const visibleCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    return categories
      .filter(
        (category) =>
          selectedCategory === "all" ||
          category.key === selectedCategory
      )
      .map((category) => {
        const matchesCategory =
          category.name.toLowerCase().includes(query) ||
          categoryLabel(category)
            .toLowerCase()
            .includes(query);

        return {
          ...category,
          items: category.items.filter(
            (item) =>
              !query ||
              matchesCategory ||
              item.name.toLowerCase().includes(query)
          ),
        };
      })
      .filter((category) => category.items.length > 0);
  }, [categories, selectedCategory, search]);

  const visibleCount = visibleCategories.reduce(
    (total, category) => total + category.items.length,
    0
  );

  // Promotional copies stay inside the selected food tab.
  // Each dish also remains in its normal category below.
  const specials = useMemo(() => {
    if (isBar || selectedCategory !== "all") return [];

    return visibleCategories.flatMap((category) =>
      category.items.filter((item) => item.isSpecial)
    );
  }, [visibleCategories, selectedCategory, isBar]);

  const changeSection = (key) => {
    setSection(key);
    setActiveCategory("all");
    setSearch("");
  };

  const clearFilters = () => {
    setActiveCategory("all");
    setSearch("");
  };

  return (
    <div className="app-shell">
      <div
        className="topbar"
        style={{ justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="page-title"
            onClick={() => navigate("/")}
            style={{
              cursor: "pointer",
              background: "transparent",
              border: "none",
              color: "var(--white)",
              padding: 0,
              textAlign: "left",
            }}
          >
            Hotel Sea Palace
          </button>
          {tableNumber && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--gold)",
                background: "rgba(201, 169, 110, 0.12)",
                border: "1px solid rgba(201, 169, 110, 0.28)",
                borderRadius: 999,
                padding: "2px 8px",
                whiteSpace: "nowrap",
                fontFamily: "Poppins, sans-serif",
              }}
            >
              Table {tableNumber}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 2 }}>
          <button
            type="button"
            className="icon-btn"
            aria-label={`View cart, ${cartCount} items`}
            onClick={() => navigate("/cart")}
            style={{
              position: "relative",
              border: "none",
              background: "transparent",
            }}
          >
            <ShoppingCart
              size={20}
              color="var(--white)"
            />

            {cartCount > 0 && (
              <span
                key={cartCount}
                className="badge-pop"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  minWidth: 15,
                  height: 15,
                  padding: "0 3px",
                  background: "var(--gold)",
                  color: "var(--bg)",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>

          <NavDrawer />
        </div>
      </div>

      <div className="page" style={{ paddingTop: 16 }}>
        <div style={{ padding: "0 16px" }}>
          {/* Main menu sections */}
          <div
            role="group"
            aria-label="Menu sections"
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              marginBottom: 16,
            }}
          >
            {SECTIONS.map(
              ({ key, label, icon: Icon }) => {
                const active = section === key;

                return (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={active}
                    onClick={() => changeSection(key)}
                    style={{
                      flex: "1 0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "12px 14px",
                      borderRadius: 13,
                      border: `1.5px solid ${
                        active
                          ? "var(--gold)"
                          : "var(--border)"
                      }`,
                      background: active
                        ? "var(--gold-dim)"
                        : "var(--surface)",
                      color: active
                        ? "var(--gold)"
                        : "var(--muted)",
                      fontFamily: "Poppins, sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              }
            )}
          </div>

          {/* Search within the selected tab */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface-alt)",
              borderRadius: 13,
              border: "1px solid var(--border)",
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <input
              type="search"
              aria-label={`Search ${currentSection.label}`}
              placeholder={
                isBar
                  ? "Search drinks or categories..."
                  : `Search ${currentSection.label.toLowerCase()}...`
              }
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                padding: "12px 14px",
                fontSize: 13,
                color: "var(--white)",
              }}
            />

            <Search
              size={17}
              color="var(--muted)"
              aria-hidden="true"
              style={{
                flexShrink: 0,
                marginRight: 14,
              }}
            />
          </div>

          {loading ? (
            <div
              role="status"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: 60,
                color: "var(--muted)",
              }}
            >
              <Loader2 size={22} className="spin" />
              <p style={{ fontSize: 13, marginTop: 10 }}>
                Loading menu…
              </p>
            </div>
          ) : error ? (
            <div
              role="alert"
              style={{
                textAlign: "center",
                marginTop: 40,
              }}
            >
              <p
                style={{
                  color: "var(--red, #e53935)",
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {error}
              </p>

              <button
                type="button"
                className="outline-btn"
                onClick={() => reload()}
                style={{
                  maxWidth: 160,
                  margin: "0 auto",
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Category filters */}
              {categories.length > 0 && (
                <div
                  className="chip-row"
                  role="group"
                  aria-label="Category filters"
                  style={{ marginBottom: 18 }}
                >
                  <button
                    type="button"
                    className={`chip ${
                      selectedCategory === "all"
                        ? "active"
                        : ""
                    }`}
                    aria-pressed={
                      selectedCategory === "all"
                    }
                    onClick={() =>
                      setActiveCategory("all")
                    }
                  >
                    All
                  </button>

                  {categories.map((category) => (
                    <button
                      type="button"
                      key={category.key}
                      className={`chip ${
                        selectedCategory === category.key
                          ? "active"
                          : ""
                      }`}
                      aria-pressed={
                        selectedCategory === category.key
                      }
                      onClick={() =>
                        setActiveCategory(category.key)
                      }
                    >
                      {categoryLabel(category)}
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <h1 style={styles.heading}>
                  {currentSection.label}
                </h1>

                <span
                  aria-live="polite"
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  {visibleCount}{" "}
                  {visibleCount === 1 ? "item" : "items"}
                </span>
              </div>

              {section === "common" && (
                <p
                  style={{
                    color: "var(--muted)",
                    fontSize: 12,
                    lineHeight: 1.6,
                    marginBottom: 18,
                  }}
                >
                  Soups, snacks, rice and breads.
                  Check each dish’s veg or non-veg indicator.
                </p>
              )}

              {visibleCategories.length === 0 ? (
                <div style={styles.empty}>
                  <p>
                    {search.trim()
                      ? "No items match your search in this section."
                      : "No items are currently available in this section."}
                  </p>

                  {(search.trim() ||
                    selectedCategory !== "all") && (
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={clearFilters}
                      style={{
                        maxWidth: 180,
                        margin: "16px auto",
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {specials.length > 0 && (
                    <section
                      aria-labelledby="menu-specials"
                      style={{ marginBottom: 28 }}
                    >
                      <h2
                        id="menu-specials"
                        style={{
                          ...styles.heading,
                          color: "var(--gold)",
                          marginBottom: 12,
                        }}
                      >
                        Today’s Specials
                      </h2>

                      <DishGrid items={specials} />
                    </section>
                  )}

                  {/* Preserve separate headings in All view */}
                  {visibleCategories.map((category) => (
                    <section
                      key={category.key}
                      aria-labelledby={`category-${category.key}`}
                      style={{ marginBottom: 28 }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <h2
                          id={`category-${category.key}`}
                          style={{
                            ...styles.heading,
                            color: "var(--gold)",
                          }}
                        >
                          {categoryLabel(category)}
                        </h2>

                        <div
                          aria-hidden="true"
                          style={{
                            flex: 1,
                            height: 1,
                            background: "var(--border)",
                          }}
                        />
                      </div>

                      <DishGrid items={category.items} />
                    </section>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}