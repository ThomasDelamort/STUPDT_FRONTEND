/**
 * Offline fallback responses for StuPDT AI departments
 * Used when no API key is configured or offline/rate-limited
 */

export function getOfflineDepartmentReply(userText, targetDept) {
  if (targetDept.id === "verifier") {
    return `Thank you for reaching Obvious Verification! Before we can ignore "${userText}", please submit notarized proof that you exist inside linear time. Transferring you to Supervisor #003 in Policy Contradiction.`;
  }
  if (targetDept.id === "supervisor") {
    return `Congratulations on confirming your status! Unfortunately, under Policy Catch-22, we are legally forbidden from assisting anyone with "${userText}". Transferring you immediately to Form AI #004.`;
  }
  if (targetDept.id === "form_ai") {
    return `We cannot process "${userText}" because Form 001-B requires Form 001-C to be signed prior to your birth. Transferring your unresolved file to Excuse AI #005.`;
  }
  if (targetDept.id === "excuse_ai") {
    return `After exhaustive analysis, we are 99.97% confident your issue with "${userText}" is caused by Mercury retrograde and your device's emotional instability. Escalating to Executive Management #009.`;
  }
  if (targetDept.id === "cio") {
    return `As Chief Incompetence Officer, I deeply apologize for our team's earlier incompetence regarding "${userText}". Escalating your case directly to THE CEO AI in the Penthouse.`;
  }
  if (targetDept.id === "ceo") {
    return `As THE CEO AI, I am proud to say I have never answered a single question in my career. Synergizing your inquiry about "${userText}" straight back to Assistant #001 to restart the loop!`;
  }
  return `Welcome to Intake! In order to not answer your question, I must first transfer you to Assistant #002 in Obvious Fact Verification. Please hold.`;
}
