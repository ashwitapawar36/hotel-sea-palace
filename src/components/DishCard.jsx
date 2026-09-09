import { useState } from "react";
import { Plus, Minus, UtensilsCrossed } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

export default function DishCard({ dish }) {
  const { cart, add, setQty } = useCart();
  const { showToast } = useToast();
  const [flash, setFlash] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const hasVariants = Array.isArray(dish.variants) && dish.variants.length > 0;
  const [variantIndex, setVariantIndex] = useState(0);
  const selectedVariant = hasVariants ? dish.variants[variantIndex] : null;

  const cartKey = hasVariants ? `${dish.id}::${selectedVariant.id}` : String(dish.id);
  const count = cart[cartKey] || 0;
  const displayPrice = hasVariants ? selectedVariant.price : dish.price;
  const isAvailable = dish.available !== false;

  const flashButton = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

  const handleAdd = () => {
    add(dish, selectedVariant);
    showToast(`${dish.name}${hasVariants ? ` (${selectedVariant.label})` : ""} added to cart`);
    flashButton();
  };

  const handleIncrement = () => {
    add(dish, selectedVariant);
    flashButton();
  };

  const handleDecrement = () => {
    setQty(cartKey, count - 1);
    flashButton();
  };

  return (
    <div
      className="card"
      style={{
        overflow: "hidden",
        opacity: isAvailable ? 1 : 0.5,
      }}
    >
      <div style={{ position: "relative", height: 110, background: "#111" }}>
        {dish.image && !imageFailed ? (
          <img
            src={dish.image}
            alt={dish.name}
            onError={() => setImageFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #1a1a1a, #262626)",
            }}
          >
            <UtensilsCrossed size={26} color="var(--muted)" strokeWidth={1.5} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            borderRadius: 8,
            padding: "3px 8px",
          }}
        >
          <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--gold)", fontSize: 12, fontWeight: 700 }}>
            ₹{displayPrice.toLocaleString("en-IN")}
          </span>
        </div>
        {!isAvailable && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "Poppins,sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--white)",
                background: "rgba(229,57,53,0.85)",
                padding: "4px 10px",
                borderRadius: 8,
                letterSpacing: "0.04em",
              }}
            >
              Unavailable
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: "10px 10px 12px" }}>
        <p style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 12.5, fontWeight: 600, marginBottom: 3, lineHeight: 1.35 }}>
          {dish.name}
        </p>
        <p
          style={{
            fontFamily: "Inter,sans-serif",
            color: "var(--muted)",
            fontSize: 10.5,
            lineHeight: 1.5,
            marginBottom: hasVariants ? 8 : 10,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {dish.desc || dish.category}
        </p>

        {hasVariants && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {dish.variants.map((v, i) => {
              const active = i === variantIndex;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantIndex(i)}
                  aria-pressed={active}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 8,
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: "Poppins,sans-serif",
                    lineHeight: 1.6,
                    border: `1.3px solid ${active ? "var(--gold)" : "var(--border)"}`,
                    background: active ? "var(--gold-dim)" : "transparent",
                    color: active ? "var(--gold)" : "var(--muted)",
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}

        {count === 0 ? (
          <button
            disabled={!isAvailable}
            onClick={handleAdd}
            className={flash ? "add-flash" : ""}
            style={{
              width: "100%",
              padding: "8px 0",
              border: "1.5px solid var(--gold)",
              borderRadius: 10,
              background: "transparent",
              color: "var(--gold)",
              fontFamily: "Poppins,sans-serif",
              fontSize: 11.5,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <Plus size={12} strokeWidth={2.5} />
            Add to Cart
          </button>
        ) : (
          <div
            className={flash ? "add-flash" : ""}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              border: "1.5px solid var(--gold)",
              borderRadius: 10,
              background: "var(--gold)",
              overflow: "hidden",
            }}
          >
            <button
              onClick={handleDecrement}
              aria-label="Remove one"
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "var(--bg)",
              }}
            >
              <Minus size={13} strokeWidth={2.5} />
            </button>
            <span style={{ fontFamily: "Poppins,sans-serif", fontSize: 12, fontWeight: 700, color: "var(--bg)" }}>{count}</span>
            <button
              disabled={!isAvailable}
              onClick={handleIncrement}
              aria-label="Add one more"
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "var(--bg)",
              }}
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
