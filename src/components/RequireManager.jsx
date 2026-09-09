import { Navigate } from "react-router-dom";
import { useManager } from "../context/ManagerContext";

// Wraps any /manager/* route (other than the login screen itself) so it's
// unreachable without a valid manager session - manager auth is intentionally
// kept completely separate from the customer-facing pages, which never check
// this at all.
export default function RequireManager({ children }) {
  const { isAuthenticated } = useManager();
  if (!isAuthenticated) {
    return <Navigate to="/manager/login" replace />;
  }
  return children;
}
