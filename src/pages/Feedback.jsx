import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Loader2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { api, ApiError } from "../services/api";

export default function Feedback() {
  const navigate = useNavigate();
  const { lastOrder } = useCart();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [recommend, setRecommend] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/feedback", {
        orderId: lastOrder.id,
        rating,
        comment: text.trim() || undefined,
        recommend: recommend === null ? undefined : recommend === "yes",
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Feedback for this order already exists - that's still a "done"
        // state from the guest's point of view, not a failure.
        setSubmitted(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not submit feedback. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="app-shell">
        <div className="page" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
          <h1 style={{ fontFamily: "Playfair Display,serif", color: "var(--gold)", fontSize: 21, fontWeight: 800, marginBottom: 10 }}>Thank You!</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 26 }}>Your feedback helps us serve you better.</p>
          <button className="gold-btn" onClick={() => navigate("/")}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="page" style={{ padding: "40px 20px" }}>
        <h1 style={{ fontFamily: "Playfair Display,serif", color: "var(--gold)", fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 30 }}>
          Thank You!
        </h1>

        {!lastOrder ? (
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginBottom: 14 }}>
            Place an order first so we know which visit your feedback is about.
          </p>
        ) : (
          <>
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginBottom: 14 }}>How was your dining experience?</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 30 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  style={{ background: "transparent", border: "none", padding: 4 }}
                >
                  <Star
                    size={32}
                    color="var(--gold)"
                    fill={(hover || rating) >= n ? "var(--gold)" : "transparent"}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>

            <label className="field-label">Share your dining experience</label>
            <textarea
              className="text-input"
              rows={4}
              placeholder="Tell us what you loved, or what we can improve..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ resize: "none", marginBottom: 22 }}
            />

            <label className="field-label">Would you recommend us?</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {["yes", "no"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setRecommend(opt)}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 50,
                    border: `1.5px solid ${recommend === opt ? "var(--gold)" : "var(--border)"}`,
                    background: recommend === opt ? "var(--gold)" : "transparent",
                    color: recommend === opt ? "var(--bg)" : "var(--white)",
                    fontFamily: "Poppins,sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    textTransform: "capitalize",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>

            {error && <p style={{ color: "var(--red, #e53935)", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{error}</p>}

            <button className="gold-btn" disabled={rating === 0 || submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 size={16} className="spin" /> : null}
              {submitting ? "Submitting…" : "Submit Feedback"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
