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
        transition: "background 0.15s",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: on ? "var(--bg)" : "var(--muted)",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

export default function SpecialsManagement() {
  const { items, loading, error, toggleSpecial } = useManagerMenu();
  const foodItems = items.filter((d) => d.menuType === "food");

  return (
    <div className="app-shell">
      <TopBar title="Today's Specials" />
      <div className="page" style={{ padding: "16px 16px 40px" }}>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>
          Toggle dishes on to feature them under "Today's Specials" on the customer menu. Changes save immediately.
        </p>

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading menu…</p>
        ) : error ? (
          <p style={{ color: "var(--red, #e53935)", fontSize: 13, textAlign: "center", marginTop: 40 }}>{error}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {foodItems.map((d) => (
              <div key={d.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10 }}>
                <img src={d.image} alt={d.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 600 }}>{d.name}</p>
                  <p style={{ color: "var(--gold)", fontSize: 12, fontWeight: 700, fontFamily: "Poppins,sans-serif" }}>₹{d.price}</p>
                </div>
                <Toggle on={d.isSpecial} onClick={() => toggleSpecial(d.id, !d.isSpecial)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
