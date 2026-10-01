import axios from "axios";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredAdminProfile,
  saveSession
} from "./auth";
import { ADMIN_LOGIN_PATH } from "../config/adminPaths";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json"
  }
});

let refreshInFlightPromise = null;

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return false;
  }

  if (!refreshInFlightPromise) {
    refreshInFlightPromise = api
      .post("/admin/refresh", { refreshToken })
      .then((response) => {
        const { accessToken, refreshToken: nextRefreshToken, admin } = response.data || {};
        if (!accessToken || !nextRefreshToken) {
          clearSession();
          return false;
        }

        saveSession(accessToken, nextRefreshToken, admin || getStoredAdminProfile());
        return true;
      })
      .catch(() => {
        clearSession();
        return false;
      })
      .finally(() => {
        refreshInFlightPromise = null;
      });
  }

  return refreshInFlightPromise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = /\/admin\/(login|refresh|logout)/.test(originalRequest?.url || "");

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest?._retry) {
      originalRequest._retry = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        const token = getAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }

      if (typeof window !== "undefined") {
        window.location.assign(ADMIN_LOGIN_PATH);
      }
    }

    return Promise.reject(error);
  }
);

export const PERMISSIONS = {
  CARS_VIEW: "cars:view",
  CARS_CREATE: "cars:create",
  CARS_UPDATE: "cars:update",
  CARS_DELETE: "cars:delete",
  CARS_MARK_SOLD: "cars:mark_sold",
  SELL_REQUESTS_VIEW: "sell_requests:view",
  SELL_REQUESTS_UPDATE: "sell_requests:update",
  ADMIN_STATS: "admin:stats",
  ADMIN_UPLOAD: "admin:upload",
  ADMIN_BULK_IMPORT: "admin:bulk_import",
  AUDIT_VIEW: "audit:view",
  USERS_MANAGE: "users:manage",
  SYSTEM_SETTINGS: "system:settings"
};

export const ROLES = {
  MANAGER: "manager",
  EDITOR: "editor",
  VIEWER: "viewer",
  ADMIN: "admin"
};

function buildErrorMessage(error) {
  if (!error?.response && error?.message === "Network Error") {
    return `Could not reach the API at ${API_BASE_URL}. Make sure the backend is running and CORS allows this page.`;
  }

  const message = error?.response?.data?.message || error?.message || "Request failed.";
  return message;
}

export async function adminLogin(payload) {
  const response = await api.post("/admin/login", payload);
  return response.data;
}

export async function adminLogout(allDevices = false) {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return { message: "Logged out." };
  }

  try {
    const response = await api.post("/admin/logout", { refreshToken, allDevices });
    return response.data;
  } finally {
    clearSession();
  }
}

export async function getAdminProfile() {
  const response = await api.get("/admin/me");
  return response.data;
}

export async function getAdminStats(query = {}) {
  const response = await api.get("/admin/stats", { params: query });
  return response.data;
}

export async function getAdminCars(query = {}) {
  const response = await api.get("/cars/admin/all", { params: query });
  return response.data;
}

export async function getAdminCarById(id) {
  const response = await api.get(`/cars/admin/${id}`);
  return response.data;
}

export async function getSellers(query = {}) {
  const response = await api.get("/cars/admin/sellers", { params: query });
  return response.data;
}

export async function getCars(query = {}) {
  const response = await api.get("/cars", { params: query });
  return response.data;
}

export async function getCarById(id) {
  const response = await api.get(`/cars/${id}`);
  return response.data;
}

export async function createCar(payload) {
  const response = await api.post("/cars", payload);
  return response.data;
}

export async function updateCar(id, payload) {
  const response = await api.put(`/cars/${id}`, payload);
  return response.data;
}

export async function deleteCar(id) {
  const response = await api.delete(`/cars/${id}`);
  return response.data;
}

export async function markCarSold(id) {
  const response = await api.patch(`/cars/${id}/sold`);
  return response.data;
}

export async function markCarAvailable(id) {
  const response = await api.patch(`/cars/${id}/unsold`);
  return response.data;
}

export async function uploadCarImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post("/admin/upload-image", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}

export async function uploadCarsCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/admin/bulk-import", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}

export async function submitSellRequest(payload, images = []) {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });
  images.forEach((image) => formData.append("images", image));

  const response = await api.post("/sell-requests", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}

export async function getSellRequests(query = {}) {
  const response = await api.get("/sell-requests/admin/all", { params: query });
  return response.data;
}

export async function updateSellRequest(id, payload) {
  const response = await api.patch(`/sell-requests/admin/${id}`, payload);
  return response.data;
}

export async function getAdminUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function createAdminUser(payload) {
  const response = await api.post("/admin/users", payload);
  return response.data;
}

export async function updateAdminUser(id, payload) {
  const response = await api.patch(`/admin/users/${id}`, payload);
  return response.data;
}

export async function getAuditLogs(query = {}) {
  const response = await api.get("/admin/audit-logs", { params: query });
  return response.data;
}

export { buildErrorMessage };
