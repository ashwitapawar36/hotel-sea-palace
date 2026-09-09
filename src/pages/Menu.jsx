import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ShoppingCart, Loader2, UtensilsCrossed, Wine } from "lucide-react";
import DishCard from "../components/DishCard";
import NavDrawer from "../components/NavDrawer";
import { useCart } from "../context/CartContext";
import { useMenu } from "../context/MenuContext";

const SECTIONS = [
  { key: "food", label: "Food", icon: UtensilsCrossed },
  { key: "bar", label: "Bar", icon: Wine },
];

// FOOD is a real two-level hierarchy: every Food category belongs to
// exactly one parent group, Vegetarian Items or Non-Vegetarian Items (see
// each item's normalized `foodGroup`, sourced from
// menu_categories.food_group). This list is just the display labels for
// the two group keys the backend returns - the hierarchy itself is not
// defined here.
const FOOD_GROUPS = [
  { key: "vegetarian", label: "Vegetarian Items" },
  { key: "non-vegetarian", label: "Non-Vegetarian Items" },
];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function GroupDivider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 14px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontFamily: "Poppins,sans-serif", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.08em", color: "var(--gold)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// One parent section (Vegetarian Items / Non-Vegetarian Items): a quick-jump
// chip per child category, then every child category rendered as its own
// subsection with its dishes underneath - never flattened into one shared
// grid, so the hierarchy stays visually obvious while browsing.
function FoodGroupSection({ label, categories }) {
  const scrollToCategory = (name) => {
    document.getElementById(`food-cat-${slugify(name)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <GroupDivider label={label} />
      <div className="chip-row" style={{ marginBottom: 18 }}>
        {categories.map((cat) => (
          <button key={cat.name} className="chip" onClick={() => scrollToCategory(cat.name)}>
            {cat.name}
          </button>
        ))}
      </div>
      {categories.map((cat) => (
        <div key={cat.name} id={`food-cat-${slugify(cat.name)}`} style={{ marginBottom: 24, scrollMarginTop: 90 }}>
          <h3 style={{ fontFamily: "Poppins,sans-serif", fontSize: 14.5, fontWeight: 700, color: "var(--white)", marginBottom: 10 }}>{cat.name}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {cat.items.map((d) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Menu() {
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { foodItems, barItems, barCategories, loading, error, reload } = useMenu();
  // FOOD and BAR are the two primary sections. Bar keeps its own flat
  // category-chip filter (unchanged); Food renders as the Vegetarian /
  // Non-Vegetarian hierarchy below instead of a filtered single-category view.
  const [section, setSection] = useState("food");
  const [activeBarCategory, setActiveBarCategory] = useState("All");
  const [search, setSearch] = useState("");

  const isBar = section === "bar";

  const barCategoryChips = useMemo(() => {
    const present = new Set(barItems.map((d) => d.category).filter(Boolean));
    return [...new Set(barCategories.filter((c) => present.has(c)))];
  }, [barItems, barCategories]);

  useEffect(() => {
    if (activeBarCategory !== "All" && !barCategoryChips.includes(activeBarCategory)) {
      setActiveBarCategory("All");
    }
  }, [barCategoryChips, activeBarCategory]);

  const barFiltered = useMemo(
    () =>
      barItems.filter((item) => {
        const matchesCategory = activeBarCategory === "All" ? true : item.category === activeBarCategory;
        const matchesSearch = search.trim() ? item.name.toLowerCase().includes(search.toLowerCase()) : true;
        return matchesCategory && matchesSearch;
      }),
    [barItems, activeBarCategory, search]
  );

  // Today's Specials is a promotional cross-cutting list, not a Food
  // category - it's rendered above the hierarchy, separately from it.
  const specials = useMemo(() => {
    const matchesSearch = (d) => (search.trim() ? d.name.toLowerCase().includes(search.toLowerCase()) : true);
    return foodItems.filter((d) => d.isSpecial && matchesSearch(d));
  }, [foodItems, search]);

  // Groups every Food item by its parent (foodGroup) then its category, in
  // the category's real display_order from the database - the hierarchy
  // itself lives in menu_categories/menu_items, not in this component. A
  // search term filters dishes within each category rather than flattening
  // the structure; a category with zero matches (or zero available items)
  // simply doesn't render, and each dish appears in exactly one category.
  const foodHierarchy = useMemo(() => {
    const matchesSearch = (d) => (search.trim() ? d.name.toLowerCase().includes(search.toLowerCase()) : true);
    const byGroup = { vegetarian: new Map(), "non-vegetarian": new Map() };
    foodItems.forEach((d) => {
      if (!byGroup[d.foodGroup] || !matchesSearch(d)) return;
      const bucket = byGroup[d.foodGroup];
      if (!bucket.has(d.category)) bucket.set(d.category, { name: d.category, order: d.categoryOrder, items: [] });
      bucket.get(d.category).items.push(d);
    });
    const toSorted = (map) => [...map.values()].sort((a, b) => a.order - b.order);
    return FOOD_GROUPS.map((g) => ({ ...g, categories: toSorted(byGroup[g.key]) })).filter((g) => g.categories.length > 0);
  }, [foodItems, search]);

  return (
    <div className="app-shell">
      <div className="topbar" style={{ justifyContent: "space-between" }}>
        <span className="page-title" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          Hotel Sea Palace
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <button className="icon-btn" style={{ position: "relative", border: "none", background: "transparent" }} onClick={() => navigate("/cart")}>
            <ShoppingCart size={20} color="var(--white)" />
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="badge-pop"
                style={{ position: "absolute", top: 2, right: 2, width: 15, height: 15, background: "var(--gold)", color: "var(--bg)", fontSize: 9, fontWeight: 700, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
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
          {/* FOOD | BAR - the two primary sections. Bar is never nested
              inside Food, and Food's Vegetarian/Non-Vegetarian split never
              leaks into Bar. */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const active = section === key;
              return (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "12px 6px",
                    borderRadius: 13,
                    border: `1.5px solid ${active ? "var(--gold)" : "var(--border)"}`,
                    background: active ? "var(--gold-dim)" : "var(--surface)",
                    color: active ? "var(--gold)" : "var(--muted)",
                    fontFamily: "Poppins,sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", background: "var(--surface-alt)", borderRadius: 13, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16 }}>
            <input
              type="text"
              placeholder={isBar ? "Search drinks..." : "Search dishes..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "12px 14px", fontSize: 13, color: "var(--white)" }}
            />
            <div style={{ padding: "0 14px" }}>
              <Search size={17} color="var(--muted)" />
            </div>
          </div>

          {isBar && (
            <div className="chip-row" style={{ marginBottom: 20 }}>
              <button className={`chip ${activeBarCategory === "All" ? "active" : ""}`} onClick={() => setActiveBarCategory("All")}>
                All
              </button>
              {barCategoryChips.map((c) => (
                <button key={c} className={`chip ${activeBarCategory === c ? "active" : ""}`} onClick={() => setActiveBarCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 60, color: "var(--muted)" }}>
              <Loader2 size={22} className="spin" />
              <p style={{ fontSize: 13, marginTop: 10 }}>Loading menu…</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", marginTop: 60 }}>
              <p style={{ color: "var(--red, #e53935)", fontSize: 13, marginBottom: 12 }}>{error}</p>
              <button className="outline-btn" style={{ maxWidth: 160, margin: "0 auto" }} onClick={reload}>
                Retry
              </button>
            </div>
          ) : isBar ? (
            barFiltered.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>No drinks in this category.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {barFiltered.map((d) => (
                  <DishCard key={d.id} dish={d} />
                ))}
              </div>
            )
          ) : specials.length === 0 && foodHierarchy.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>No dishes match your search.</p>
          ) : (
            <>
              {specials.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <h2 style={{ fontFamily: "Poppins,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>Today's Specials</h2>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {specials.map((d) => (
                      <DishCard key={d.id} dish={d} />
                    ))}
                  </div>
                </div>
              )}
              {foodHierarchy.map((group) => (
                <FoodGroupSection key={group.key} label={group.label} categories={group.categories} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
