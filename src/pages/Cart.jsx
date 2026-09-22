import { useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, Loader2, Utensils, AlertTriangle, Receipt, ArrowRight, RefreshCw, Users2 } from "lucide-react";
import TopBar from "../components/TopBar";
import FeedbackModal from "../components/FeedbackModal";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { submitOrderRound, acknowledgeOrderRound, requestFinalBill } from "../services/visits";

const STATUS_PILL_CLASS = {
  pending: "status-pending",
  accepted: "status-accepted",
  preparing: "status-preparing",
  ready: "status-ready",
  completed: "status-completed",
  cancelled: "status-cancelled",
};

export default function Cart() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const submissionLocked = useRef(false);

  const {
    cartDishes,
    setQty,
    remove,
    clear,
    removeSubmittedItems,
    foodSubtotal,
    alcoholSubtotal,
    cgst,
    sgst,
    vat,
    grandTotal,
    tableNumber,
    buildOrderPayload,
    visit,
    visitOrders,
    feedback,
    refreshVisit,
    startFreshVisitSession,
    isVisitClosed,
    isBillRequested,
    diners,
    isSplitActive,
  } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [showUnsentConfirmModal, setShowUnsentConfirmModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);

  const hasSubmittedRounds = visitOrders.length > 0;
  const nonCancelledOrders = useMemo(
    () => visitOrders.filter((o) => o.status !== "cancelled"),
    [visitOrders]
  );

  // Submit current unsent items as a new order round
  const handleSendRound = async () => {
    if (submissionLocked.current || cartDishes.length === 0) return false;
    if (isVisitClosed) {
      setSubmissionError("This visit has ended. Please start a new visit.");
      return false;
    }

    submissionLocked.current = true;
    setSubmitting(true);
    setSubmissionError("");

    try {
      const payload = buildOrderPayload({ customerName: `Table ${tableNumber}` });
      const result = await submitOrderRound(tableNumber, payload);

      if (!result?.order?.id) {
        throw new Error("Order confirmation not received from kitchen.");
      }

      // Remove only the quantities actually submitted, preserving newer additions
    if (
  !Array.isArray(result.submittedItems) ||
  result.submittedItems.length === 0
) {
  throw new Error(
    "Could not identify confirmed items. Please refresh and retry."
  );
}

const hasRemainingItems = removeSubmittedItems(result.submittedItems);

acknowledgeOrderRound(tableNumber, result.submissionKey);
      showToast(
        result.replayed
          ? "Previous order recovered."
          : hasSubmittedRounds
            ? "Additional items sent to kitchen!"
            : "First round placed successfully!"
      );

     await refreshVisit();

if (hasRemainingItems) {
  setSubmissionError(
    "The earlier order is confirmed. Your remaining items are still in the cart. Send them before requesting the final bill."
  );
  return false;
}

return true;
    } catch (err) {
      const msg = err?.message || "Could not submit your items. Please verify connection and retry.";
      setSubmissionError(msg);
      showToast(msg);
      return false;
    } finally {
      setSubmitting(false);
      submissionLocked.current = false;
    }
  };

  // User clicked "Request Final Bill"
  const handleFinalBillClick = () => {
    if (cartDishes.length > 0) {
      // Unsent items remain: ask confirmation
      setShowUnsentConfirmModal(true);
    } else {
      proceedToBillFlow();
    }
  };

  // Confirmed: send remaining items first, then request bill
  const handleSendAndRequestBill = async () => {
  if (submissionLocked.current || requestingBill) return;

  setShowUnsentConfirmModal(false);

  if (cartDishes.length > 0) {
    const sentSuccessfully = await handleSendRound();

    if (!sentSuccessfully) return;
  }

  proceedToBillFlow();
};

  // Feedback popup step before bill
  const proceedToBillFlow = () => {
    // Check if feedback already completed
    const feedbackCompleted = Boolean(
      feedback || localStorage.getItem(`sea-palace-feedback-done-${visit?.id}`)
    );

    if (!feedbackCompleted) {
      setShowFeedbackModal(true);
    } else {
      finalizeAndNavigate();
    }
  };

  const handleFeedbackComplete = (result) => {
    if (visit?.id) {
      localStorage.setItem(`sea-palace-feedback-done-${visit.id}`, "true");
    }
    setShowFeedbackModal(false);
    finalizeAndNavigate();
  };

  const finalizeAndNavigate = async () => {
    setRequestingBill(true);
    try {
      await requestFinalBill(tableNumber);
      await refreshVisit();
      navigate("/bill");
    } catch (err) {
      // If bill is already requested or created, navigate anyway
      if (err?.message?.includes("already") || isBillRequested) {
        navigate("/bill");
      } else {
        showToast(err?.message || "Could not finalize bill. Please try again.");
      }
    } finally {
      setRequestingBill(false);
    }
  };

  return (
    <div className="app-shell">
      <TopBar title="Your Orders & Cart" />
      <div className="page" style={{ padding: "16px 16px 140px" }}>
        {/* Table & Visit Info Bar */}
        <div
          className="card"
          style={{
            padding: "12px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              Active Dining Table
            </p>
            <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontWeight: 700, fontSize: 15 }}>
              Table {tableNumber}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              className={`status-pill ${
                isVisitClosed
                  ? "status-cancelled"
                  : isBillRequested
                    ? "status-ready"
                    : "status-accepted"
              }`}
            >
              {isVisitClosed ? "Visit Ended" : isBillRequested ? "Bill Requested" : "Visit Active"}
            </span>
          </div>
        </div>

        {/* Closed visit alert */}
        {isVisitClosed && (
          <div className="card" style={{ padding: 16, marginBottom: 14, borderLeft: "3px solid var(--red)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <AlertTriangle size={18} color="var(--red)" />
              <strong style={{ color: "var(--white)" }}>This visit has ended</strong>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
              The manager has closed this dining visit. You can start a fresh visit to order more items.
            </p>
            <button className="gold-btn" onClick={startFreshVisitSession} style={{ padding: "8px 14px", fontSize: 12 }}>
              Start Fresh Visit
            </button>
          </div>
        )}

        {/* SECTION 1: Unsent Cart */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <p className="section-title" style={{ marginBottom: 0 }}>
                Unsent Items ({cartDishes.length})
              </p>
              <div className="section-underline" />
            </div>
            {cartDishes.length > 0 && (
              <button
                onClick={clear}
                style={{ background: "transparent", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}
              >
                Clear Unsent
              </button>
            )}
          </div>

          {cartDishes.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "24px 16px" }}>
              <ShoppingBag size={28} color="var(--muted)" style={{ margin: "0 auto 8px" }} />
              <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 10 }}>
                {hasSubmittedRounds ? "No new items in cart. Add dishes anytime!" : "Your cart is empty."}
              </p>
              <button
                type="button"
                className="outline-btn"
                style={{ maxWidth: 160, margin: "0 auto", fontSize: 12, padding: "8px 12px" }}
                onClick={() => navigate("/menu")}
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cartDishes.map((d) => (
                <div key={d.id} className="card" style={{ display: "flex", gap: 12, padding: 10, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 600 }}>
                        {d.name}
                      </p>
                      <button
                        onClick={() => remove(d.id)}
                        aria-label="Remove item"
                        style={{ background: "transparent", border: "none", cursor: "pointer" }}
                      >
                        <Trash2 size={14} color="var(--red)" />
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ color: "var(--gold)", fontSize: 13, fontWeight: 700, fontFamily: "Poppins,sans-serif" }}>
                        ₹{(d.price * d.qty).toLocaleString("en-IN")}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => setQty(d.id, d.qty - 1)} className="icon-btn" style={{ width: 24, height: 24, borderRadius: 6 }}>
                          <Minus size={11} />
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 16, textAlign: "center" }}>{d.qty}</span>
                        <button onClick={() => setQty(d.id, d.qty + 1)} className="icon-btn" style={{ width: 24, height: 24, borderRadius: 6 }}>
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Unsent Cart Totals Breakdown */}
              <div className="card" style={{ padding: 12, marginTop: 4 }}>
                {foodSubtotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Food Subtotal</span>
                    <span>₹{foodSubtotal.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {cgst > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                    <span>CGST (2.5%)</span>
                    <span>₹{cgst.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {sgst > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                    <span>SGST (2.5%)</span>
                    <span>₹{sgst.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {alcoholSubtotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Alcohol Subtotal</span>
                    <span>₹{alcoholSubtotal.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {vat > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>
                    <span>VAT (10%)</span>
                    <span>₹{vat.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, color: "var(--white)", marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                  <span>Unsent Total</span>
                  <span style={{ color: "var(--gold)" }}>₹{grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {submissionError && (
                <p role="alert" style={{ color: "var(--red, #e53935)", fontSize: 12, marginTop: 4 }}>
                  {submissionError}
                </p>
              )}

              {/* Button to place round */}
              <button
                type="button"
                className="gold-btn"
                disabled={submitting || isVisitClosed}
                onClick={handleSendRound}
                style={{ marginTop: 6 }}
              >
                {submitting ? <Loader2 size={16} className="spin" /> : <Utensils size={15} />}
                {submitting
                  ? "Sending to kitchen…"
                  : hasSubmittedRounds
                    ? "Send Additional Items"
                    : "Place Order"}
              </button>
            </div>
          )}
        </div>

        {/* SECTION 2: Submitted Rounds ("My Orders") */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <p className="section-title" style={{ marginBottom: 0 }}>
                My Orders ({visitOrders.length} {visitOrders.length === 1 ? "round" : "rounds"})
              </p>
              <div className="section-underline" />
            </div>
            <button
              onClick={() => refreshVisit()}
              aria-label="Refresh status"
              style={{ background: "transparent", border: "none", color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, cursor: "pointer" }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {visitOrders.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12.5, textAlign: "center", padding: "16px 0" }}>
              No orders sent to the kitchen yet. Place your first round above!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visitOrders.map((order, idx) => {
                const statusKey = (order.status || "pending").toLowerCase();
                const isCancelled = statusKey === "cancelled";

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      padding: 14,
                      opacity: isCancelled ? 0.6 : 1,
                      borderLeft: isCancelled ? "3px solid var(--red)" : "3px solid var(--gold)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 700 }}>
                          Round #{idx + 1}
                        </p>
                        <p style={{ color: "var(--muted)", fontSize: 10.5 }}>
                          {order.order_number} · {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`status-pill ${STATUS_PILL_CLASS[statusKey] || "status-pending"}`}>
                        {order.status ? order.status.toUpperCase() : "PENDING"}
                      </span>
                    </div>

                    <div style={{ padding: "6px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", margin: "8px 0" }}>
                      {(order.items || []).map((it, i) => (
                        <div key={it.id || i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                          <span>
                            {it.name}{it.variant_label ? ` (${it.variant_label})` : ""} × {it.quantity}
                          </span>
                          <span style={{ color: isCancelled ? "var(--muted)" : "var(--white)" }}>
                            ₹{Number(it.line_total || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600 }}>
                      <span style={{ color: "var(--muted)" }}>
                        {isCancelled ? "Cancelled (Excluded from Bill)" : "Round Total"}
                      </span>
                      <span style={{ color: isCancelled ? "var(--red)" : "var(--gold)", fontWeight: 700 }}>
                        ₹{Number(order.total_amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      {hasSubmittedRounds && !isVisitClosed && (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "rgba(13,17,23,0.97)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid var(--border)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 30,
          }}
        >
          {isSplitActive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
                borderRadius: 8,
                background: "var(--gold-dim)",
                fontSize: 11.5,
                color: "var(--gold)",
                fontWeight: 600,
              }}
            >
              <span>Bill Split Active ({diners.length} diners)</span>
              <button
                type="button"
                onClick={() => navigate("/split-bill")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--white)",
                  fontSize: 11,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              className="outline-btn"
              onClick={() => navigate("/split-bill")}
              style={{
                flex: 1,
                padding: "12px 10px",
                fontSize: 13,
                borderColor: isSplitActive ? "var(--gold)" : "var(--border)",
                color: isSplitActive ? "var(--gold)" : "var(--white)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Users2 size={16} color="var(--gold)" />
              {isSplitActive ? `Split Bill (${diners.length})` : "Split Bill"}
            </button>

            <button
              type="button"
              className="gold-btn"
              disabled={requestingBill}
              onClick={handleFinalBillClick}
              style={{
                flex: 1.3,
                padding: "12px 10px",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {requestingBill ? <Loader2 size={16} className="spin" /> : <Receipt size={16} />}
              {requestingBill ? "Finalizing bill…" : isBillRequested ? "View Current Final Bill" : "Request Final Bill"}
            </button>
          </div>
        </div>
      )}

      {/* Unsent Items Confirmation Modal */}
      {showUnsentConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 150,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 360, width: "100%", padding: 20, textAlign: "center" }}>
            <AlertTriangle size={32} color="var(--gold)" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 17, marginBottom: 8 }}>
              Unsent Items in Cart
            </h3>
            <p style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.5, marginBottom: 18 }}>
              You have {cartDishes.length} unsent {cartDishes.length === 1 ? "dish" : "dishes"} in your cart. Would you like to send them to the kitchen before generating your final bill?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="gold-btn"
                onClick={handleSendAndRequestBill}
              >
                Send & Request Final Bill
              </button>
              <button
                type="button"
                className="outline-btn"
                onClick={() => setShowUnsentConfirmModal(false)}
              >
                Return to Editing Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Feedback Popup before Final Bill */}
      <FeedbackModal
        open={showFeedbackModal}
        tableNumber={tableNumber}
        onClose={() => setShowFeedbackModal(false)}
        onComplete={handleFeedbackComplete}
      />
    </div>
  );
}
