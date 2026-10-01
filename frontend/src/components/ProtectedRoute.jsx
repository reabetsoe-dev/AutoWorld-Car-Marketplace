import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../services/auth';
import { ADMIN_LOGIN_PATH } from '../config/adminPaths';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children }) {
  const auth = useAuth();

  if (auth?.loading) {
    return (
      <div className="route-loading" role="status">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return children;
}

export default ProtectedRoute;
