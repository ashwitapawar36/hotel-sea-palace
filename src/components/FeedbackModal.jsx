import { useState } from "react";
import { Star, X, Loader2 } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { submitVisitFeedback } from "../services/visits";

export default function FeedbackModal({ open, onClose, onComplete, tableNumber }) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!open && !closing) return null;

  const closeWith = (callback) => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setRating(0);
      setText("");
      if (callback) callback();
      if (onClose) onClose();
    }, 220);
  };

  const handleSkip = () => {
    closeWith(() => {
      if (onComplete) onComplete({ skipped: true });
    });
  };

  const submit = async () => {
    if (rating === 0) return;

    setSubmitting(true);
    try {
      if (tableNumber) {
        await submitVisitFeedback(tableNumber, {
          rating,
          comment: text.trim() || undefined,
        });
      }
      showToast("Thank you for your feedback!");
      closeWith(() => {
        if (onComplete) onComplete({ submitted: true, rating });
      });
    } catch (err) {
      showToast(err?.message || "Could not submit feedback. Proceeding to bill.");
      closeWith(() => {
        if (onComplete) onComplete({ skipped: true });
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      aria-describedby="feedback-description"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={handleSkip}
        className={closing ? "modal-backdrop-out" : "modal-backdrop-in"}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }}
      />
      <div
        className={closing ? "modal-sheet-out" : "modal-sheet-in"}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: "20px 20px calc(24px + env(safe-area-inset-bottom))",
        }}
      >
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 18px" }} />

        <button
          type="button"
          onClick={handleSkip}
          aria-label="Skip feedback"
          className="icon-btn"
          style={{ position: "absolute", top: 16, right: 16, border: "none" }}
        >
          <X size={16} color="var(--muted)" />
        </button>

        <h2 id="feedback-title" style={{ fontFamily: "Playfair Display,serif", color: "var(--gold)", fontSize: 19, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>
          How was your dining experience?
        </h2>
        <p id="feedback-description" style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginBottom: 20 }}>
          Optional feedback helps our kitchen and staff serve you better.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer" }}
            >
              <Star
                size={30}
                color="var(--gold)"
                fill={(hover || rating) >= n ? "var(--gold)" : "transparent"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        <label className="field-label">Comments (optional)</label>
        <textarea
          className="text-input"
          rows={3}
          placeholder="Tell us what you loved or how we can improve..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ resize: "none", marginBottom: 18 }}
        />

        <button
          type="button"
          className="gold-btn"
          disabled={rating === 0 || submitting}
          onClick={submit}
          style={{ marginBottom: 10 }}
        >
          {submitting ? <Loader2 size={16} className="spin" /> : null}
          {submitting ? "Submitting…" : "Submit Feedback"}
        </button>
        <button
          type="button"
          className="outline-btn"
          onClick={handleSkip}
        >
          Skip & View Final Bill
        </button>
      </div>
    </div>
  );
}
