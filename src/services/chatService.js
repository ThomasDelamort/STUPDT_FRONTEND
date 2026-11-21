import { apiFetch } from "./apiClient";
import { generateDysfunctionalAIResponse } from "./gemini";
import { planTurn } from "./conversationEngine";

/**
 * Resolves one customer message into a department reply.
 *
 * The engine ALWAYS plans the turn locally: which department the ticket moves to,
 * a complete offline reply, the blame and the quick-reply chip. Better text then
 * replaces the offline reply if a source is available:
 *
 *   1. POST /api/chat   a deployed backend; its response wins field by field
 *   2. /api/gemini      live LLM text, in the voice of the department we routed to
 *   3. the engine's own reply (no backend, no API key: the zero-setup default)
 */
export async function sendChatMessage(userText, targetDept, history = []) {
  const plan = planTurn({ userText, currentDept: targetDept, history });

  const resolved = {
    reply: plan.reply,
    departmentId: plan.dept.id,
    departmentName: plan.dept.name,
    departmentRole: plan.dept.role,
    departmentBadge: plan.dept.badge,
    blame: plan.blame,
    suggestedQuickReply: plan.suggestedQuickReply ?? undefined,
  };

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
      return { ...resolved, ...res.data };
    }
  } catch {
    // Backend offline
  }

  const generated = await generateDysfunctionalAIResponse(userText, plan.dept);
  return {
    ...resolved,
    reply: generated || resolved.reply || "We are experiencing technical indifference.",
  };
}
