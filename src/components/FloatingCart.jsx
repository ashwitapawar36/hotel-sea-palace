import { ShoppingCart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

const HIDDEN_ON = ["/cart", "/split-bill", "/bill", "/order-success"];
const MANAGER_PREFIX = "/manager";

export default function FloatingCart() {
  const { cartCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const shouldHide =
    HIDDEN_ON.includes(location.pathname) || location.pathname.startsWith(MANAGER_PREFIX) || cartCount === 0;

  if (shouldHide) return null;

  return (
    <div className="floating-cart-wrap">
      <button className="floating-cart" onClick={() => navigate("/cart")} aria-label={`Cart, ${cartCount} items`}>
        <ShoppingCart size={24} color="var(--bg)" strokeWidth={2.2} />
        <span key={cartCount} className="floating-cart-badge badge-pop">
          {cartCount}
        </span>
      </button>
    </div>
  );
}
