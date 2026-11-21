import { apiFetch } from "./apiClient";
import { generateDysfunctionalAIResponse } from "./gemini";

/**
 * Dispatches a chat message to the backend /api/chat if online,
 * otherwise falls back to Gemini API proxy or offline replies.
 */
export async function sendChatMessage(userText, targetDept, history = []) {
  try {
    const res = await apiFetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: userText,
        departmentId: targetDept?.id || "intake",
        history,
      }),
    });

    if (res.ok && res.data?.reply) {
      return res.data;
    }
  } catch {
    // Backend offline
  }

  // Fallback to Gemini proxy or offline replies
  const fallbackReply = await generateDysfunctionalAIResponse(userText, targetDept);
  return {
    reply:
      typeof fallbackReply === "string"
        ? fallbackReply
        : fallbackReply?.reply || "We are experiencing technical indifference.",
    departmentId: targetDept?.id || "intake",
    departmentName: targetDept?.name || "StuPDT Assistant #001",
    departmentRole: targetDept?.role || "Frontline Referral Specialist",
    departmentBadge: targetDept?.badge || "DEPT #001",
    blame: "Mercury Retrograde",
    suggestedQuickReply: {
      label: 'Trigger Finale: "StuPDT, PLEASE JUST ANSWER MY QUESTION."',
      value: "StuPDT, PLEASE JUST ANSWER MY QUESTION.",
    },
  };
}
