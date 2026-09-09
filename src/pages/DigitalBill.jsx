import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Waves, Loader2, RefreshCw, Wallet, CreditCard, Smartphone, Users2, CheckCircle2 } from "lucide-react";
import TopBar from "../components/TopBar";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../services/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash", icon: Wallet },
  { key: "card", label: "Card", icon: CreditCard },
  { key: "upi", label: "UPI", icon: Smartphone },
];

export default function DigitalBill() {
  const navigate = useNavigate();
  const {
    cartDishes,
    subtotal,
    foodSubtotal,
    alcoholSubtotal,
    cgst,
    sgst,
    vat,
    grandTotal,
    tableNumber,
    diners,
    assignments,
    buildOrderPayload,
    lastOrder,
    setLastOrder,
    clear,
  } = useCart();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [billUrl, setBillUrl] = useState(null);
  const [billGenerating, setBillGenerating] = useState(false);
  const [splitResult, setSplitResult] = useState(null);

  // Payment is a separate step from bill/PDF generation - selecting a
  // method and confirming is the only thing that calls PATCH
  // /api/orders/:id/pay, which is the only place payment_status becomes
  // 'paid'. Generating the invoice above never implies payment.
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  // The order is created here, not on the previous screens - this is the
  // single place the cart gets turned into a real backend order. The
  // request only ever carries menuItemId/variantId/quantity (tableNumber
  // comes straight from the QR-scanned URL via CartContext, never from a
  // form field); every price and tax figure shown below comes back from
  // the server's response, never from the client-side cart preview.
  const placeOrder = useCallback(async () => {
    if (cartDishes.length === 0) return;
    setPlacing(true);
    setError(null);
    try {
      const payload = buildOrderPayload();
      const cartSnapshot = cartDishes;
      const res = await api.post("/orders", payload);
      const placedOrder = res.data.order;
      setLastOrder(placedOrder);
      clear();

      // If the guest split the bill by diner on the previous screen, persist
      // that as a real split against the order we just created - matching
      // each order_item (now that it has a real id) back to the cart line
      // it came from so item-level assignments carry through correctly.
      if (diners.length > 1) {
        const orderItemAssignments = {};
        placedOrder.items.forEach((orderItem) => {
          const cartMatch = cartSnapshot.find(
            (d) => d.itemId === orderItem.menu_item_id && (d.variantId || null) === (orderItem.variant_id || null)
          );
          if (cartMatch) {
            orderItemAssignments[orderItem.id] = assignments[cartMatch.id] || [];
          }
        });
        try {
          const splitRes = await api.post("/split-bill", {
            orderId: placedOrder.id,
            people: diners.map((d) => ({ clientId: d.id, name: d.name })),
            assignments: orderItemAssignments,
          });
          setSplitResult(splitRes.data);
        } catch {
          // Non-fatal - the order itself is already placed successfully.
          setSplitResult(null);
        }
      }

      // Generate the real, server-side PDF invoice for this exact order
      // (pdfkit, populated straight from the orders/order_items rows we
      // just wrote, including the CGST/SGST/VAT breakdown) so "Download
      // PDF" is an actual invoice, not a print-dialog screenshot of the
      // page. This never marks the order paid - see the Payment section
      // below for that.
      setBillGenerating(true);
      try {
        const billRes = await api.post("/bills", {
          orderId: placedOrder.id,
          restaurantName: "Hotel Sea Palace",
        });
        setBillUrl(billRes.data.downloadUrl);
      } catch {
        // Non-fatal: the order is already placed either way. The Download
        // button falls back to window.print() if this didn't succeed.
        setBillUrl(null);
      } finally {
        setBillGenerating(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartDishes.length]);

  useEffect(() => {
    if (cartDishes.length > 0) {
      placeOrder();
    }
    // Runs once per mount: cartDishes is intentionally read only at mount
    // time here so this doesn't re-fire while `placing` is updating other
    // state. A later checkout (fresh cart, fresh mount of this page) is a
    // separate visit and will correctly trigger its own placeOrder() call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!order || !paymentMethod) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await api.patch(`/orders/${order.id}/pay`, { paymentMethod });
      setLastOrder({ ...order, payment_status: res.data.payment_status, payment_method: res.data.payment_method, paid_at: res.data.paid_at });
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const order = lastOrder;
  const isPaid = order?.payment_status === "paid";
  const displayItems = order
    ? order.items.map((it) => ({
        id: it.id,
        name: `${it.name}${it.variant_label ? ` (${it.variant_label})` : ""}`,
        qty: it.quantity,
        price: Number(it.unit_price),
      }))
    : cartDishes;
  const displayFoodSubtotal = order ? Number(order.food_subtotal) : foodSubtotal;
  const displayAlcoholSubtotal = order ? Number(order.alcohol_subtotal) : alcoholSubtotal;
  const displayCgst = order ? Number(order.cgst_amount) : cgst;
  const displaySgst = order ? Number(order.sgst_amount) : sgst;
  const displayVat = order ? Number(order.vat_amount) : vat;
  const displayTotal = order ? Number(order.total_amount) : grandTotal;
  const invoiceNumber = order ? order.order_number : placing ? "Placing order…" : "—";
  const orderIdLabel = order ? order.id.slice(0, 8).toUpperCase() : "—";
  const date = new Date(order?.created_at || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="app-shell">
      <div className="no-print">
        <TopBar title="Digital Bill" />
      </div>
      <div className="page" style={{ padding: "16px 16px 32px" }}>
        {placing && (
          <div className="card" style={{ padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <Loader2 size={18} className="spin" color="var(--gold)" />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Sending your order to the kitchen…</span>
          </div>
        )}

        {error && (
          <div className="card no-print" style={{ padding: 16, marginBottom: 14, borderLeft: "3px solid var(--red, #e53935)" }}>
            <p style={{ fontSize: 12.5, color: "var(--red, #e53935)", marginBottom: 10 }}>{error}</p>
            <button className="outline-btn" style={{ maxWidth: 160 }} onClick={placeOrder}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        <div className="card bill-card" style={{ padding: 20, opacity: order ? 1 : 0.6 }}>
          <div style={{ textAlign: "center", marginBottom: 18, paddingBottom: 16, borderBottom: "1px dashed var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 6 }}>
              <Waves size={18} color="var(--gold)" />
              <span style={{ fontFamily: "Playfair Display,serif", color: "var(--gold)", fontWeight: 700, fontSize: 17 }}>Hotel Sea Palace</span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 10.5 }}>Beach Road, Alibaug · +91 74983 40889</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Invoice No.", value: invoiceNumber },
              { label: "Date", value: date },
              { label: "Table No.", value: tableNumber },
              { label: "Order ID", value: orderIdLabel },
            ].map((row) => (
              <div key={row.label}>
                <p style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{row.label}</p>
                <p style={{ fontSize: 12.5, color: "var(--white)", fontWeight: 600, fontFamily: "Poppins,sans-serif" }}>{row.value}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "10px 0", marginBottom: 14 }}>
            <div style={{ display: "flex", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              <span style={{ flex: 1 }}>Dish</span>
              <span style={{ width: 36, textAlign: "center" }}>Qty</span>
              <span style={{ width: 64, textAlign: "right" }}>Price</span>
            </div>
            {displayItems.map((d) => (
              <div key={d.id} style={{ display: "flex", fontSize: 12.5, color: "var(--white)", marginBottom: 8 }}>
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ width: 36, textAlign: "center", color: "var(--muted)" }}>{d.qty}</span>
                <span style={{ width: 64, textAlign: "right", fontFamily: "Poppins,sans-serif", fontWeight: 600 }}>₹{(d.price * d.qty).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>

          {displayFoodSubtotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
              <span>Food / Non-Alcoholic Subtotal</span>
              <span>₹{displayFoodSubtotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          {displayCgst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
              <span>CGST (9%)</span>
              <span>₹{displayCgst.toLocaleString("en-IN")}</span>
            </div>
          )}
          {displaySgst > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
              <span>SGST (9%)</span>
              <span>₹{displaySgst.toLocaleString("en-IN")}</span>
            </div>
          )}
          {displayAlcoholSubtotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
              <span>Alcohol Subtotal</span>
              <span>₹{displayAlcoholSubtotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          {displayVat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
              <span>VAT (10%)</span>
              <span>₹{displayVat.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, fontFamily: "Poppins,sans-serif", paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
            <span>Grand Total</span>
            <span style={{ color: "var(--gold)" }}>₹{displayTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {splitResult && (
          <div className="card no-print" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Users2 size={16} color="var(--gold)" />
              <span style={{ fontFamily: "Poppins,sans-serif", fontSize: 13, fontWeight: 700, color: "var(--white)" }}>Split between {splitResult.people.length} people</span>
            </div>
            {splitResult.people.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
                <span>{p.name}</span>
                <span style={{ color: "var(--white)", fontWeight: 600 }}>₹{Number(p.amount).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}

        {order && (
          <div className="card no-print" style={{ padding: 16, marginTop: 14 }}>
            {isPaid ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={18} color="var(--green, #22c55e)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--white)", fontFamily: "Poppins,sans-serif" }}>
                  Paid via {order.payment_method?.toUpperCase()}
                </span>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Choose how you'd like to pay</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = paymentMethod === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setPaymentMethod(m.key)}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          padding: "12px 6px",
                          borderRadius: 12,
                          border: `1.5px solid ${active ? "var(--gold)" : "var(--border)"}`,
                          background: active ? "var(--gold-dim)" : "transparent",
                          color: active ? "var(--gold)" : "var(--muted)",
                        }}
                      >
                        <Icon size={18} />
                        <span style={{ fontSize: 11, fontFamily: "Poppins,sans-serif", fontWeight: 600 }}>{m.label}</span>
                      </button>
                    );
                  })}
                  {splitResult && (
                    <button
                      onClick={() => setPaymentMethod("split")}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        padding: "12px 6px",
                        borderRadius: 12,
                        border: `1.5px solid ${paymentMethod === "split" ? "var(--gold)" : "var(--border)"}`,
                        background: paymentMethod === "split" ? "var(--gold-dim)" : "transparent",
                        color: paymentMethod === "split" ? "var(--gold)" : "var(--muted)",
                      }}
                    >
                      <Users2 size={18} />
                      <span style={{ fontSize: 11, fontFamily: "Poppins,sans-serif", fontWeight: 600 }}>Split</span>
                    </button>
                  )}
                </div>
                {payError && <p style={{ color: "var(--red, #e53935)", fontSize: 12, marginBottom: 10 }}>{payError}</p>}
                <button className="gold-btn" disabled={!paymentMethod || paying} onClick={handlePay}>
                  {paying ? <Loader2 size={16} className="spin" /> : null}
                  {paying ? "Processing…" : `Pay ₹${displayTotal.toLocaleString("en-IN")}`}
                </button>
              </>
            )}
          </div>
        )}

        {order && billUrl ? (
          <a
            className="outline-btn no-print"
            style={{ marginTop: 14, textDecoration: "none" }}
            href={`${BACKEND_ORIGIN}${billUrl}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} /> Download PDF
          </a>
        ) : (
          <button className="outline-btn no-print" style={{ marginTop: 14 }} disabled={!order || billGenerating} onClick={() => window.print()}>
            {billGenerating ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            {billGenerating ? "Preparing invoice…" : "Download PDF"}
          </button>
        )}
        <button className="outline-btn no-print" style={{ marginTop: 10 }} disabled={!order} onClick={() => navigate("/order-success")}>
          Continue
        </button>
      </div>
    </div>
  );
}
