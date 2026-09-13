import { Loader2, AlertCircle, Utensils, QrCode } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function RequireTable({ children }) {
  const { tableStatus, retryTableCheck, availableTables, selectTable } = useCart();

  if (tableStatus === "checking") {
    return (
      <div className="app-shell">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            gap: 12,
          }}
        >
          <Loader2 size={26} className="spin" color="var(--gold)" />
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Connecting to dining service…</p>
        </div>
      </div>
    );
  }

  // A network or server connection failure must show "Unable to connect" with Retry
  if (tableStatus === "error") {
    return (
      <div className="app-shell">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "70vh",
            padding: "16px 28px",
            textAlign: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(229, 57, 53, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertCircle size={28} color="var(--red, #e53935)" />
          </div>
          <p style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 18, fontWeight: 700 }}>
            Unable to connect
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6, maxWidth: 320 }}>
            Could not reach the server. Please verify your connection and try again.
          </p>
          <button
            type="button"
            className="gold-btn"
            style={{ maxWidth: 160, marginTop: 4 }}
            onClick={retryTableCheck}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Demo fallback table selector: shown if URL has no table parameter, or if table is invalid
  if (tableStatus === "unselected" || tableStatus === "invalid") {
    const tableList =
      availableTables && availableTables.length > 0
        ? availableTables
        : Array.from({ length: 16 }, (_, i) => ({
            table_number: i + 1,
            capacity: 4,
          }));

    const isInvalid = tableStatus === "invalid";

    return (
      <div className="app-shell">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "36px 16px 60px",
            minHeight: "80vh",
            maxWidth: 520,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: isInvalid ? "rgba(229, 57, 53, 0.15)" : "var(--gold-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            {isInvalid ? (
              <AlertCircle size={28} color="var(--red, #e53935)" />
            ) : (
              <Utensils size={28} color="var(--gold)" />
            )}
          </div>

          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              color: "var(--white)",
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            {isInvalid ? "Table Not Found" : "Select Your Table"}
          </h2>

          <p
            style={{
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.5,
              textAlign: "center",
              maxWidth: 380,
              marginBottom: 24,
            }}
          >
            {isInvalid
              ? "The table requested in your QR link is not recognized or is unavailable. Please select an active dining table below to continue:"
              : "Welcome to Hotel Sea Palace! Please choose your table to browse the menu and place orders:"}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))",
              gap: 10,
              width: "100%",
              marginBottom: 24,
            }}
          >
            {tableList.map((tbl) => (
              <button
                key={tbl.table_number}
                type="button"
                className="card"
                style={{
                  padding: "14px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--surface)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--gold)";
                  e.currentTarget.style.background = "var(--surface-alt)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--surface)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                onClick={() => selectTable(tbl.table_number)}
              >
                <span
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--white)",
                  }}
                >
                  Table {tbl.table_number}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {tbl.capacity ? `${tbl.capacity} Seats` : "Available"}
                </span>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center", maxWidth: 360, lineHeight: 1.5 }}>
            {isInvalid
              ? "In production, scanning a table's QR code automatically assigns your table."
              : "Demo mode: In production, guests scan a table QR code to open the menu directly with their table assigned."}
          </p>
        </div>
      </div>
    );
  }

  return children;
}
