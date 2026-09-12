import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import TopBar from "../components/TopBar";
import { useCart } from "../context/CartContext";

export default function Cart() {
  const navigate = useNavigate();
  const { cartDishes, setQty, remove, foodSubtotal, alcoholSubtotal, cgst, sgst, vat, grandTotal, tableNumber } = useCart();

  return (
    <div className="app-shell">
      <TopBar title="Your Cart" />
      <div className="page" style={{ padding: "16px 16px 140px" }}>
        {cartDishes.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 80 }}>
            <ShoppingBag size={40} color="var(--muted)" style={{ marginBottom: 14 }} />
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 18 }}>Your cart is empty.</p>
            <button className="outline-btn" style={{ maxWidth: 180, margin: "0 auto" }} onClick={() => navigate("/menu")}>
              Browse Menu
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Table Number</p>
                <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontWeight: 700 }}>{tableNumber}</p>
              </div>
              <span style={{ fontSize: 11, color: "var(--gold)" }}>From your table's QR</span>
            </div>
            {cartDishes.map((d) => (
              <div key={d.id} className="card" style={{ display: "flex", gap: 12, padding: 10 }}>
                <img src={d.image} alt={d.name} style={{ width: 68, height: 68, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 600 }}>{d.name}</p>
                    <button onClick={() => remove(d.id)} aria-label="Remove" style={{ background: "transparent", border: "none", flexShrink: 0 }}>
                      <Trash2 size={15} color="var(--red)" />
                    </button>
                  </div>
                  <p style={{ color: "var(--gold)", fontSize: 13, fontWeight: 700, fontFamily: "Poppins,sans-serif" }}>₹{d.price.toLocaleString("en-IN")}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setQty(d.id, d.qty - 1)} className="icon-btn" style={{ width: 26, height: 26, borderRadius: 8 }}>
                      <Minus size={13} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: "center" }}>{d.qty}</span>
                    <button onClick={() => setQty(d.id, d.qty + 1)} className="icon-btn" style={{ width: 26, height: 26, borderRadius: 8 }}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cartDishes.length > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "rgba(13,17,23,0.97)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid var(--border)",
            padding: "16px",
          }}
        >
          {foodSubtotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              <span>Food / Non-Alcoholic Subtotal</span>
              <span>₹{foodSubtotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          {cgst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              <span>CGST (2.5%)</span>
              <span>₹{cgst.toLocaleString("en-IN")}</span>
            </div>
          )}
          {sgst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              <span>SGST (2.5%)</span>
              <span>₹{sgst.toLocaleString("en-IN")}</span>
            </div>
          )}
          {alcoholSubtotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              <span>Alcohol Subtotal</span>
              <span>₹{alcoholSubtotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          {vat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
              <span>VAT (10%)</span>
              <span>₹{vat.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "var(--white)", marginBottom: 14, fontFamily: "Poppins,sans-serif" }}>
            <span>Grand Total</span>
            <span style={{ color: "var(--gold)" }}>₹{grandTotal.toLocaleString("en-IN")}</span>
          </div>
          <button className="gold-btn" onClick={() => navigate("/split-bill")}>
            Proceed to Split Bill
          </button>
        </div>
      )}
    </div>
  );
}
