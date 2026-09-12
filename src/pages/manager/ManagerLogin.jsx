import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Waves, User, Lock, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { useManager } from "../../context/ManagerContext";

export default function ManagerLogin() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useManager();
  const [showPass, setShowPass] = useState(false);
  const [username, setUsername] = useState("manager");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("Secure sign-in for the manager portal.");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/manager/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMessage("Please enter both username and password.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);
    setStatusMessage("Authenticating your manager session…");

    const result = await login(cleanUsername, cleanPassword);

    if (result.ok) {
      setStatusMessage("Session ready. Redirecting to the dashboard.");
      navigate("/manager/dashboard");
    } else {
      setErrorMessage(result.message || "Unable to sign in. Please check your credentials.");
      setStatusMessage("Sign-in failed.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="app-shell login-shell">
      <div className="page login-page">
        <div className="login-hero">
          <div className="login-icon">
            <Waves size={28} color="var(--gold)" strokeWidth={1.6} />
          </div>
          <h1>Hotel Sea Palace</h1>
          <p>Manager Portal</p>
        </div>

        <form className="card login-card" onSubmit={handleLogin}>
          <div className="login-badge">
            <ShieldCheck size={15} color="var(--gold)" />
            <span>Manager Sign In</span>
          </div>

          <div className="login-meta">
            <Sparkles size={14} color="var(--gold)" />
            <span>{statusMessage}</span>
          </div>

          <label className="field-label">Username</label>
          <div className="field-wrap">
            <User size={15} color="var(--muted)" />
            <input className="text-input" placeholder="manager" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>

          <label className="field-label">Password</label>
          <div className="field-wrap">
            <Lock size={15} color="var(--muted)" />
            <input
              className="text-input"
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" className="visibility-toggle" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide password" : "Show password"}>
              {showPass ? <EyeOff size={15} color="var(--muted)" /> : <Eye size={15} color="var(--muted)" />}
            </button>
          </div>

          <div className={`form-message ${errorMessage ? "error" : ""}`} aria-live="polite">
            {errorMessage || "Sign in with your manager credentials to open the dashboard."}
          </div>

          <button className="gold-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
