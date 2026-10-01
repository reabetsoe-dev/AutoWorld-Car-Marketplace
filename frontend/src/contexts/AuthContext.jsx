import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogout, getAdminProfile } from '../services/api';
import { clearSession, getStoredAdminProfile, saveSession } from '../services/auth';
import { ADMIN_LOGIN_PATH } from '../config/adminPaths';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(getStoredAdminProfile());
  const [loading, setLoading] = useState(Boolean(getStoredAdminProfile()));

  useEffect(() => {
    async function bootstrap() {
      try {
        const response = await getAdminProfile();
        const nextProfile = response?.admin || null;
        setProfile(nextProfile);
        if (nextProfile) saveSession(undefined, undefined, nextProfile);
      } catch (_error) {
        clearSession();
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    if (getStoredAdminProfile()) {
      bootstrap();
    } else {
      setLoading(false);
    }
  }, [navigate]);

  const value = useMemo(() => ({
    profile,
    loading,
    setProfile,
    login(session) {
      const nextProfile = session?.admin || null;
      saveSession(session?.accessToken, session?.refreshToken, nextProfile);
      setProfile(nextProfile);
      return nextProfile;
    },
    async logout() {
      await adminLogout(false);
      clearSession();
      setProfile(null);
      navigate(ADMIN_LOGIN_PATH, { replace: true });
    }
  }), [loading, navigate, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
