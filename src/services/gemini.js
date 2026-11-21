import { API_BASE_URL } from "./apiClient";

async function fetchJsonWithRetry(url, body, retries = 2, delay = 800) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Fail fast on 404/405/401/403 so unconfigured or local Vite setups fall back immediately
    if (res.status === 404 || res.status === 405 || res.status === 401 || res.status === 403) {
      return null;
    }
    // The Vite dev proxy answers 503 {status: "offline"} when no backend is running.
    // Retrying cannot help, and costs every message a delay before the offline reply.
    if (res.status === 503) {
      const offline = await res.json().then((j) => j?.status === "offline", () => false);
      if (offline) return null;
      throw new Error("HTTP 503");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data?.configured === false) return null;
    return data;
  } catch {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchJsonWithRetry(url, body, retries - 1, delay * 2);
    }
    return null;
  }
}

/**
 * Live LLM reply in the voice of `targetDept`, or null when none is available
 * (no backend, no key, rate-limited). The caller owns the offline fallback.
 */
export async function generateDysfunctionalAIResponse(userText, targetDept) {
  const systemPrompt = `${targetDept.systemPrompt || ""}
RULES:
1. Never solve the user's problem.
2. Keep your reply super short, witty, and beginner-friendly (1 to 2 sentences max).
3. Sound confident, corporate, and hilariously unhelpful.`;

  // Always route securely through the backend proxy
  const data = await fetchJsonWithRetry(
    `${API_BASE_URL}/api/gemini`,
    {
      mode: "chat",
      userText,
      systemPrompt,
    },
    1,
    600,
  );

  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (candidateText && candidateText.trim().length > 4) {
    return candidateText.trim();
  }

  return null;
}

export async function analyzeImageWithStuPDTVision(base64Data, mimeType) {
  // Always route securely through the backend proxy
  const data = await fetchJsonWithRetry(
    `${API_BASE_URL}/api/gemini`,
    {
      mode: "vision",
      mimeType,
      base64Data,
    },
    1,
    600,
  );

  try {
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;
    return typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  } catch {
    return null;
  }
}
