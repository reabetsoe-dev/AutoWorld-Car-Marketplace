const basePathRaw =
  import.meta.env.VITE_ADMIN_BASE_PATH || "/control-room-2026-portal";

const normalizedBasePath = basePathRaw.startsWith("/")
  ? basePathRaw
  : `/${basePathRaw}`;

export const ADMIN_BASE_PATH = normalizedBasePath;
export const ADMIN_LOGIN_PATH = `${normalizedBasePath}/login`;
export const ADMIN_DASHBOARD_PATH = `${normalizedBasePath}/dashboard`;
