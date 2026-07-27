import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { adminLogin } from "../services/api";
import { isAuthenticated, saveSession } from "../services/auth";
import { ADMIN_DASHBOARD_PATH } from "../config/adminPaths";
import { showroomImages } from "../data/visualAssets";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to={ADMIN_DASHBOARD_PATH} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await adminLogin(credentials);
      saveSession(response.accessToken, response.refreshToken, response.admin);
      navigate(ADMIN_DASHBOARD_PATH);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-login-page">
      <div
        className="admin-login-visual"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(9, 15, 25, 0.1), rgba(9, 15, 25, 0.72)), url(${showroomImages.operations})`
        }}
      >
        <div>
          <span className="eyebrow">
            <ShieldCheck size={16} />
            Secure operations
          </span>
          <h1>AutoWorld Admin</h1>
          <p>Inventory control, sales status and marketplace workflow in one place.</p>
        </div>
      </div>

      <form className="panel admin-login-card" onSubmit={handleSubmit}>
        <div className="section-head">
          <span className="section-kicker">Private dashboard</span>
          <h2>Sign in</h2>
        </div>

        <div className="field-group">
          <label htmlFor="username">
            <UserRound size={15} />
            Username
          </label>
          <input
            id="username"
            autoComplete="username"
            value={credentials.username}
            onChange={(event) =>
              setCredentials((prev) => ({ ...prev, username: event.target.value }))
            }
          />
        </div>

        <div className="field-group">
          <label htmlFor="password">
            <LockKeyhole size={15} />
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={credentials.password}
            onChange={(event) =>
              setCredentials((prev) => ({ ...prev, password: event.target.value }))
            }
          />
        </div>

        <div className="button-row">
          <button className="btn btn--primary" type="submit" disabled={isSubmitting}>
            <LogIn size={17} />
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </div>

        {error ? <p className="notice notice--error">{error}</p> : null}
      </form>
    </section>
  );
}

export default AdminLoginPage;
