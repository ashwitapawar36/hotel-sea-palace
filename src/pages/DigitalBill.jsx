import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Waves, Users2, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import TopBar from "../components/TopBar";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import {
  requestFinalBill,
  downloadVisitBillPdf,
} from "../services/visits";

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DigitalBill() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    tableNumber,
    visit,
    activeBill,
    refreshVisit,
    startFreshVisitSession,
    isVisitClosed,
    visitOrders,
    diners,
    isSplitActive,
    splitDinerShares,
  } = useCart();

  const [loading, setLoading] = useState(!activeBill);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [finalizingError, setFinalizingError] = useState("");

  const loadBill = useCallback(async () => {
    setLoading(true);
    setFinalizingError("");
    try {
      await requestFinalBill(tableNumber);
      await refreshVisit();
    } catch (err) {
      setFinalizingError(err?.message || "Could not retrieve the final bill.");
    } finally {
      setLoading(false);
    }
  }, [tableNumber, refreshVisit]);

  // Ensure bill is generated if not already loaded
  useEffect(() => {
    if (!activeBill && visitOrders.length > 0 && !isVisitClosed) {
      loadBill();
    } else {
      setLoading(false);
    }
  }, [activeBill, visitOrders.length, isVisitClosed, loadBill]);

  const handleDownloadPdf = async () => {
    if (!activeBill || downloading) return;
    setDownloading(true);
    setDownloadError("");

    try {
      await downloadVisitBillPdf(tableNumber, activeBill.bill_number);
      showToast("Invoice PDF downloaded successfully!");
    } catch (err) {
      setDownloadError(err?.message || "PDF download failed. Please click retry.");
    } finally {
      setDownloading(false);
    }
  };

  const rawSnapshot = activeBill?.items_snapshot;
  const billedItems = Array.isArray(rawSnapshot)
    ? rawSnapshot
    : typeof rawSnapshot === "string"
      ? JSON.parse(rawSnapshot || "[]")
      : [];

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  };

  return (
    <div className="app-shell">
      <TopBar title="Final Bill" />

      <div className="page" style={{ padding: "16px 16px 140px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80, gap: 12 }}>
            <Loader2 size={28} className="spin" color="var(--gold)" />
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Preparing your consolidated invoice…</p>
          </div>
        ) : isVisitClosed && !activeBill ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <AlertCircle size={32} color="var(--gold)" style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 18, marginBottom: 8 }}>
              Dining Visit Concluded
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
              This visit has been closed by management. Thank you for dining with Hotel Sea Palace.
            </p>
            <button className="gold-btn" onClick={startFreshVisitSession} style={{ maxWidth: 180, margin: "0 auto" }}>
              Start New Visit
            </button>
          </div>
        ) : finalizingError && !activeBill ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <AlertCircle size={28} color="var(--red)" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 14 }}>{finalizingError}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="outline-btn" style={{ maxWidth: 140 }} onClick={loadBill}>
                <RefreshCw size={13} /> Retry
              </button>
              <button className="gold-btn" style={{ maxWidth: 140 }} onClick={() => navigate("/cart")}>
                Return to Cart
              </button>
            </div>
          </div>
        ) : !activeBill ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              No active bill found. Please submit dishes before requesting your final bill.
            </p>
            <button className="gold-btn" onClick={() => navigate("/menu")} style={{ maxWidth: 180, margin: "0 auto" }}>
              Browse Menu
            </button>
          </div>
        ) : (
          <>
            {/* Reopened visit notice */}
            {visit?.status === "open" && (
              <div className="card" style={{ padding: 14, marginBottom: 14, borderLeft: "3px solid var(--gold)" }}>
                <p style={{ color: "var(--gold)", fontWeight: 600, fontSize: 13 }}>Visit Reopened</p>
                <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                  The manager has reopened your visit. You can add more dishes from the menu.
                </p>
                <button
                  className="outline-btn"
                  style={{ marginTop: 8, padding: "6px 12px", fontSize: 11.5 }}
                  onClick={() => navigate("/menu")}
                >
                  Add More Items
                </button>
              </div>
            )}

            {/* Final Bill Card */}
            <div className="card bill-card" style={{ padding: 20 }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <Waves size={24} color="var(--gold)" />
                <h2 style={{ color: "var(--gold)", fontFamily: "Playfair Display, serif", marginTop: 8, fontSize: 20 }}>
                  Hotel Sea Palace
                </h2>
                <p style={{ color: "var(--muted)", fontSize: 11.5 }}>
                  Beach Road, Alibaug · +91 74983 40889
                </p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "4px 10px", borderRadius: 999, background: "var(--gold-dim)" }}>
                  <CheckCircle2 size={12} color="var(--gold)" />
                  <span style={{ fontSize: 10.5, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Consolidated Bill {activeBill.revision > 1 ? `(Rev #${activeBill.revision})` : ""}
                  </span>
                </div>
              </div>

              <div style={rowStyle}>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Table</span>
                <strong style={{ color: "var(--white)", fontSize: 13 }}>Table {tableNumber}</strong>
              </div>

              <div style={rowStyle}>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Invoice Number</span>
                <strong style={{ color: "var(--white)", fontSize: 12, fontFamily: "monospace" }}>
                  {activeBill.bill_number}
                </strong>
              </div>

              <div style={rowStyle}>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Date & Time</span>
                <span style={{ color: "var(--white)", fontSize: 12 }}>
                  {new Date(activeBill.created_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Items from all rounds snapshot */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  padding: "12px 0",
                  margin: "14px 0",
                }}
              >
                <p style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  Billed Items ({billedItems.length})
                </p>
                {billedItems.map((item, idx) => (
                  <div key={item.id || idx} style={rowStyle}>
                    <span style={{ fontSize: 12.5, color: "var(--white)" }}>
                      {item.name}
                      {item.variantLabel || item.variant_label ? ` (${item.variantLabel || item.variant_label})` : ""} × {item.quantity}
                    </span>
                    <strong style={{ fontSize: 12.5, color: "var(--white)", whiteSpace: "nowrap" }}>
                      {money(item.lineTotal || item.line_total)}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Taxes calculated on combined applicable subtotals */}
              {Number(activeBill.food_subtotal) > 0 && (
                <div style={{ ...rowStyle, color: "var(--muted)", fontSize: 12 }}>
                  <span>Food Subtotal</span>
                  <span>{money(activeBill.food_subtotal)}</span>
                </div>
              )}

              {Number(activeBill.cgst_amount) > 0 && (
                <div style={{ ...rowStyle, color: "var(--muted)", fontSize: 12 }}>
                  <span>CGST (2.5%)</span>
                  <span>{money(activeBill.cgst_amount)}</span>
                </div>
              )}

              {Number(activeBill.sgst_amount) > 0 && (
                <div style={{ ...rowStyle, color: "var(--muted)", fontSize: 12 }}>
                  <span>SGST (2.5%)</span>
                  <span>{money(activeBill.sgst_amount)}</span>
                </div>
              )}

              {Number(activeBill.alcohol_subtotal) > 0 && (
                <div style={{ ...rowStyle, color: "var(--muted)", fontSize: 12 }}>
                  <span>Alcohol Subtotal</span>
                  <span>{money(activeBill.alcohol_subtotal)}</span>
                </div>
              )}

              {Number(activeBill.vat_amount) > 0 && (
                <div style={{ ...rowStyle, color: "var(--muted)", fontSize: 12 }}>
                  <span>VAT (10%)</span>
                  <span>{money(activeBill.vat_amount)}</span>
                </div>
              )}

              {Number(activeBill.discount_amount) > 0 && (
                <div style={{ ...rowStyle, color: "var(--muted)", fontSize: 12 }}>
                  <span>Discount</span>
                  <span>−{money(activeBill.discount_amount)}</span>
                </div>
              )}

              <div
                style={{
                  ...rowStyle,
                  borderTop: "1px dashed var(--border)",
                  paddingTop: 12,
                  marginTop: 6,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                <span style={{ color: "var(--white)" }}>Total Payable</span>
                <span style={{ color: "var(--gold)", fontSize: 18 }}>
                  {money(activeBill.total_amount)}
                </span>
              </div>

              {/* Diner Split Breakdown (if splitting was configured) */}
              {isSplitActive && diners.length > 0 && (
                <div
                  style={{
                    marginTop: 18,
                    padding: "14px 16px",
                    background: "rgba(212, 175, 55, 0.08)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users2 size={16} color="var(--gold)" />
                      <span style={{ fontFamily: "Poppins, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>
                        Diner Split Shares ({diners.length} {diners.length === 1 ? "person" : "people"})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/split-bill")}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--gold)",
                        fontSize: 11.5,
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      Adjust Split
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {diners.map((diner, index) => {
                      const share = splitDinerShares.get(diner.id) || 0;
                      const displayName = diner.name?.trim() || `Person ${index + 1}`;
                      return (
                        <div
                          key={diner.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12.5,
                            borderBottom: index < diners.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                            paddingBottom: index < diners.length - 1 ? 6 : 0,
                          }}
                        >
                          <span style={{ color: "var(--white)", fontWeight: 500 }}>
                            {displayName}
                          </span>
                          <span style={{ color: "var(--gold)", fontWeight: 700, fontFamily: "Poppins, sans-serif" }}>
                            ₹{share.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* PDF Error Display with Retry */}
            {downloadError && (
              <div className="card" style={{ padding: 12, marginTop: 12, borderLeft: "3px solid var(--red)" }}>
                <p style={{ color: "var(--red)", fontSize: 12 }}>{downloadError}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky Bottom Actions */}
      {activeBill && (
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
          }}
        >
          <button
            type="button"
            className="gold-btn"
            disabled={downloading}
            onClick={handleDownloadPdf}
            style={{ fontSize: 14 }}
          >
            {downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            {downloading ? "Downloading PDF…" : "Download Invoice (PDF)"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="outline-btn"
              style={{ flex: 1, fontSize: 12.5 }}
              onClick={() => navigate("/split-bill")}
            >
              <Users2 size={14} /> Split Bill
            </button>

            <button
              type="button"
              className="outline-btn"
              style={{ flex: 1, fontSize: 12.5 }}
              onClick={() => navigate("/cart")}
            >
              <ArrowLeft size={14} /> View Rounds
            </button>
          </div>
        </div>
      )}
    </div>
  );
}