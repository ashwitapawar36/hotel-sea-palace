import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";

export default function DishCard(props) {
  const dish = props.item || props.dish || {};
  const { cart, add, setQty } = useCart();
  const { showToast } = useToast();

  const [flash, setFlash] = useState(false);
  const [variantIndex, setVariantIndex] = useState(0);

  const hasVariants =
    Array.isArray(dish.variants) && dish.variants.length > 0;

  const selectedVariant = hasVariants
    ? dish.variants[variantIndex] || dish.variants[0]
    : null;

  const cartKey = selectedVariant
    ? `${dish.id}::${selectedVariant.id}`
    : String(dish.id);

  const count = cart[cartKey] || 0;
  const displayPrice = Number(
    selectedVariant ? selectedVariant.price : dish.price
  );

  const isAvailable = dish.available !== false;
  const description = dish.desc || dish.category;

  const flashButton = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

  const handleAdd = () => {
    if (!isAvailable) return;

    add(dish, selectedVariant);
    showToast(
      `${dish.name}${
        selectedVariant ? ` (${selectedVariant.label})` : ""
      } added to cart`
    );
    flashButton();
  };

  const handleIncrement = () => {
    if (!isAvailable) return;

    add(dish, selectedVariant);
    flashButton();
  };

  const handleDecrement = () => {
    setQty(cartKey, count - 1);
    flashButton();
  };

  const quantityButtonStyle = {
    width: 36,
    height: 36,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    color: "var(--bg)",
    cursor: "pointer",
  };

  return (
    <div
      className="card"
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        opacity: isAvailable ? 1 : 0.6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <p
          style={{
            flex: "1 1 100px",
            fontFamily: "Poppins,sans-serif",
            color: "var(--white)",
            fontSize: 14,
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.45,
            overflowWrap: "anywhere",
          }}
        >
          {dish.name}
        </p>

        <span
          style={{
            fontFamily: "Poppins,sans-serif",
            color: "var(--gold)",
            fontSize: 14,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {Number.isFinite(displayPrice)
            ? `₹${displayPrice.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}`
            : "—"}
        </span>
      </div>

      {description && (
        <p
          style={{
            fontFamily: "Inter,sans-serif",
            color: "var(--muted)",
            fontSize: 11.5,
            lineHeight: 1.5,
            margin: "0 0 12px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </p>
      )}

      {!isAvailable && (
        <span
          style={{
            alignSelf: "flex-start",
            color: "#ff8a80",
            background: "rgba(229,57,53,0.12)",
            borderRadius: 6,
            padding: "4px 8px",
            marginBottom: 10,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Unavailable
        </span>
      )}

      {hasVariants && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {dish.variants.map((variant, index) => {
            const active = variant.id === selectedVariant.id;

            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => setVariantIndex(index)}
                aria-pressed={active}
                style={{
                  padding: "5px 9px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "Poppins,sans-serif",
                  border: `1px solid ${
                    active ? "var(--gold)" : "var(--border)"
                  }`,
                  background: active
                    ? "var(--gold-dim)"
                    : "transparent",
                  color: active ? "var(--gold)" : "var(--muted)",
                  cursor: "pointer",
                }}
              >
                {variant.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: "auto" }}>
        {count === 0 ? (
          <button
            type="button"
            disabled={!isAvailable}
            onClick={handleAdd}
            className={flash ? "add-flash" : ""}
            style={{
              width: "100%",
              minHeight: 38,
              padding: "8px 4px",
              border: "1.5px solid var(--gold)",
              borderRadius: 10,
              background: "transparent",
              color: "var(--gold)",
              fontFamily: "Poppins,sans-serif",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              cursor: isAvailable ? "pointer" : "not-allowed",
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add to Cart
          </button>
        ) : (
          <div
            className={flash ? "add-flash" : ""}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1.5px solid var(--gold)",
              borderRadius: 10,
              background: "var(--gold)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={handleDecrement}
              aria-label={`Remove one ${dish.name}`}
              style={quantityButtonStyle}
            >
              <Minus size={15} strokeWidth={2.5} />
            </button>

            <span
              style={{
                fontFamily: "Poppins,sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--bg)",
              }}
            >
              {count}
            </span>

            <button
              type="button"
              disabled={!isAvailable}
              onClick={handleIncrement}
              aria-label={`Add one more ${dish.name}`}
              style={{
                ...quantityButtonStyle,
                cursor: isAvailable ? "pointer" : "not-allowed",
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}