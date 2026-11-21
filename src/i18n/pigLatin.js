// ============================================================================
// PIG LATIN - algorithmic "translation", so it works on ANY string, including
// runtime text no dictionary could ever cover. `{placeholder}` tokens are left
// untouched so interpolation still works afterwards.
// ============================================================================

// A word (with optional inner apostrophes) or a {placeholder}.
const TOKEN_RE = /\{\w+\}|[A-Za-z]+(?:['’][A-Za-z]+)*/g;

function firstVowelIndex(lower) {
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if ("aeiou".includes(ch)) {
      // "qu" travels together: queen -> eenquay
      if (ch === "u" && i > 0 && lower[i - 1] === "q") return i + 1;
      return i;
    }
    // y is a vowel only when it is not the first letter: rhythm -> ythmrhay
    if (ch === "y" && i > 0) return i;
  }
  return -1;
}

function pigWord(word) {
  const lower = word.toLowerCase();
  const letters = word.replace(/[^A-Za-z]/g, "");
  const isAllCaps = letters.length > 1 && letters === letters.toUpperCase();
  const isCapitalized = !isAllCaps && /^[A-Z]/.test(word);

  let out;
  const idx = firstVowelIndex(lower);
  if (idx === 0) {
    out = lower + "way";
  } else if (idx === -1) {
    out = lower + "ay";
  } else {
    out = lower.slice(idx) + lower.slice(0, idx) + "ay";
  }

  if (isAllCaps) return out.toUpperCase();
  if (isCapitalized) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

export function toPigLatin(text) {
  if (typeof text !== "string") return text;
  return text.replace(TOKEN_RE, (tok) => (tok.startsWith("{") ? tok : pigWord(tok)));
}
