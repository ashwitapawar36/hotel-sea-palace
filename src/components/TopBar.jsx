import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TopBar({ title, right, onBack }) {
  const navigate = useNavigate();
  return (
    <div className="topbar">
      <button type="button" className="icon-btn" onClick={() => (onBack ? onBack() : navigate(-1))} aria-label="Go back">
        <ArrowLeft size={18} />
      </button>
      <span className="page-title" style={{ flex: 1 }}>
        {title}
      </span>
      {right}
    </div>
  );
}
