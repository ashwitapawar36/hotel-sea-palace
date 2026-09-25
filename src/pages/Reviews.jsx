import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Reviews() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/feedback/public").then((res) => setReviews(res?.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return <div className="app-shell"><div className="page" style={{ padding: "24px 20px 40px" }}>
    <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft size={20} color="var(--white)" /></button>
    <h1 style={{ fontFamily: "Playfair Display,serif", color: "var(--gold)", textAlign: "center", margin: "20px 0 8px" }}>Guest Reviews</h1>
    <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", marginBottom: 24 }}>What our guests say about their experience.</p>
    {loading ? <div style={{ textAlign: "center" }}><Loader2 className="spin" color="var(--gold)" /></div> : reviews.length === 0 ? <div className="card" style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Reviews will appear here after guests share their experience.</div> : reviews.map((review, index) => <article className="card" key={`${review.created_at}-${index}`} style={{ marginBottom: 12 }}><div style={{ color: "var(--gold)", marginBottom: 8 }}>{"★".repeat(Number(review.rating || 0))}</div><p style={{ color: "var(--white)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{review.comment}</p><small style={{ color: "var(--muted)" }}>Guest</small></article>)}
  </div></div>;
}
