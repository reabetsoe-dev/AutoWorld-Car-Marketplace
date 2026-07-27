const ACCESS_TOKEN_KEY = "autoworld_admin_access_token";
const REFRESH_TOKEN_KEY = "autoworld_admin_refresh_token";
const ADMIN_KEY = "autoworld_admin_profile";

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getToken() {
  return getAccessToken();
}

export function saveSession(accessToken, refreshToken, adminProfile) {
  if (accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (adminProfile) {
    window.localStorage.setItem(ADMIN_KEY, JSON.stringify(adminProfile));
  }
}

export function setAccessToken(accessToken) {
  if (!accessToken) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

export function getStoredAdminProfile() {
  const raw = window.localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}
