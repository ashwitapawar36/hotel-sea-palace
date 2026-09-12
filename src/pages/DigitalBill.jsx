import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Waves } from "lucide-react";
import TopBar from "../components/TopBar";
import FeedbackModal from "../components/FeedbackModal";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../services/api";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const BACKEND_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DigitalBill() {
  const navigate = useNavigate();
  const submissionLocked = useRef(false);
  const pdfLocked = useRef(false);

  const {
    cartDishes,
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
  const [orderError, setOrderError] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackOrderId, setFeedbackOrderId] = useState(null);
  const [splitResult, setSplitResult] = useState(null);
  const [splitError, setSplitError] = useState("");
  const [billUrl, setBillUrl] = useState("");
  const [billGenerating, setBillGenerating] = useState(false);
  const [billError, setBillError] = useState("");

  // A new cart must not display the previous order's bill.
  const order = cartDishes.length > 0 ? null : lastOrder;

  async function placeOrder() {
    if (
      submissionLocked.current ||
      cartDishes.length === 0 ||
      order
    ) {
      return;
    }

    submissionLocked.current = true;
    setPlacing(true);
    setOrderError("");
    setSplitError("");
    setSplitResult(null);
    setBillUrl("");
    setBillError("");

    let payload;

    try {
      payload = buildOrderPayload();
    } catch (err) {
      submissionLocked.current = false;
      setPlacing(false);
      setOrderError(err.message || "Please check your cart.");
      return;
    }

    const cartSnapshot = [...cartDishes];
    const dinerSnapshot = [...diners];
    const assignmentSnapshot = { ...assignments };

    let placedOrder;

    try {
      const res = await api.post("/orders", payload);
      placedOrder = res?.data?.order;

      if (!placedOrder?.id) {
        throw new Error("Missing order confirmation");
      }
    } catch (err) {
      // A lost response does not prove the server failed to save the
      // order. Keep submission locked to avoid an accidental duplicate.
      setOrderError(
        `${
          err instanceof ApiError
            ? err.message
            : "We could not confirm your order."
        } Please check with the manager before submitting again.`
      );
      setPlacing(false);
      return;
    }

    setLastOrder(placedOrder);
    clear();
    setFeedbackOrderId(placedOrder.id);
    setShowFeedback(true);
    setPlacing(false);

    // Splitting is separate from order creation and payment.
    // Its failure must never trigger another order submission.
    if (dinerSnapshot.length > 1) {
      try {
        const orderItemAssignments = {};

        for (const item of placedOrder.items || []) {
          const match = cartSnapshot.find(
            (dish) =>
              dish.itemId === item.menu_item_id &&
              (dish.variantId || null) === (item.variant_id || null)
          );

          if (match) {
            orderItemAssignments[item.id] =
              assignmentSnapshot[match.id] || [];
          }
        }

        const res = await api.post("/split-bill", {
          orderId: placedOrder.id,
          people: dinerSnapshot.map((diner, index) => ({
            clientId: diner.id,
            name: diner.name.trim() || `Guest ${index + 1}`,
        })),
          assignments: orderItemAssignments,
        });

        setSplitResult(res.data);
      } catch {
        setSplitError(
          "Your order was placed, but the split could not be saved. Please ask the manager to help divide the bill."
        );
      }
    }
  }

  async function generateBill() {
    if (!order?.id || pdfLocked.current) return;

    pdfLocked.current = true;
    setBillGenerating(true);
    setBillError("");

    try {
      const res = await api.post("/bills", {
        orderId: order.id,
        restaurantName: "Hotel Sea Palace",
      });

      const downloadUrl = res?.data?.downloadUrl;

      if (!downloadUrl) {
        throw new Error("No PDF URL returned");
      }

      setBillUrl(new URL(downloadUrl, BACKEND_ORIGIN).href);
    } catch (err) {
      setBillError(
        err instanceof ApiError
          ? err.message
          : "Could not generate the PDF. Please try again."
      );
    } finally {
      pdfLocked.current = false;
      setBillGenerating(false);
    }
  }

  const displayItems = order
    ? (order.items || []).map((item) => ({
        id: item.id,
        name: `${item.name}${
          item.variant_label ? ` (${item.variant_label})` : ""
        }`,
        qty: Number(item.quantity),
        price: Number(item.unit_price),
      }))
    : cartDishes;

  const total = order ? Number(order.total_amount) : grandTotal;

  const totals = [
    [
      "Food / Non-Alcoholic Subtotal",
      order ? Number(order.food_subtotal) : foodSubtotal,
    ],
    [
      order ? "CGST" : "CGST (2.5%)",
      order ? Number(order.cgst_amount) : cgst,
    ],
    [
      order ? "SGST" : "SGST (2.5%)",
      order ? Number(order.sgst_amount) : sgst,
    ],
    [
      "Alcohol Subtotal",
      order ? Number(order.alcohol_subtotal) : alcoholSubtotal,
    ],
    ["VAT", order ? Number(order.vat_amount) : vat],
  ];

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  };

  return (
    <div className="app-shell">
      <div className="no-print">
        <TopBar title={order ? "Your Bill" : "Review Your Order"} />
      </div>

      <div className="page" style={{ padding: "16px 16px 32px" }}>
        {!order && cartDishes.length === 0 ? (
          <div className="card" style={{ padding: 20 }}>
            <p style={{ marginBottom: 16 }}>
              Your cart is empty.
            </p>
            <button
              className="gold-btn"
              onClick={() => navigate("/menu")}
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            {order && (
              <div
                className="card no-print"
                style={{ padding: 16, marginBottom: 14 }}
              >
                <strong style={{ color: "var(--gold)" }}>
                  Order placed successfully!
                </strong>
                <p style={{ marginTop: 8, color: "var(--muted)" }}>
                  Your order has been sent to the kitchen.
                </p>
              </div>
            )}

            <div className="card bill-card" style={{ padding: 20 }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <Waves size={22} color="var(--gold)" />
                <h2
                  style={{
                    color: "var(--gold)",
                    fontFamily: "Playfair Display, serif",
                    marginTop: 8,
                  }}
                >
                  Hotel Sea Palace
                </h2>
                <p style={{ color: "var(--muted)", fontSize: 12 }}>
                  Beach Road, Alibaug · +91 74983 40889
                </p>
              </div>

              <div style={rowStyle}>
                <span>Table</span>
                <strong>{order?.table_number ?? tableNumber ?? "—"}</strong>
              </div>

              {order && (
                <div style={rowStyle}>
                  <span>Order number</span>
                  <strong style={{ overflowWrap: "anywhere" }}>
                    {order.order_number}
                  </strong>
                </div>
              )}

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  padding: "14px 0",
                  margin: "16px 0",
                }}
              >
                {displayItems.map((dish) => (
                  <div key={dish.id} style={rowStyle}>
                    <span>
                      {dish.name} × {dish.qty}
                    </span>
                    <strong style={{ whiteSpace: "nowrap" }}>
                      {money(Number(dish.price) * Number(dish.qty))}
                    </strong>
                  </div>
                ))}
              </div>

              {totals
                .filter(([, amount]) => amount > 0)
                .map(([label, amount]) => (
                  <div
                    key={label}
                    style={{ ...rowStyle, color: "var(--muted)" }}
                  >
                    <span>{label}</span>
                    <span>{money(amount)}</span>
                  </div>
                ))}

              {order && Number(order.discount_amount) > 0 && (
                <div style={rowStyle}>
                  <span>Discount</span>
                  <span>−{money(order.discount_amount)}</span>
                </div>
              )}

              <div
                style={{
                  ...rowStyle,
                  borderTop: "1px dashed var(--border)",
                  paddingTop: 14,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                <span>Grand Total</span>
                <span style={{ color: "var(--gold)" }}>
                  {money(total)}
                </span>
              </div>
            </div>

            {!order && (
              <div className="no-print" style={{ marginTop: 16 }}>
                {orderError && (
                  <p
                    role="alert"
                    style={{ color: "var(--red, #e53935)", marginBottom: 12 }}
                  >
                    {orderError}
                  </p>
                )}

                <button
                  className="gold-btn"
                  disabled={placing || submissionLocked.current}
                  onClick={placeOrder}
                >
                  {placing && <Loader2 size={16} className="spin" />}
                  {placing ? "Placing order…" : "Place Order"}
                </button>

                {!submissionLocked.current && (
                  <button
                    className="outline-btn"
                    style={{ marginTop: 10 }}
                    onClick={() => navigate("/split-bill")}
                  >
                    Edit Split
                  </button>
                )}
              </div>
            )}

            {splitError && (
              <p role="alert" style={{ marginTop: 14, color: "var(--muted)" }}>
                {splitError}
              </p>
            )}

            {order && splitResult?.people?.length > 0 && (
              <div className="card" style={{ padding: 16, marginTop: 14 }}>
                <h3 style={{ marginBottom: 12 }}>Bill Split</h3>
                {splitResult.people.map((person, index) => (
                  <div key={person.id || index} style={rowStyle}>
                    <span>{person.name}</span>
                    <strong>{money(person.amount)}</strong>
                  </div>
                ))}
              </div>
            )}

            {order && (
              <div className="no-print" style={{ marginTop: 16 }}>
                {billError && (
                  <p
                    role="alert"
                    style={{ color: "var(--red, #e53935)", marginBottom: 12 }}
                  >
                    {billError}
                  </p>
                )}

                {billUrl ? (
                  <a
                    className="gold-btn"
                    href={billUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <Download size={16} /> Download Bill PDF
                  </a>
                ) : (
                  <button
                    className="gold-btn"
                    disabled={billGenerating}
                    onClick={generateBill}
                  >
                    {billGenerating ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {billGenerating
                      ? "Generating PDF…"
                      : "Generate Bill PDF"}
                  </button>
                )}

                <button
                  className="outline-btn"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate("/menu")}
                >
                  Back to Menu
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <FeedbackModal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        orderId={feedbackOrderId}
      />
    </div>
  );
}