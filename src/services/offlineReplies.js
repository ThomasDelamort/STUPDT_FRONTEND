/**
 * Static strings that already have translations in the i18n catalog.
 *
 * They live in their own leaf module because the catalog is keyed by the EXACT English
 * string and scripts/check-i18n.mjs tracks this file's literals, so moving one elsewhere
 * would silently drop its coverage check. Everything else the offline engine can say
 * lives in replyPools.js, and the routing/selection logic in conversationEngine.js.
 */

export const APOLOGY_LINE = `We sincerely apologize for the inconvenience! Your concern has been forwarded to someone who will immediately forward it to someone else.`;

export const CEO_LINE = `As THE CEO AI, I am proud to say I have never answered a single question. Synergizing your ticket straight back to Assistant #001!`;

export const FINALE_CHIP_LABEL = `Trigger Finale: "StuPDT, PLEASE JUST ANSWER MY QUESTION."`;
