import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Hash, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useCart } from "../context/CartContext";
import FeedbackModal from "../components/FeedbackModal";
import { api } from "../services/api";

const STATUS_POLL_MS = 8000;
const FEEDBACK_DELAY_MS = 1400;

export default function OrderSuccess() {
  const navigate = useNavigate();
  const { lastOrder, tableNumber } = useCart();
  const [showFeedback, setShowFeedback] = useState(false);
  const [status, setStatus] = useState(lastOrder ? "pending" : null);
  // Guards the *automatic* prompt only - it must fire at most once per
  // successful order, even if this effect re-runs (e.g. React StrictMode's
  // dev double-invoke). The manual "Rate Your Experience" button is
  // untouched by this and can always reopen the modal.
  const autoPromptedRef = useRef(false);

  // The order itself was already created (with server-computed prices) back
  // on the Digital Bill screen - this page confirms it and then polls the
  // real order status so the guest can see the kitchen actually move it
  // along (pending -> accepted -> preparing -> ready -> completed), the same
  // status a manager sets from Order Management.
  useEffect(() => {
    if (!lastOrder?.id) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await api.get(`/orders/${lastOrder.id}/status`);
        if (!cancelled) setStatus(res.data.status);
      } catch {
        // Keep showing the last known status if a poll fails.
      }
    };

    poll();
    const intervalId = window.setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [lastOrder?.id]);

  useEffect(() => {
    const colors = ["#D4AF37", "#FFFFFF", "#8B949E"];
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.4 }, colors, scalar: 0.9 });
    const t1 = setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.3 }, colors, scalar: 0.7 }), 350);
    return () => clearTimeout(t1);
  }, []);

  // Auto-prompt for feedback once we can actually confirm this is a real,
  // successfully placed order (lastOrder.id) - not a bare timer fired on
  // mount regardless of whether an order exists. The short delay just lets
  // the confetti land before the sheet slides up; it's layered on top of
  // the real gating condition, not a substitute for it.
  useEffect(() => {
    if (!lastOrder?.id || autoPromptedRef.current) return undefined;
    const t2 = setTimeout(() => {
      autoPromptedRef.current = true;
      setShowFeedback(true);
    }, FEEDBACK_DELAY_MS);
    return () => clearTimeout(t2);
  }, [lastOrder?.id]);

  const statusLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";

  return (
    <div className="app-shell">
      <div className="page" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: "50%",
            background: "var(--gold-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <CheckCircle2 size={54} color="var(--gold)" strokeWidth={1.6} />
        </div>

        <h1 style={{ fontFamily: "Playfair Display,serif", fontSize: 23, fontWeight: 800, color: "var(--white)", marginBottom: 10 }}>
          Order Placed Successfully!
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
          {lastOrder ? `Order ${lastOrder.order_number} has been sent to the kitchen.` : "Your order has been sent to the kitchen."}
        </p>

        <div style={{ display: "flex", gap: 12, width: "100%", marginBottom: 32 }}>
          <div className="card" style={{ flex: 1, padding: "16px 10px" }}>
            {status ? <Clock size={18} color="var(--gold)" style={{ marginBottom: 8 }} /> : <Loader2 size={18} className="spin" color="var(--gold)" style={{ marginBottom: 8 }} />}
            <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Order Status</p>
            <p style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: 15, color: "var(--white)" }}>{statusLabel}</p>
          </div>
          <div className="card" style={{ flex: 1, padding: "16px 10px" }}>
            <Hash size={18} color="var(--gold)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Table No.</p>
            <p style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: 15, color: "var(--white)" }}>{tableNumber ?? "—"}</p>
          </div>
        </div>

        <button className="gold-btn" style={{ marginBottom: 10 }} onClick={() => setShowFeedback(true)}>
          Rate Your Experience
        </button>
        <button className="outline-btn" onClick={() => navigate("/")}>
          Back to Home
        </button>
      </div>

      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} orderId={lastOrder?.id} />
    </div>
  );
}
