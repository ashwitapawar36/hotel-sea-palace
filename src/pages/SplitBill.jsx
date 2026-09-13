import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Sparkles, Trash2, Users2, ReceiptText, ArrowLeft, Receipt, Utensils } from "lucide-react";
import TopBar from "../components/TopBar";
import { useCart } from "../context/CartContext";

export default function SplitBill() {
  const navigate = useNavigate();
  const {
    diners,
    assignments,
    addDiner,
    updateDinerName,
    removeDiner,
    setDishAssignments,
    applyEqualSplit,
    resetSplit,
    isSplitActive,
    setIsSplitActive,
    dishesToSplit,
    splitSubtotal,
    splitTaxAmount,
    splitTotalAmount,
    splitDinerShares,
    tableNumber,
    activeBill,
    visitOrders,
  } = useCart();

  const [selectedDishId, setSelectedDishId] = useState(dishesToSplit[0]?.id || null);

  useEffect(() => {
    if (dishesToSplit.length > 0 && (!selectedDishId || !dishesToSplit.some((d) => d.id === selectedDishId))) {
      setSelectedDishId(dishesToSplit[0].id);
    }
  }, [dishesToSplit, selectedDishId]);

  const selectedDish = dishesToSplit.find((d) => d.id === selectedDishId) || dishesToSplit[0];

  const dinerTotal = (dinerId) => splitDinerShares.get(dinerId) || 0;

  const perPersonTotal = diners.length > 0 ? Math.round(splitTotalAmount / diners.length) : 0;

  const toggleDishForPerson = (dishId, dinerId) => {
    const current = assignments[dishId] || [];
    if (current.includes(dinerId)) {
      setDishAssignments(dishId, current.filter((id) => id !== dinerId));
    } else {
      setDishAssignments(dishId, [...current, dinerId]);
    }
    setIsSplitActive(true);
  };

  return (
    <div className="app-shell">
      <TopBar title="Split Bill" />
      <div className="page" style={{ padding: "16px 16px 150px" }}>
        {/* Banner */}
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 14,
            background: "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(28,33,48,0.95))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={16} color="var(--gold)" />
            <span style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>
              {activeBill ? "Consolidated Bill Split" : "Visit Split Preview"}
            </span>
          </div>
          <p style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Share the bill your way
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
            {activeBill
              ? "Your final bill is consolidated. Adjust individual shares below; totals remain exact to the paise."
              : "Preview shares across all confirmed rounds. Unsent items in your cart stay out until submitted."}
          </p>
          <p style={{ color: "var(--gold)", fontSize: 11, marginTop: 8, fontWeight: 700 }}>
            Table {tableNumber} {activeBill ? `· Invoice ${activeBill.bill_number}` : `· ${dishesToSplit.length} ordered items`}
          </p>
        </div>

        {/* Empty state: No submitted dishes */}
        {dishesToSplit.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <Utensils size={32} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              No submitted dishes to split
            </p>
            <p style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6, marginBottom: 18 }}>
              Split bill applies to dishes already ordered and sent to the kitchen. Add items to your cart and place your order first!
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                className="outline-btn"
                style={{ maxWidth: 140, fontSize: 12.5 }}
                onClick={() => navigate("/cart")}
              >
                View Cart
              </button>
              <button
                type="button"
                className="gold-btn"
                style={{ maxWidth: 140, fontSize: 12.5 }}
                onClick={() => navigate("/menu")}
              >
                Browse Menu
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Diners list header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p className="section-title" style={{ marginBottom: 0 }}>
                Diners ({diners.length})
              </p>
              <button
                type="button"
                className="icon-btn"
                style={{ width: 34, height: 34 }}
                onClick={addDiner}
                aria-label="Add diner"
              >
                <Plus size={15} color="var(--gold)" />
              </button>
            </div>

            {/* Diners list cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {diners.map((diner, index) => (
                <div key={diner.id} className="card" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--gold-dim)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--gold)",
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {diner.name?.trim()?.charAt(0)?.toUpperCase() || "G"}
                      </div>
                      <input
                        type="text"
                        value={diner.name}
                        onChange={(e) => updateDinerName(diner.id, e.target.value)}
                        placeholder={`Person ${index + 1}`}
                        className="text-input"
                        style={{ padding: "8px 12px", borderRadius: 10, maxWidth: 150, fontSize: 13 }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                        ₹{dinerTotal(diner.id).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {diners.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 30, height: 30 }}
                          onClick={() => removeDiner(diner.id)}
                          aria-label="Remove diner"
                        >
                          <Trash2 size={13} color="var(--red)" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick split action buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <button
                type="button"
                className="gold-btn"
                style={{ flex: 1, padding: "10px 0", fontSize: 12 }}
                onClick={applyEqualSplit}
              >
                <Users2 size={14} /> Equal split
              </button>
              <button
                type="button"
                className="outline-btn"
                style={{ flex: 1, padding: "10px 0", fontSize: 12 }}
                onClick={() => {
                  setDishAssignments({}, []);
                  resetSplit();
                }}
              >
                Reset split
              </button>
            </div>

            {/* Split by item section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p className="section-title" style={{ marginBottom: 0 }}>Split by item</p>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {dishesToSplit.length} items
              </span>
            </div>
            <div className="section-underline" />

            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
              {dishesToSplit.map((dish) => (
                <button
                  key={dish.id}
                  type="button"
                  onClick={() => setSelectedDishId(dish.id)}
                  className={`chip ${selectedDish?.id === dish.id ? "active" : ""}`}
                  style={{ padding: "8px 12px", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {dish.name}
                </button>
              ))}
            </div>

            {selectedDish && (
              <div className="card" style={{ padding: 14, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 700 }}>
                      {selectedDish.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)" }}>
                      Qty {selectedDish.qty} · ₹{Number(selectedDish.lineTotal || selectedDish.price * selectedDish.qty).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 13 }}>
                    ₹{Number(selectedDish.lineTotal || selectedDish.price * selectedDish.qty).toLocaleString("en-IN")}
                  </span>
                </div>

                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                  Assign to diners (unassigned dishes are shared equally):
                </p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {diners.map((diner, index) => {
                    const checked = (assignments[selectedDish.id] || []).includes(diner.id);
                    const displayName = diner.name?.trim() || `Person ${index + 1}`;
                    return (
                      <button
                        key={diner.id}
                        type="button"
                        onClick={() => toggleDishForPerson(selectedDish.id, diner.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: `1.5px solid ${checked ? "var(--gold)" : "var(--border)"}`,
                          background: checked ? "var(--gold-dim)" : "transparent",
                          color: checked ? "var(--gold)" : "var(--muted)",
                          fontSize: 11,
                          fontFamily: "Poppins,sans-serif",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            border: `1.5px solid ${checked ? "var(--gold)" : "var(--muted)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: checked ? "var(--gold)" : "transparent",
                          }}
                        >
                          {checked && <Check size={9} color="var(--bg)" strokeWidth={3} />}
                        </span>
                        {displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Financial Summary Card */}
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                <span>Subtotal ({dishesToSplit.length} items)</span>
                <span>₹{splitSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                <span>Combined Taxes (GST 5% / VAT 10%)</span>
                <span>₹{splitTaxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Poppins,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--white)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <span>Total Amount</span>
                <span style={{ color: "var(--gold)" }}>₹{splitTotalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "rgba(13,17,23,0.97)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--border)",
          padding: 16,
          zIndex: 30,
        }}
      >
        <button
          type="button"
          className="gold-btn"
          onClick={() => navigate(activeBill ? "/bill" : "/cart")}
        >
          {activeBill ? <ReceiptText size={16} /> : <ArrowLeft size={16} />}
          {activeBill ? "Return to Final Bill" : "Return to My Orders"}
        </button>
      </div>
    </div>
  );
}
