import { Loader2, QrCode } from "lucide-react";
import { useCart } from "../context/CartContext";

// Wraps every customer-facing route that involves browsing or ordering, so
// none of them are reachable without a table number that came from a real
// QR scan (?table=N on the URL) AND matches an actual restaurant_tables
// row. There is intentionally no way around this screen - no manual entry,
// no "continue anyway" - scanning the table's QR code is the only path in.
export default function RequireTable({ children }) {
  const { tableStatus } = useCart();

  if (tableStatus === "checking") {
    return (
      <div className="app-shell">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
          <Loader2 size={26} className="spin" color="var(--gold)" />
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Checking your table…</p>
        </div>
      </div>
    );
  }

  if (tableStatus === "invalid") {
    return (
      <div className="app-shell">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "16px 28px", textAlign: "center", gap: 14 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--gold-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QrCode size={30} color="var(--gold)" />
          </div>
          <p style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 18, fontWeight: 700 }}>
            Please scan the QR code placed on your table to continue
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6, maxWidth: 320 }}>
            Hotel Sea Palace seats orders by table, so we can only take orders that come from your table's own QR code. Ask a staff member if you can't find it.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
