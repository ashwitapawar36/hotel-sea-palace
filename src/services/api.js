// Thin fetch wrapper around the Express backend. Reads the base URL from
// Vite's env (VITE_API_URL), defaulting to same-origin /api for local dev
// behind a proxy, or http://localhost:5000/api when running the Vite dev
// server directly against a locally-running backend.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("manager-access-token");
}

function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("manager-refresh-token");
}

function setTokens({ accessToken, refreshToken } = {}) {
  if (typeof window === "undefined") return;
  if (accessToken) window.localStorage.setItem("manager-access-token", accessToken);
  if (refreshToken) window.localStorage.setItem("manager-refresh-token", refreshToken);
}

function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("manager-access-token");
  window.localStorage.removeItem("manager-refresh-token");
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, auth = false, headers = {} } = {}) {
  const finalHeaders = { "Content-Type": "application/json", ...headers };

  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError("Could not reach the server. Please check your connection.", 0, null);
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.errors?.[0]?.msg || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

async function uploadFile(path, file, { auth = true } = {}) {
  const formData = new FormData();
  formData.append("image", file);

  const headers = {};
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: formData });
  } catch {
    throw new ApiError("Could not reach the server. Please check your connection.", 0, null);
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.message || `Upload failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  uploadImage: (file, opts) => uploadFile("/menu/upload", file, opts),
};

export const authStorage = { getAccessToken, getRefreshToken, setTokens, clearTokens };
export { ApiError };
