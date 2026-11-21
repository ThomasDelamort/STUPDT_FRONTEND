// ============================================================================
// i18n coverage check.
//
// Translations are keyed by the EXACT English source string, so editing English
// copy silently orphans its translations. This script finds every translatable
// English string in the source, then reports which ones each dictionary
// language is missing (and which dictionary keys no longer exist in the source).
//
//   node scripts/check-i18n.mjs            summary per language, exit 1 for coverage or placeholder errors
//   node scripts/check-i18n.mjs --verbose  also print every missing / stale key
//   node scripts/check-i18n.mjs --list     print all source strings as JSON
//
// English is the source, Pig Latin is algorithmic, and the other joke dialects
// intentionally fall back to English where their dictionaries have no entry.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const args = new Set(process.argv.slice(2));

// ---- 1. Sinks: calls whose string-literal arguments end up on screen --------
// (tx() directly, or state/toast setters whose value is later passed to tx()).
const SINK_CALLS = [
  "tx",
  "triggerToast",
  "setCaptchaError",
  "setMathError",
  "setFormError",
  "setVisionScanStatus",
];

// ---- 2. Data files: text that flows into tx() via variables -----------------
const DATA_RULES = [
  {
    file: "src/constants/departments.js",
    keys: ["name", "role", "division", "status", "badge", "code"],
    blocks: [/BLAME_TARGETS\s*=\s*\[/g],
  },
  { file: "src/constants/quotes.js", allLiterals: true },
  { file: "src/constants/captcha.js", keys: ["label", "question", "hint"] },
  {
    file: "src/constants/vision.js",
    keys: ["label", "scanText", "detectedItem", "category", "verdict", "proTip"],
    blocks: [/ingredients\s*:\s*\[/g],
  },
  { file: "src/constants/accessibility.js", keys: ["title", "subtitle", "body", "footnote"] },
  { file: "src/constants/office.js", blocks: [/OFFICE_COPY\s*=\s*\{/g] },
  { file: "src/hooks/useChat.js", keys: ["label", "text", "blame", "timestamp"] },
  { file: "src/services/chatService.js", keys: ["label", "blame"] },
  { file: "src/services/bureaucracyService.js", keys: ["error"] },
  { file: "src/services/offlineReplies.js", allLiterals: true, minWords: 3 },
];

const EXTRA_KEYS = [
  // Fallback reply used when every AI path fails (chatService.js).
  "We are experiencing technical indifference.",
];

// ---- literal scanning --------------------------------------------------------
const LITERAL_RE = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function evalLiteral(lit) {
  // Source is our own repo; Function evaluates escapes like \n and ’ exactly as the runtime would.
  return Function(`"use strict"; return (${lit});`)();
}

function isTranslatable(str, minWords = 1) {
  // No letters once {placeholders} are ignored ("...", "%", "{value}%", "— {subtitle}")
  if (!/[A-Za-zÀ-ɏ]/.test(str.replace(/\{\w+\}/g, ""))) return false;
  return str.trim().split(/\s+/).length >= minWords;
}

// Source strings that are intentionally identical in every language: codes,
// brand tokens, and the English-pun author names on the quotes.
const INVARIANT_KEYS = new Set([
  "i", "STU", "PDT", "₱999 VIP", "MALFUNCTION", "MALFUNCTION 2026", "STUPDT CORP",
  "Emmanual Can't", "René Discard", "Sun Snooze", "Confuse-ius", "Albert Ain't-stein",
  "Sir Isaac No-ton", "Leonardo Da-Glitchy", "Abraham Link-broken", "Steve No-Jobs",
  "Sock-rates", "Mark Trainwreck", "William Shakes-barely",
]);
const INVARIANT_PATTERNS = [/^[A-Z]+[-\s]?#?\d+$/]; // AGENT #001, DEPT #002, BLAME-005, CEO-000
const isInvariant = (key) =>
  INVARIANT_KEYS.has(key) || INVARIANT_PATTERNS.some((re) => re.test(key));

function literalsIn(text, { minWords = 1 } = {}) {
  const out = [];
  for (const m of text.matchAll(LITERAL_RE)) {
    const lit = m[0];
    if (lit.startsWith("`") && lit.includes("${")) continue; // dynamic: cannot be a key
    const value = evalLiteral(lit);
    if (isTranslatable(value, minWords)) out.push(value);
  }
  return out;
}

// Returns the text between the bracket at `openIndex` and its matching close, skipping strings/comments.
function balancedBody(text, openIndex) {
  const open = text[openIndex];
  const close = { "(": ")", "[": "]", "{": "}" }[open];
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") i++;
        i++;
      }
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i === -1) return text.slice(openIndex + 1);
      i++;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return text.slice(openIndex + 1);
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["i18n", "assets", "office"].includes(entry.name) && dir !== path.join(SRC, "components")) {
        if (entry.name !== "office") continue;
      }
      if (entry.name === "i18n" || entry.name === "assets") continue;
      if (full === path.join(SRC, "utils", "office")) continue;
      walk(full, out);
    } else if (/\.(jsx?|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ---- collect source strings --------------------------------------------------
const sourceKeys = new Map(); // key -> Set of "file:line"
const dynamicWarnings = [];

function addKey(key, where) {
  if (!sourceKeys.has(key)) sourceKeys.set(key, new Set());
  sourceKeys.get(key).add(where);
}

const sinkRe = new RegExp(`(?<![\\w.])(${SINK_CALLS.join("|")})\\(`, "g");

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(sinkRe)) {
    const openIndex = m.index + m[0].length - 1;
    const body = balancedBody(text, openIndex);
    const where = `${rel}:${lineOf(text, m.index)}`;
    for (const lm of body.matchAll(LITERAL_RE)) {
      const lit = lm[0];
      // `status === "connected"` compares against a literal; it is code, not copy.
      const before = body.slice(0, lm.index);
      const after = body.slice(lm.index + lit.length);
      if (/[=!]==?\s*$/.test(before) || /^\s*[=!]==?/.test(after)) continue;
      if (lit.startsWith("`") && lit.includes("${")) {
        dynamicWarnings.push(`${where}  ${m[1]}(${lit.slice(0, 60)}...)`);
        continue;
      }
      const value = evalLiteral(lit);
      if (isTranslatable(value)) addKey(value, where);
    }
  }
}

for (const rule of DATA_RULES) {
  const file = path.join(ROOT, rule.file);
  if (!fs.existsSync(file)) {
    console.warn(`warning: data file missing: ${rule.file}`);
    continue;
  }
  const text = fs.readFileSync(file, "utf8");

  if (rule.allLiterals) {
    for (const v of literalsIn(text, { minWords: rule.minWords })) addKey(v, rule.file);
  }
  if (rule.keys?.length) {
    const keyRe = new RegExp(`\\b(?:${rule.keys.join("|")})\\s*:\\s*(${LITERAL_RE.source})`, "g");
    for (const m of text.matchAll(keyRe)) {
      const lit = m[1];
      if (lit.startsWith("`") && lit.includes("${")) continue;
      const value = evalLiteral(lit);
      if (isTranslatable(value)) addKey(value, `${rule.file}:${lineOf(text, m.index)}`);
    }
  }
  for (const blockRe of rule.blocks || []) {
    for (const m of text.matchAll(blockRe)) {
      const body = balancedBody(text, m.index + m[0].length - 1);
      for (const v of literalsIn(body)) addKey(v, `${rule.file}:${lineOf(text, m.index)}`);
    }
  }
}

for (const key of EXTRA_KEYS) addKey(key, "scripts/check-i18n.mjs (EXTRA_KEYS)");

const keys = [...sourceKeys.keys()].filter((k) => !isInvariant(k)).sort();

if (args.has("--list")) {
  console.log(JSON.stringify(keys, null, 2));
  process.exit(0);
}
if (args.has("--where")) {
  for (const k of keys) console.log(`${JSON.stringify(k).slice(0, 70).padEnd(72)} ${[...sourceKeys.get(k)].join(", ")}`);
  process.exit(0);
}

// ---- compare against dictionaries -------------------------------------------
let DICTIONARIES = {};
try {
  ({ DICTIONARIES } = await import(pathToFileURL(path.join(SRC, "i18n/translations/index.js")).href));
} catch (err) {
  console.warn(`warning: could not load dictionaries (${err.message}). Treating all as empty.`);
}
const { DEFAULT_LANGUAGE_ID, LANGUAGES } = await import(
  pathToFileURL(path.join(SRC, "i18n/languages.js")).href
);
const dictionaryLanguages = LANGUAGES.filter((l) => l.id !== DEFAULT_LANGUAGE_ID && l.id !== "piglatin");
const placeholders = (value) =>
  [...value.matchAll(/\{\w+\}/g)]
    .map(([token]) => token)
    .sort((a, b) => a.localeCompare(b))
    .join(" ");

console.log(`${keys.length} translatable source strings found.\n`);

let problems = 0;
for (const lang of dictionaryLanguages) {
  const dict = DICTIONARIES[lang.id] || {};
  const missing = keys.filter((k) => !Object.hasOwn(dict, k));
  const empty = keys.filter(
    (k) => Object.hasOwn(dict, k) && (typeof dict[k] !== "string" || !dict[k].trim()),
  );
  const mismatched = keys.filter(
    (k) => typeof dict[k] === "string" && dict[k].trim() && placeholders(k) !== placeholders(dict[k]),
  );
  const stale = Object.keys(dict).filter((k) => !sourceKeys.has(k));
  // (invariant keys may legitimately appear in a dictionary, so they are never "missing" nor "stale")
  const failures = (lang.partialDictionary ? 0 : missing.length) + empty.length + mismatched.length;
  const status = failures ? "FAIL" : lang.partialDictionary ? "PART" : "ok  ";
  console.log(
    `${status} ${lang.id.padEnd(9)} ${keys.length - missing.length}/${keys.length}` +
      `  ${lang.partialDictionary ? "fallback" : "missing"}=${missing.length}` +
      ` empty=${empty.length} placeholders=${mismatched.length} stale=${stale.length}`,
  );
  problems += failures;
  if (args.has("--verbose")) {
    if (!lang.partialDictionary) {
      for (const k of missing) console.log(`    missing: ${JSON.stringify(k)}`);
    }
    for (const k of empty) console.log(`    empty:   ${JSON.stringify(k)}`);
    for (const k of mismatched) console.log(`    placeholder mismatch: ${JSON.stringify(k)}`);
    for (const k of stale) console.log(`    stale:   ${JSON.stringify(k)}`);
  }
}

if (dynamicWarnings.length) {
  console.log(
    `\nWARNING: ${dynamicWarnings.length} dynamic template literal(s) inside translated calls.` +
      "\nThese cannot be dictionary keys. Use a {placeholder} key + vars, e.g. tx(\"Hello {name}\", { name }):",
  );
  for (const w of dynamicWarnings) console.log(`  ${w}`);
  problems += dynamicWarnings.length;
}

process.exit(problems ? 1 : 0);
