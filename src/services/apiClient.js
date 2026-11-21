/**
 * StuPDT Unified API Client
 * Provides centralized network request handling, baseURL resolution,
 * timeout controls, and backend health status detection.
 */

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

/**
 * Standard fetch wrapper with timeout and JSON handling
 */
export async function apiFetch(endpoint, options = {}, timeoutMs = 8000) {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : await res.text();

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: err.name === "AbortError" ? 408 : 0,
      data: null,
      error: err.message || "Network request failed",
    };
  }
}

/**
 * Check if the backend API is live and responding
 */
export async function checkBackendHealth() {
  try {
    const res = await apiFetch("/api/health", { method: "GET" }, 3000);
    if (res.ok && res.data) {
      return { online: true, status: res.data.status || "healthy" };
    }
  } catch {
    // Backend offline
  }
  return { online: false, status: "offline" };
}

/**
 * Dynamic content fetchers from backend API
 */
export async function fetchDepartments() {
  try {
    const res = await apiFetch("/api/departments", { method: "GET" }, 4000);
    return res.ok && Array.isArray(res.data) ? res.data : null;
  } catch {
    return null;
  }
}

export async function fetchQuotes() {
  try {
    const res = await apiFetch("/api/quotes", { method: "GET" }, 4000);
    return res.ok && Array.isArray(res.data) ? res.data : null;
  } catch {
    return null;
  }
}

export async function fetchCaptchaData() {
  try {
    const res = await apiFetch("/api/captcha", { method: "GET" }, 4000);
    return res.ok && res.data ? res.data : null;
  } catch {
    return null;
  }
}

export async function fetchVisionSamples() {
  try {
    const res = await apiFetch("/api/vision/samples", { method: "GET" }, 4000);
    return res.ok && Array.isArray(res.data) ? res.data : null;
  } catch {
    return null;
  }
}

export async function fetchAppConfig() {
  try {
    const res = await apiFetch("/api/config", { method: "GET" }, 4000);
    return res.ok && res.data ? res.data : null;
  } catch {
    return null;
  }
}
