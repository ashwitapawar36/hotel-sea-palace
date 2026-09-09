import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingCart, MapPin, Phone, Clock, Waves, Loader2 } from "lucide-react";
import DishCard from "../components/DishCard";
import NavDrawer from "../components/NavDrawer";
import { useCart } from "../context/CartContext";
import { useMenu } from "../context/MenuContext";

// Categories themselves come from the menu API (see useMenu below) - this is
// just a cosmetic keyword -> emoji lookup so category chips keep an icon
// without hardcoding the actual list of categories. Anything unmatched
// falls back to a sensible default per menu type.
const CATEGORY_ICONS = [
  [/fish|seafood|prawn|crab|lobster/i, "🦞"],
  [/chicken/i, "🍗"],
  [/veg/i, "🥗"],
  [/biryani|rice/i, "🍛"],
  [/tandoor|kebab|starter/i, "🍢"],
  [/thali/i, "🍽️"],
  [/soup/i, "🍲"],
  [/dessert|sweet/i, "🍮"],
  [/bar|cocktail|beer|wine|whisky|whiskey|rum|vodka|gin/i, "🍸"],
];

function categoryIcon(label, fallback) {
  const match = CATEGORY_ICONS.find(([pattern]) => pattern.test(label));
  return match ? match[1] : fallback;
}

function SectionTitle({ label }) {
  return (
    <div className="section-title-wrap" style={{ marginBottom: 12 }}>
      <h2 className="section-title">{label}</h2>
      <div className="section-underline" />
    </div>
  );
}

export default function Home() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { cartCount, tableNumber } = useCart();
  const { foodItems, barItems, foodCategories, barCategories, popularItems, loading, error } = useMenu();

  const specials = useMemo(() => foodItems.filter((d) => d.isSpecial), [foodItems]);

  // Real order-history popularity from the backend (total quantity sold,
  // cancelled orders excluded). With no order history yet, fall back to a
  // recommended selection instead of showing an empty section.
  const popular = popularItems;
  const recommended = useMemo(() => foodItems.slice(0, 6), [foodItems]);

  // Categories are derived from the menu data itself (never hardcoded), and
  // filtered down to categories that actually have an available item right
  // now - a category with nothing to show never appears as a chip.
  const foodCategoryChips = useMemo(() => {
    const present = new Set(foodItems.map((d) => d.category).filter(Boolean));
    return [...new Set(foodCategories.filter((c) => present.has(c)))];
  }, [foodItems, foodCategories]);
  const barCategoryChips = useMemo(() => {
    const present = new Set(barItems.map((d) => d.category).filter(Boolean));
    return [...new Set(barCategories.filter((c) => present.has(c)))];
  }, [barItems, barCategories]);

  const results = search.trim()
    ? [
        ...foodItems.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || (d.desc || "").toLowerCase().includes(search.toLowerCase())),
        ...barItems.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.category.toLowerCase().includes(search.toLowerCase())),
      ]
    : null;

  return (
    <div className="app-shell">
      <div className="topbar" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Waves size={18} color="var(--gold)" strokeWidth={2} />
          <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontWeight: 700, fontSize: 14 }}>Hotel Sea Palace</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button className="icon-btn" style={{ position: "relative", border: "none", background: "transparent" }} onClick={() => navigate("/cart")} aria-label="Cart">
            <ShoppingCart size={20} color="var(--white)" />
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="badge-pop"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 15,
                  height: 15,
                  background: "var(--gold)",
                  color: "var(--bg)",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Poppins,sans-serif",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
          <NavDrawer />
        </div>
      </div>

      <div className="page" style={{ padding: 0 }}>
        <div id="home" style={{ position: "relative", padding: "32px 16px 36px", textAlign: "center", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url(https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=500&fit=crop&auto=format)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.13,
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,17,23,0.4) 0%, rgba(13,17,23,0.9) 100%)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              {/* Read-only - this table number came from the QR code that was
                  scanned to get here (see CartContext) and the guest has no
                  way to change it in the app. */}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(13,17,23,0.72)", border: "1px solid var(--border)", borderRadius: 999, padding: "6px 12px" }}>
                <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Table</span>
                <span style={{ color: "var(--gold)", fontSize: 12, fontWeight: 700, fontFamily: "Poppins,sans-serif" }}>{tableNumber}</span>
              </span>
            </div>
            <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: 27, fontWeight: 800, color: "var(--white)", lineHeight: 1.2, marginBottom: 9 }}>
              Welcome to <span style={{ color: "var(--gold)" }}>Hotel Sea Palace</span>
            </h1>
            <p style={{ fontFamily: "Inter,sans-serif", color: "var(--muted)", fontSize: 12, marginBottom: 10, letterSpacing: "0.03em" }}>Fresh Seafood • Family Dining • Coastal Cuisine</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 24 }}>
              <Clock size={12} color="var(--gold)" />
              <span style={{ fontFamily: "Inter,sans-serif", color: "var(--muted)", fontSize: 11 }}>Open Daily: 10:00 AM – 11:00 PM</span>
            </div>
            <button onClick={() => navigate("/menu")} className="gold-btn" style={{ fontSize: 14 }}>
              Browse Menu →
            </button>
          </div>
        </div>

        <div id="menu" style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface-alt)", borderRadius: 13, border: "1px solid var(--border)", overflow: "hidden" }}>
            <input
              type="text"
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "12px 14px", fontFamily: "Inter,sans-serif", fontSize: 13, color: "var(--white)" }}
            />
            <div style={{ padding: "0 14px" }}>
              <Search size={17} color="var(--muted)" />
            </div>
          </div>
        </div>

        <div style={{ padding: "0 16px" }}>
          {results && (
            <div style={{ marginTop: 20 }}>
              <SectionTitle label={`Results for "${search}"`} />
              {results.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>No dishes found.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {results.map((d) => (
                    <DishCard key={d.id} dish={d} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!results && (
            <>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40, color: "var(--muted)" }}>
                  <Loader2 size={22} className="spin" />
                  <p style={{ fontSize: 13, marginTop: 10 }}>Loading menu…</p>
                </div>
              ) : error ? (
                <p style={{ color: "var(--red, #e53935)", fontSize: 13, textAlign: "center", marginTop: 40 }}>{error}</p>
              ) : (
                <>
                  <div style={{ marginTop: 22 }}>
                    <SectionTitle label="Today's Specials" />
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", marginRight: -16, paddingRight: 16, paddingBottom: 4 }}>
                      {specials.map((d) => (
                        <div key={d.id} style={{ width: 170, flexShrink: 0 }}>
                          <DishCard dish={d} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {(popular.length > 0 || recommended.length > 0) && (
                    <div style={{ marginTop: 24 }}>
                      <SectionTitle label={popular.length > 0 ? "Popular Dishes" : "Recommended For You"} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {(popular.length > 0 ? popular : recommended).map((d) => (
                          <DishCard key={d.id} dish={d} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {foodCategoryChips.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <SectionTitle label="Food Menu" />
                  <div className="chip-row">
                    {foodCategoryChips.map((label) => (
                      <Link key={label} to="/menu" className="chip">
                        <span style={{ fontSize: 14 }}>{categoryIcon(label, "🍴")}</span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {barCategoryChips.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <SectionTitle label="Bar Menu" />
                  <div className="chip-row">
                    {barCategoryChips.map((label) => (
                      <Link key={label} to="/menu" className="chip">
                        <span style={{ fontSize: 14 }}>{categoryIcon(label, "🍸")}</span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div id="about" style={{ marginTop: 24 }}>
                <div className="card" style={{ padding: "18px 16px", borderLeft: "3px solid var(--gold)" }}>
                  <h2 style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>About Sea Palace</h2>
                  <p style={{ fontFamily: "Inter,sans-serif", color: "var(--muted)", fontSize: 12, lineHeight: 1.7 }}>
                    Hotel Sea Palace has been a sanctuary for seafood aficionados and families for over 25 years. We celebrate the spirit of the ocean, sourcing daily fresh catches from local fishermen, curated elegantly with rich coastal culinary heritage.
                  </p>
                </div>
              </div>

              <div id="contact" style={{ marginTop: 24 }}>
                <SectionTitle label="Contact Us" />
                <div className="card" style={{ overflow: "hidden" }}>
                  {[
                    { icon: <MapPin size={16} color="var(--gold)" />, label: "Address", content: "Near Post Office, Beach Road, Alibaug." },
                    { icon: <Phone size={16} color="var(--gold)" />, label: "Phone Number", content: "+91 74983 40889 / +91 79775 24615", href: "tel:+917498340889" },
                    { icon: <Clock size={16} color="var(--gold)" />, label: "Opening Hours", content: "Daily: 10:00 AM – 11:00 PM" },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--gold-dim)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.icon}</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--muted)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{row.label}</p>
                        {row.href ? (
                          <a href={row.href} style={{ fontFamily: "Inter,sans-serif", color: "var(--white)", fontSize: 12 }}>
                            {row.content}
                          </a>
                        ) : (
                          <p style={{ fontFamily: "Inter,sans-serif", color: "var(--white)", fontSize: 12 }}>{row.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ background: "#080C12", borderTop: "1px solid var(--border)", padding: "20px 16px", textAlign: "center", marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 8 }}>
            <Waves size={14} color="var(--gold)" />
            <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontWeight: 700, fontSize: 13 }}>Hotel Sea Palace</span>
          </div>
          <p style={{ fontFamily: "Inter,sans-serif", color: "#334155", fontSize: 10, marginBottom: 3 }}>© 2026 Sea Palace. All Rights Reserved.</p>
          <p style={{ fontFamily: "Inter,sans-serif", color: "var(--gold)", fontSize: 9, opacity: 0.65 }}>Designed for contactless QR seafood dining</p>
        </div>
      </div>
    </div>
  );
}
