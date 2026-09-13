import { useState } from "react";
import { Menu as MenuIcon, X, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LINKS = [
  { label: "Home", path: "/" },
  { label: "Menu", path: "/menu" },
  { label: "Your Cart", path: "/cart" },
  { label: "Final Bill", path: "/bill" },
];

export default function NavDrawer() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        style={{ border: "none", background: "transparent" }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X size={20} color="var(--white)" /> : <MenuIcon size={20} color="var(--white)" />}
      </button>

      {open && (
        <div
          className="nav-drawer"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            zIndex: 40,
            padding: "6px 0",
          }}
        >
          {LINKS.map((link) => (
            <button
              type="button"
              key={link.label}
              className="nav-drawer-link"
              onClick={() => {
                setOpen(false);
                navigate(link.path);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "13px 20px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontFamily: "Poppins,sans-serif", color: "var(--white)", fontSize: 14, fontWeight: 500 }}>{link.label}</span>
              <ChevronRight size={15} color="var(--muted)" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
