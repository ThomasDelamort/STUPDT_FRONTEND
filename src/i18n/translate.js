import { DEFAULT_LANGUAGE_ID } from "./languages";
import { DICTIONARIES } from "./translations";
import { toPigLatin } from "./pigLatin";

const PLACEHOLDER_RE = /\{(\w+)\}/g;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Translate one string WITHOUT interpolation. Dictionary languages look the
 * exact English text up and fall back to the English text itself when there is
 * no entry; Pig Latin is algorithmic so it transforms everything.
 */
function translateText(text, langId) {
  if (langId === DEFAULT_LANGUAGE_ID) return text;
  if (langId === "piglatin") return toPigLatin(text);
  const dict = DICTIONARIES[langId];
  return dict && hasOwn(dict, text) ? dict[text] : text;
}

/**
 * translate("LIVE AGENT: {name}", "es", { name: "StuPDT Assistant #001" })
 *
 * - Non-strings (numbers, undefined, ...) pass straight through, like the old tx().
 * - The English string IS the key; missing translations fall back to English.
 * - `{name}` placeholders are filled after translating. String values are
 *   translated too, so a department name inside a sentence matches how that
 *   same name is shown everywhere else.
 */
export function translate(text, langId = DEFAULT_LANGUAGE_ID, vars) {
  if (typeof text !== "string" || text === "") return text;
  const translated = translateText(text, langId);
  if (!vars) return translated;
  return translated.replace(PLACEHOLDER_RE, (match, key) => {
    if (!hasOwn(vars, key)) return match;
    const value = vars[key];
    return typeof value === "string" ? translateText(value, langId) : String(value);
  });
}
