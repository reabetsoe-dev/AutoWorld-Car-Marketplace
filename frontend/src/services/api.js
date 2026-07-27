import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredAdminProfile,
  saveSession
} from "./auth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

let refreshInFlightPromise = null;

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function withQuery(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, value);
    }
  });
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return false;
  }

  if (!refreshInFlightPromise) {
    refreshInFlightPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/admin/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await parseJsonSafe(response);
      if (!response.ok || !data?.accessToken || !data?.refreshToken) {
        clearSession();
        return false;
      }

      saveSession(
        data.accessToken,
        data.refreshToken,
        data.admin || getStoredAdminProfile()
      );
      return true;
    })().finally(() => {
      refreshInFlightPromise = null;
    });
  }

  return refreshInFlightPromise;
}

async function request(path, options = {}, config = {}) {
  const { auth = true, retryOn401 = true } = config;
  const headers = new Headers(options.headers || {});

  if (auth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });
  const data = await parseJsonSafe(response);

  if (response.status === 401 && auth && retryOn401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request(path, options, { ...config, retryOn401: false });
    }
  }

  if (!response.ok) {
    const message = data?.message || "Request failed.";
    throw new Error(message);
  }

  return data;
}

export function getCars(query = {}) {
  return request(withQuery("/cars", query), {}, { auth: false });
}

export function getAdminCars(query = {}) {
  return request(withQuery("/cars/admin/all", query));
}

export function getCarById(id) {
  return request(`/cars/${id}`, {}, { auth: false });
}

export function adminLogin(payload) {
  return request(
    "/admin/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    { auth: false }
  );
}

export function adminLogout(allDevices = false) {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    return Promise.resolve({ message: "Logged out." });
  }

  return request(
    "/admin/logout",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken, allDevices })
    },
    { auth: false, retryOn401: false }
  ).finally(() => {
    clearSession();
  });
}

export function getAdminProfile() {
  return request("/admin/me");
}

export function getAdminStats() {
  return request("/admin/stats");
}

export function getAuditLogs(query = {}) {
  return request(withQuery("/admin/audit-logs", query));
}

export function getAdminUsers() {
  return request("/admin/users");
}

export function createAdminUser(payload) {
  return request("/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function updateAdminUser(id, payload) {
  return request(`/admin/users/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function createCar(payload) {
  return request("/cars", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function updateCar(id, payload) {
  return request(`/cars/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function deleteCar(id) {
  return request(`/cars/${id}`, {
    method: "DELETE"
  });
}

export function markCarSold(id) {
  return request(`/cars/${id}/sold`, {
    method: "PATCH"
  });
}

export function markCarAvailable(id) {
  return request(`/cars/${id}/unsold`, {
    method: "PATCH"
  });
}

export function uploadCarImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  return request("/admin/upload-image", {
    method: "POST",
    body: formData
  });
}

export function uploadCarsCsv(file) {
  const formData = new FormData();
  formData.append("file", file);

  return request("/admin/bulk-import", {
    method: "POST",
    body: formData
  });
}
