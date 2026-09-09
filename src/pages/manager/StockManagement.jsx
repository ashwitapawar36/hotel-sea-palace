import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import TopBar from "../../components/TopBar";
import { useManagerMenu } from "../../hooks/useManagerMenu";

function Toggle({ on, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 42,
        height: 24,
        borderRadius: 50,
        background: on ? "var(--gold)" : "var(--surface-alt)",
        border: `1px solid ${on ? "var(--gold)" : "var(--border)"}`,
        position: "relative",
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: on ? "var(--bg)" : "var(--muted)" }} />
    </button>
  );
}

export default function StockManagement() {
  const { items, categories, loading, error, toggleAvailability } = useManagerMenu();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const categoryNames = useMemo(() => Array.from(new Set(categories.map((c) => c.name))), [categories]);

  const filtered = items.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || d.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="app-shell">
      <TopBar title="Stock Management" />
      <div className="page" style={{ padding: "16px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", background: "var(--surface-alt)", borderRadius: 13, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 12 }}>
          <input className="text-input" style={{ border: "none", background: "transparent" }} placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ padding: "0 14px" }}>
            <Search size={16} color="var(--muted)" />
          </div>
        </div>

        <div className="chip-row" style={{ marginBottom: 18 }}>
          {["All", ...categoryNames].map((c) => (
            <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading menu…</p>
        ) : error ? (
          <p style={{ color: "var(--red, #e53935)", fontSize: 13, textAlign: "center", marginTop: 40 }}>{error}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((d) => (
              <div key={d.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10 }}>
                <img src={d.image} alt={d.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, opacity: d.available ? 1 : 0.45 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 600 }}>{d.name}</p>
                  <p style={{ color: d.available ? "var(--green)" : "var(--red)", fontSize: 10.5, fontWeight: 600 }}>{d.available ? "Available" : "Out of Stock"}</p>
                </div>
                <Toggle on={d.available} onClick={() => toggleAvailability(d.id, !d.available)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
