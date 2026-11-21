// ============================================================================
// THE OFFICE: dialogue. Offline & deterministic: the arc is picked by a hash
// of the prompt (same prompt -> same arc), lines are filled with cheap
// context slots, and no line repeats within 5 consecutive prompts.
// Text is only ever written with textContent (never parsed as markup).
// ============================================================================
import { Rng, hashString } from "./rng";
import {
  OFFICE_ARCS,
  OFFICE_FILLER_LINES,
  OFFICE_STALL_LINES,
  OFFICE_VERDICT_LINES,
  OFFICE_ANOTHER_LINES,
  OFFICE_ALARM_LINES,
  OFFICE_AMBIENT_LINES,
  OFFICE_KEYWORDS,
  OFFICE_KEYWORD_LINES,
  OFFICE_PANIC_LINES,
} from "../../constants/office";

const MAX_LINE = 60;
const SNIP_LEN = 28;
const DEPT_LEN = 26;
const RECENT_PROMPTS = 5;

/** Plain-text, single-line, length-capped snippet of the user's prompt. */
export function makeSnip(text, max = SNIP_LEN) {
  const clean = Array.from(String(text || ""), (ch) => {
    const c = ch.charCodeAt(0);
    return c < 32 || c === 127 || ch === "<" || ch === ">" ? " " : ch;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean || "...";
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function shortDept(name) {
  const clean = String(name || "the Feedback Department")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= DEPT_LEN ? clean : `${clean.slice(0, DEPT_LEN - 1).trimEnd()}…`;
}

export function detectKeyword(text) {
  for (const k of OFFICE_KEYWORDS) if (k.test.test(text)) return k.id;
  return "generic";
}

function fill(template, ctx) {
  // Insert each slot once. User text may itself contain "{dept}" or "$&".
  return template.replace(/\{(snip|dept|n)\}/g, (_, key) => ctx[key]);
}

/**
 * @typedef {{ speaker: string, gesture: string, at: string | null,
 *   ticket: string | null, text: string, id: string, heat: number }} Beat
 * @typedef {{ arcId: string, title: string, climax: number, beats: Beat[] }} Plan
 */

export class Dialogue {
  /** @param {string[]} actorIds enabled actors, in roster order */
  constructor(actorIds) {
    this.actorIds = actorIds;
    /** @type {Set<string>[]} line ids used by each of the last prompts */
    this.history = [];
    /** @type {Set<string>} */
    this.current = new Set();
    this.ambientRng = new Rng(hashString("office-ambient") ^ Date.now());
    this.continuations = 0;
  }

  /** Lines used in the last RECENT_PROMPTS prompts (+ the current one). */
  recent() {
    const all = new Set(this.current);
    for (const s of this.history) for (const id of s) all.add(id);
    return all;
  }

  /** Start bookkeeping for a new prompt. */
  beginPrompt() {
    if (this.current.size) {
      this.history.push(this.current);
      while (this.history.length > RECENT_PROMPTS - 1) this.history.shift();
    }
    this.current = new Set();
  }

  use(id) {
    this.current.add(id);
  }

  /** Pick an unused variant; falls back to a filler line, then to anything. */
  pickVariant(variants, rng, gesture) {
    const recent = this.recent();
    const fresh = variants.filter((v) => !recent.has(v));
    if (fresh.length) return { text: rng.pick(fresh), gesture };
    const filler = OFFICE_FILLER_LINES.filter((f) => !recent.has(f.text));
    if (filler.length) {
      const f = rng.pick(filler);
      return { text: f.text, gesture: f.gesture };
    }
    return { text: rng.pick(variants), gesture };
  }

  resolveActor(id, rng, avoid = []) {
    if (id && this.actorIds.includes(id)) return id;
    const pool = this.actorIds.filter((a) => !avoid.includes(a));
    return rng.pick(pool.length ? pool : this.actorIds);
  }

  /**
   * Build the argument plan for a prompt.
   * @param {string} promptText
   * @param {{ dept: string, ticketNo: number }} ctxIn
   * @returns {Plan}
   */
  buildPlan(promptText, ctxIn) {
    const seed = hashString(promptText.trim().toLowerCase());
    const rng = new Rng(seed ^ (this.history.length * 0x9e3779b1));
    const arc = OFFICE_ARCS[seed % OFFICE_ARCS.length];
    const kw = detectKeyword(promptText);
    const ctx = {
      snip: makeSnip(promptText),
      dept: shortDept(ctxIn.dept),
      n: `#${String(ctxIn.ticketNo).padStart(3, "0")}`,
    };
    /** @type {Beat[]} */
    const beats = [];
    arc.beats.forEach((b, i) => {
      const speaker = this.resolveActor(b.who, rng);
      const at = b.at ? this.resolveActor(b.at, rng, [speaker]) : null;
      const ticket = b.ticket ? this.resolveActor(b.ticket, rng, [speaker]) : null;
      const variants = b.kw ? OFFICE_KEYWORD_LINES[kw] || OFFICE_KEYWORD_LINES.generic : b.lines;
      const picked = this.pickVariant(variants, rng, b.gesture);
      this.use(picked.text);
      beats.push({
        speaker,
        gesture: picked.gesture,
        at,
        ticket,
        id: picked.text,
        text: fill(picked.text, ctx),
        heat: Math.min(3, Math.floor((i + 1) / 2)),
      });
    });
    return { arcId: arc.id, title: arc.title, climax: arc.climax, beats };
  }

  /** @param {Rng} rng */
  stallBeat(rng, heat = 2) {
    const recent = this.recent();
    const pool = OFFICE_STALL_LINES.filter((l) => !recent.has(l.text));
    if (!pool.length) {
      // A slow transfer can outlive the entire pool. Number the follow-ups
      // so a long meeting stays unique without retaining unbounded history.
      const text = `Addendum ${++this.continuations}. Still awaiting a signature.`;
      return this.lineBeat({ text, gesture: "think" }, rng, heat, {});
    }
    const l = rng.pick(pool);
    this.use(l.text);
    return this.lineBeat(l, rng, heat, {});
  }

  /** Pick from a fixed pool, skipping lines used in the last 5 prompts. */
  freshFrom(pool, rng) {
    const recent = this.recent();
    const fresh = pool.filter((l) => !recent.has(l.text));
    const l = rng.pick(fresh.length ? fresh : pool);
    this.use(l.text);
    return l;
  }

  verdictBeat(rng, dept) {
    return this.lineBeat(this.freshFrom(OFFICE_VERDICT_LINES, rng), rng, 1, {
      dept: shortDept(dept),
    });
  }

  anotherBeat(rng, n) {
    return this.lineBeat(this.freshFrom(OFFICE_ANOTHER_LINES, rng), rng, 3, {
      n: `#${String(n).padStart(3, "0")}`,
    });
  }

  alarmBeat(rng, text) {
    return this.lineBeat(this.freshFrom(OFFICE_ALARM_LINES, rng), rng, 0, { snip: makeSnip(text) });
  }

  panicLine(rng) {
    return rng.pick(OFFICE_PANIC_LINES);
  }

  lineBeat(l, rng, heat, ctx) {
    const speaker = this.resolveActor(null, rng);
    return {
      speaker,
      gesture: l.gesture,
      at: null,
      ticket: null,
      id: l.text,
      text: fill(l.text, { snip: "", dept: "", n: "", ...ctx }),
      heat,
    };
  }

  /** Ambient micro-line (<= 3 words) for an activity. */
  ambient(activity) {
    const key = activity && activity.startsWith("pingpong") ? "pingpong" : activity;
    const pool = (key && OFFICE_AMBIENT_LINES[key]) || OFFICE_AMBIENT_LINES.any;
    const rng = this.ambientRng;
    return rng.chance(0.75) ? rng.pick(pool) : rng.pick(OFFICE_AMBIENT_LINES.any);
  }
}

/**
 * Dev check: every line must stay <= 60 chars with worst-case slot values.
 * @returns {string[]} offending lines
 */
export function validateDialogue() {
  const ctx = { snip: "x".repeat(SNIP_LEN), dept: "y".repeat(DEPT_LEN), n: "#000" };
  const bad = [];
  const check = (t) => {
    const filled = fill(t, ctx);
    if (filled.length > MAX_LINE) bad.push(`${filled.length}: ${t}`);
  };
  for (const arc of OFFICE_ARCS) for (const b of arc.beats) for (const l of b.lines || []) check(l);
  for (const list of Object.values(OFFICE_KEYWORD_LINES)) list.forEach(check);
  for (const l of [
    ...OFFICE_FILLER_LINES,
    ...OFFICE_STALL_LINES,
    ...OFFICE_VERDICT_LINES,
    ...OFFICE_ANOTHER_LINES,
    ...OFFICE_ALARM_LINES,
  ])
    check(l.text);
  return bad;
}

/** Total number of distinct authored lines (README / notes). */
export function countLines() {
  let n = 0;
  for (const arc of OFFICE_ARCS) for (const b of arc.beats) n += (b.lines || []).length;
  for (const list of Object.values(OFFICE_KEYWORD_LINES)) n += list.length;
  n +=
    OFFICE_FILLER_LINES.length +
    OFFICE_STALL_LINES.length +
    OFFICE_VERDICT_LINES.length +
    OFFICE_ANOTHER_LINES.length +
    OFFICE_ALARM_LINES.length;
  return n;
}
