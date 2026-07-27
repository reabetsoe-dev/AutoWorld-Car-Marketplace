import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../services/auth";
import { ADMIN_LOGIN_PATH } from "../config/adminPaths";

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return children;
}

export default ProtectedRoute;
