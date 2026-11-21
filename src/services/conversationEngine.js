/**
 * StuPDT conversation engine.
 *
 * Decides, for every customer message:
 *   1. which department the ticket is transferred to      (routing)
 *   2. what that department says                          (offline reply)
 *   3. who gets blamed, and which quick-reply chip to show
 *
 * Routing is ALWAYS decided here, deterministically, so the demo flow works with no
 * backend and no API key. A backend or Gemini can still supply the reply text
 * (see chatService.js); this engine is what they fall back to.
 *
 * Pure functions only: no network, no DOM, no randomness. The same message in the
 * same conversation always gets the same reply, but repeating a message does not
 * repeat a department's line back to back.
 */
import { DEPARTMENTS } from "../constants/departments";
import { hashString } from "../utils/office/rng";
import { APOLOGY_LINE, FINALE_CHIP_LABEL } from "./offlineReplies";
import { REPLY_POOLS, fillTemplate } from "./replyPools";

const FRONT_DOOR = "intake";
const ESCALATION_DESK = "ceo";
const FALLBACK_TOPIC = "your concern";
const MAX_QUOTE_LENGTH = 48;

/** Department ids in escalation order. Derived from data so new departments join the cycle. */
const ORDER = DEPARTMENTS.map((d) => d.id);

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

/** First match wins, so order is priority. Anything unmatched is "other". */
const INTENT_RULES = [
  [
    "human",
    /\b(?:speak|talk)\s+(?:to|with)\b|\b(?:real|live)\s+(?:person|human|agent)\b|\b(?:manager|ceo|escalat\w*)\b/i,
  ],
  [
    "exam",
    /\b(?:exams?|tests?|quiz(?:zes)?|study|studying|homework|assignments?|midterms?|finals?|thesis|grades?|students?|school|class|lecture|professor|teacher|university|college)\b/i,
  ],
  [
    "time",
    /\bwhat(?:'s|\s+is)?\s+(?:the\s+)?(?:time|date|day)\b|\btime\s+is\s+it\b|\bwhat\s+time\b|\bclock\b/i,
  ],
  ["wifi", /\b(?:wi-?fi|internet|router|modem|network|ethernet|bluetooth)\b/i],
  [
    "billing",
    /\b(?:refund|money|price|pricing|pay|payment|bill|billing|invoice|charged?|subscription|cancel|cost|order|delivery|shipping|package)\b/i,
  ],
  [
    "paperwork",
    /\b(?:forms?|paperwork|permits?|documents?|notar\w+|signature|stamp|application|certificate)\b/i,
  ],
  [
    "tech",
    /\b(?:password|login|log\s+in|account|app|crash\w*|bug|error|slow|laptop|computer|phone|printer|install|update|virus|screen|keyboard|battery)\b/i,
  ],
  ["greeting", /^\s*(?:hi|hello|hey|yo|sup|greetings|good\s+(?:morning|afternoon|evening))\b/i],
  ["thanks", /\b(?:thanks?|thank\s+you|thx|appreciate)\b/i],
];

// "no" opens a confirmation ("no really, it is on fire") but not "No one answers my calls".
const ACK_START =
  /^\s*(?:yes|yeah|yep|yup|yea|ok|okay|k|sure|fine|alright|no(?!\s+(?:one|body|way|longer|more)\b)|nope|nah|correct|confirmed?|affirmative|i\s+confirm|indeed|obviously)\b/i;
const MAX_ACK_WORDS = 8;
const UPSET =
  /\b(?:useless|stupid|terrible|awful|worst|hate|angry|ridiculous|wtf|unhelpful|not\s+helping|waste\s+of|nothing\s+works|are\s+you\s+kidding)\b|[?!]{2,}|^\s*(?:what|huh|why|excuse\s+me)\W*$/i;

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;

function isShouting(text) {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/**
 * Classifies a customer message.
 * @returns {"human"|"exam"|"time"|"wifi"|"billing"|"paperwork"|"tech"|"greeting"|"thanks"|"ack"|"upset"|"other"}
 */
export function detectIntent(text) {
  const t = String(text ?? "").trim();
  if (!t) return "other";
  for (const [intent, re] of INTENT_RULES) {
    if (re.test(t)) return intent;
  }
  // Short confirmations ("Okay.", "Yes, I am a human.") carry no topic of their own.
  if (ACK_START.test(t) && wordCount(t) <= MAX_ACK_WORDS) return "ack";
  if (UPSET.test(t) || isShouting(t)) return "upset";
  return "other";
}

// ---------------------------------------------------------------------------
// Topic extraction
// ---------------------------------------------------------------------------

const TOPIC_LABELS = {
  exam: "your exam",
  time: "the time",
  wifi: "your Wi-Fi",
  billing: "your billing question",
  human: "your request for a human",
};
const NON_TOPICAL = new Set(["greeting", "thanks", "ack", "upset"]);

/** Quotes the customer's own words, shortened to a readable length. */
function quoteSnippet(text) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/[.!?…\s]+$/, "");
  if (!cleaned) return null;
  if (cleaned.length <= MAX_QUOTE_LENGTH) return `"${cleaned}"`;
  const cut = cleaned.slice(0, MAX_QUOTE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `"${(lastSpace > 16 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, "")}…"`;
}

function topicFromText(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  const intent = detectIntent(t);
  if (TOPIC_LABELS[intent]) return TOPIC_LABELS[intent];
  if (NON_TOPICAL.has(intent)) return null;
  return quoteSnippet(t);
}

/**
 * What is this conversation about? Uses the current message when it has a topic,
 * otherwise the most recent earlier customer message that does ("Okay." and
 * "WHAT?" are replies to an earlier question, not questions of their own).
 */
export function deriveTopic(userText, history = []) {
  const current = topicFromText(userText);
  if (current) return current;
  const earlier = [...history]
    .reverse()
    .filter((m) => m?.sender === "user" && typeof m.text === "string")
    .map((m) => topicFromText(m.text))
    .find(Boolean);
  return earlier ?? FALLBACK_TOPIC;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** From the front door, a recognisable topic skips straight to the "right" department. */
const FRONT_DOOR_SHORTCUTS = {
  exam: "verifier",
  time: "verifier",
  wifi: "excuse_ai",
  tech: "excuse_ai",
  billing: "cio",
  paperwork: "form_ai",
  upset: "cio",
};

/**
 * Where does this ticket go next?
 *
 *  - Asking for a human or a manager escalates to the CEO from anywhere.
 *  - At the front desk, a recognisable topic jumps to its department.
 *  - Otherwise the ticket moves one step down the escalation chain, and the CEO
 *    always bounces it back to the front desk. Never the department it is already in.
 *
 * @returns {string} a department id
 */
export function routeNext(currentDeptId, intent) {
  const index = ORDER.indexOf(currentDeptId);
  const at = index === -1 ? ORDER.indexOf(FRONT_DOOR) : index;
  const currentId = ORDER[at];

  let target = null;
  if (intent === "human" && currentId !== ESCALATION_DESK) {
    target = ESCALATION_DESK;
  } else if (currentId === FRONT_DOOR) {
    target = FRONT_DOOR_SHORTCUTS[intent] ?? null;
  }
  if (target && target !== currentId && ORDER.includes(target)) return target;
  return ORDER[(at + 1) % ORDER.length];
}

// ---------------------------------------------------------------------------
// Reply, blame and quick-reply selection
// ---------------------------------------------------------------------------

// Values must match BLAME_TARGETS in constants/departments.js (they are translated by exact string).
const BLAME_BY_DEPT = {
  intake: "Another AI Assistant",
  verifier: "The User (For Asking)",
  supervisor: "Unauthorized Curiosity",
  cio: "Ticket Number Department Outage",
  form_ai: "Missing Form 001-C Stamp",
  excuse_ai: "Mercury Retrograde",
  ceo: "Another AI Assistant",
};

function pickBlame(deptId, intent) {
  if (deptId === "excuse_ai" && (intent === "wifi" || intent === "tech")) {
    return "Your Device's Emotional Instability";
  }
  return BLAME_BY_DEPT[deptId] ?? "Another AI Assistant";
}

const FINALE_CHIP = {
  label: FINALE_CHIP_LABEL,
  value: "StuPDT, PLEASE JUST ANSWER MY QUESTION.",
};

const VERIFIER_ANSWERS = {
  exam: "Yes, I am a student.",
  time: "Yes, I exist in linear time.",
  wifi: "Yes, it is wireless.",
  default: "Yes, I am a human.",
};

/** Suggests the next step of the demo. null leaves useChat's default chip in place. */
function pickQuickReply(deptId, intent) {
  if (deptId === "verifier") {
    const value = VERIFIER_ANSWERS[intent] ?? VERIFIER_ANSWERS.default;
    return { label: `Reply: "${value}"`, value };
  }
  if (deptId === "supervisor") return { label: 'Reply: "WHAT?"', value: "WHAT?" };
  if (deptId === "cio") return FINALE_CHIP;
  return null;
}

/** Picks a template: deterministic for a given conversation, but never the line this dept just said. */
function composeReply({ deptId, intent, topic, seed, recentTexts }) {
  const pool = REPLY_POOLS[deptId];
  const templates = pool?.[intent]?.length ? pool[intent] : pool?.default;
  if (!templates?.length) return APOLOGY_LINE;

  const rendered = templates.map((t) => fillTemplate(t, { topic }));
  const fresh = rendered.filter((text) => !recentTexts.has(text));
  const candidates = fresh.length > 0 ? fresh : rendered;
  return candidates[hashString(seed) % candidates.length];
}

/**
 * Plans one conversational turn.
 *
 * @param {object}   args
 * @param {string}   args.userText     what the customer just typed
 * @param {object}   [args.currentDept] department the customer is currently talking to
 * @param {object[]} [args.history]    earlier chat messages (oldest first, current message excluded)
 * @returns {{dept: object, intent: string, topic: string, reply: string, blame: string,
 *            suggestedQuickReply: ({label: string, value: string}|null)}}
 */
export function planTurn({ userText, currentDept, history = [] } = {}) {
  const text = String(userText ?? "").trim();
  const safeHistory = Array.isArray(history) ? history.filter(Boolean) : [];

  const intent = detectIntent(text);
  const nextId = routeNext(currentDept?.id ?? FRONT_DOOR, intent);
  const dept = DEPARTMENTS.find((d) => d.id === nextId) ?? DEPARTMENTS[0];
  const topic = deriveTopic(text, safeHistory);

  const recentTexts = new Set(
    safeHistory
      .filter((m) => m.sender === "ai" && m.deptId === dept.id && typeof m.text === "string")
      .map((m) => m.text),
  );

  return {
    dept,
    intent,
    topic,
    reply: composeReply({
      deptId: dept.id,
      intent,
      topic,
      seed: `${dept.id}|${intent}|${text.toLowerCase()}`,
      recentTexts,
    }),
    blame: pickBlame(dept.id, intent),
    suggestedQuickReply: pickQuickReply(dept.id, intent),
  };
}
