import { useEffect, useState } from "react";
import { QrCode, Download, Printer } from "lucide-react";
import TopBar from "../../components/TopBar";
import { api, ApiError } from "../../services/api";

export default function QRManagement() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/tables")
      .then((res) => setTables(res?.data || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load tables"))
      .finally(() => setLoading(false));
  }, []);

  // Scanning this URL drops the guest straight onto the home page with their
  // table number pre-filled (Home.jsx reads ?table= on load and stores it in
  // CartContext), so every order they place is tied to the right table
  // without them having to type anything in.
  const tableUrl = (tableNumber) => `${window.location.origin}/?table=${tableNumber}`;
  const qrImageUrl = (tableNumber) => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(tableUrl(tableNumber))}`;

  return (
    <div className="app-shell">
      <TopBar title="QR Management" />
      <div className="page" style={{ padding: "16px 16px 32px" }}>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>
          Each code links straight to the menu with that table pre-selected, so orders are always attributed correctly.
        </p>

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading tables…</p>
        ) : error ? (
          <p style={{ color: "var(--red, #e53935)", fontSize: 13, textAlign: "center", marginTop: 40 }}>{error}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {tables.map((t) => (
              <div key={t.id} className="card" style={{ padding: 14, textAlign: "center" }}>
                <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Table {t.table_number}
                </p>
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    background: "var(--surface-alt)",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <img src={qrImageUrl(t.table_number)} alt={`QR code for table ${t.table_number}`} width="100%" height="100%" style={{ objectFit: "contain" }} />
                </div>
                <p style={{ fontSize: 9.5, color: "var(--muted)", marginBottom: 10, wordBreak: "break-all" }}>{tableUrl(t.table_number)}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <a className="icon-btn" style={{ flex: 1, width: "auto" }} href={qrImageUrl(t.table_number)} download={`table-${t.table_number}-qr.png`} target="_blank" rel="noreferrer">
                    <Download size={14} color="var(--gold)" />
                  </a>
                  <button className="icon-btn" style={{ flex: 1, width: "auto" }} onClick={() => window.print()}>
                    <Printer size={14} color="var(--gold)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && tables.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 40, color: "var(--muted)" }}>
            <QrCode size={28} style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 12.5 }}>No tables found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
