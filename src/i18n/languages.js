// ============================================================================
// LANGUAGE REGISTRY - one entry per wedge on the Wheel of Languages.
// Order here is the order around the wheel (clockwise from 12 o'clock). Real
// languages and joke dialects are interleaved on purpose: pure chaos.
// ============================================================================

export const DEFAULT_LANGUAGE_ID = "en";

// Poster palette (see README "Design language"). `ink` is the label colour that
// stays readable on the matching fill.
const WEDGE_COLORS = [
  { color: "#0EC7F5", ink: "#08080A" },
  { color: "#FFE600", ink: "#08080A" },
  { color: "#F52820", ink: "#FFFFFF" },
  { color: "#1FE03F", ink: "#08080A" },
  { color: "#3888F2", ink: "#FFFFFF" },
  { color: "#FF6B1A", ink: "#08080A" },
];

const BASE_LANGUAGES = [
  { id: "en", nativeName: "English", code: "EN", htmlLang: "en" },
  { id: "es", nativeName: "Español", code: "ES", htmlLang: "es" },
  { id: "pirate", nativeName: "Pirate", code: "ARR", htmlLang: "en-x-pirate", partialDictionary: true },
  { id: "fr", nativeName: "Français", code: "FR", htmlLang: "fr" },
  { id: "de", nativeName: "Deutsch", code: "DE", htmlLang: "de" },
  { id: "brainrot", nativeName: "Skibidi", code: "SKB", htmlLang: "en-x-brainrot", partialDictionary: true },
  { id: "ja", nativeName: "日本語", code: "JA", htmlLang: "ja" },
  { id: "pt", nativeName: "Português", code: "PT", htmlLang: "pt" },
  { id: "klingon", nativeName: "tlhIngan", code: "TLH", htmlLang: "tlh", partialDictionary: true },
  { id: "fil", nativeName: "Filipino", code: "FIL", htmlLang: "fil" },
  { id: "hi", nativeName: "हिन्दी", code: "HI", htmlLang: "hi" },
  { id: "piglatin", nativeName: "Igpay Atinlay", code: "PIG", htmlLang: "en-x-piglatin" },
];

export const LANGUAGES = BASE_LANGUAGES.map((lang, i) => ({
  ...lang,
  ...WEDGE_COLORS[i % WEDGE_COLORS.length],
}));

export function getLanguage(id) {
  return LANGUAGES.find((l) => l.id === id) || LANGUAGES.find((l) => l.id === DEFAULT_LANGUAGE_ID);
}

export function isKnownLanguage(id) {
  return LANGUAGES.some((l) => l.id === id);
}
