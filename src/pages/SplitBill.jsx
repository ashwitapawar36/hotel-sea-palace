import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Sparkles, Trash2, Users2, ReceiptText } from "lucide-react";
import TopBar from "../components/TopBar";
import { useCart } from "../context/CartContext";
import { computeDinerShares } from "../utils/splitBillCalc";

export default function SplitBill() {
  const navigate = useNavigate();
  const { cartDishes, diners, assignments, toggleAssignment, grandTotal, subtotal, foodSubtotal, alcoholSubtotal, cgst, sgst, vat, taxAmount, addDiner, updateDinerName, removeDiner, setDishAssignments, applyEqualSplit, tableNumber } = useCart();
  const [selectedDishId, setSelectedDishId] = useState(cartDishes[0]?.id || null);

  // Tax-inclusive, remainder-distributed per-diner shares - the same
  // algorithm the backend uses once the order is actually placed, so this
  // preview always matches the real split and always sums to Grand Total.
  // The split itself only needs the combined tax amount (not the
  // CGST/SGST/VAT breakdown) since every diner's share already bakes in
  // their slice of whatever tax applied to their items.
  const dinerShares = useMemo(
    () => computeDinerShares({ diners, dishes: cartDishes, assignments, subtotal, gst: taxAmount, grandTotal }),
    [diners, cartDishes, assignments, subtotal, taxAmount, grandTotal]
  );

  const dinerTotal = (dinerId) => dinerShares.get(dinerId) || 0;

  const perPersonTotal = useMemo(() => {
    if (diners.length === 0) return 0;
    return Math.round(grandTotal / diners.length);
  }, [diners.length, grandTotal]);

  const selectedDish = cartDishes.find((dish) => dish.id === selectedDishId) || cartDishes[0];

  const toggleDishForPerson = (dishId, dinerId) => {
    const current = assignments[dishId] || [];
    if (current.includes(dinerId)) {
      setDishAssignments(dishId, current.filter((id) => id !== dinerId));
    } else {
      setDishAssignments(dishId, [...current, dinerId]);
    }
  };

  const handleSelectDish = (dishId) => {
    setSelectedDishId(dishId);
  };

  return (
    <div className="app-shell">
      <TopBar title="Split Bill" />
      <div className="page" style={{ padding: "16px 16px 150px" }}>
        <div className="card" style={{ padding: 16, marginBottom: 14, background: "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(28,33,48,0.95))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={16} color="var(--gold)" />
            <span style={{ fontSize: 11, color: "var(--gold)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.08em" }}>Premium split</span>
          </div>
          <p style={{ fontFamily: "Playfair Display,serif", color: "var(--white)", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Share the bill your way</p>
          <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>Add people, rename them, split by dish, and keep it fair in seconds.</p>
          <p style={{ color: "var(--gold)", fontSize: 11, marginTop: 8, fontWeight: 700 }}>Table {tableNumber}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>People</p>
          <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={addDiner}>
            <Plus size={15} color="var(--gold)" />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {diners.map((diner) => (
            <div key={diner.id} className="card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold-dim)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontWeight: 700, fontSize: 13 }}>
                    {diner.name?.charAt(0)?.toUpperCase() || "G"}
                  </div>
                  <input
                    value={diner.name}
                    onChange={(e) => updateDinerName(diner.id, e.target.value)}
                    placeholder="Enter name"
                    className="text-input"
                    style={{ padding: "10px 12px", borderRadius: 10, maxWidth: 140 }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontSize: 13, fontWeight: 700 }}>₹{dinerTotal(diner.id).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => removeDiner(diner.id)}>
                    <Trash2 size={13} color="var(--red)" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button className="gold-btn" style={{ flex: 1, padding: "11px 0", fontSize: 12 }} onClick={applyEqualSplit}>
            <Users2 size={14} /> Equal split
          </button>
          <button className="outline-btn" style={{ flex: 1, padding: "11px 0", fontSize: 12 }} onClick={() => setDishAssignments({})}>
            Clear selections
          </button>
        </div>

        <p className="section-title">Split by dish</p>
        <div className="section-underline" />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
          {cartDishes.map((dish) => (
            <button key={dish.id} onClick={() => handleSelectDish(dish.id)} className={`chip ${selectedDish?.id === dish.id ? "active" : ""}`} style={{ padding: "8px 12px" }}>
              {dish.name}
            </button>
          ))}
        </div>

        {selectedDish && (
          <div className="card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 13, fontWeight: 700 }}>{selectedDish.name}</p>
                <p style={{ fontSize: 11, color: "var(--muted)" }}>Qty {selectedDish.qty} • ₹{(selectedDish.price * selectedDish.qty).toLocaleString("en-IN")}</p>
              </div>
              <span style={{ color: "var(--gold)", fontWeight: 700, fontSize: 13 }}>₹{(selectedDish.price * selectedDish.qty).toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {diners.map((diner) => {
                const checked = (assignments[selectedDish.id] || []).includes(diner.id);
                return (
                  <button key={diner.id} onClick={() => toggleDishForPerson(selectedDish.id, diner.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 999, border: `1.5px solid ${checked ? "var(--gold)" : "var(--border)"}`, background: checked ? "var(--gold-dim)" : "transparent", color: checked ? "var(--gold)" : "var(--muted)", fontSize: 11, fontFamily: "Poppins,sans-serif", fontWeight: 600 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${checked ? "var(--gold)" : "var(--muted)"}`, display: "flex", alignItems: "center", justifyContent: "center", background: checked ? "var(--gold)" : "transparent" }}>
                      {checked && <Check size={9} color="var(--bg)" strokeWidth={3} />}
                    </span>
                    {diner.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            <span>Subtotal</span>
            <span>₹{subtotal.toLocaleString("en-IN")}</span>
          </div>
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
          {alcoholSubtotal > 0 && vat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              <span>VAT (10%)</span>
              <span>₹{vat.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            <span>Total per person</span>
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>₹{perPersonTotal.toLocaleString("en-IN")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Poppins,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--white)" }}>
            <span>Grand total</span>
            <span style={{ color: "var(--gold)" }}>₹{grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "rgba(13,17,23,0.97)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--border)", padding: 16 }}>
        <button className="gold-btn" onClick={() => navigate("/bill")}>
          <ReceiptText size={16} /> Generate bills
        </button>
      </div>
    </div>
  );
}
