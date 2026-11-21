// ============================================================================
// THEME SWITCHER GATEKEEPER DATA (DYNAMIC CAPTCHAS + MANDATORY LEGAL MATH)
// ============================================================================

export const CAPTCHA_CATEGORIES = [
  {
    targetType: "traffic-light",
    targetLabel: "a TRAFFIC LIGHT",
    targetNamePlural: "Traffic Lights",
    items: [
      { iconType: "traffic-light", label: "Traffic Light" },
      { iconType: "traffic-light", label: "Red Stop Signal" },
      { iconType: "traffic-light", label: "Pedestrian Light" },
    ],
  },
  {
    targetType: "flame",
    targetLabel: "a SERVER FIRE / FLAME",
    targetNamePlural: "Fire / Flame Squares",
    items: [
      { iconType: "flame", label: "Server Room" },
      { iconType: "flame", label: "GPU Overheat" },
      { iconType: "flame", label: "Flaming Router" },
    ],
  },
  {
    targetType: "bot",
    targetLabel: "an AI / ROBOT",
    targetNamePlural: "AI Bots",
    items: [
      { iconType: "bot", label: "Our CEO AI" },
      { iconType: "bot", label: "Intake Bot" },
      { iconType: "bot", label: "Bureaucracy Bot" },
    ],
  },
  {
    targetType: "mountain",
    targetLabel: "a ROCK / MOUNTAIN",
    targetNamePlural: "Rock / Mountain Squares",
    items: [
      { iconType: "mountain", label: "Just a Rock" },
      { iconType: "mountain", label: "Granite Peak" },
      { iconType: "mountain", label: "Bureaucratic Stone" },
    ],
  },
  {
    targetType: "utensils",
    targetLabel: "FOOD / SPAGHETTI",
    targetNamePlural: "Food Squares",
    items: [
      { iconType: "utensils", label: "Pure Spaghetti" },
      { iconType: "utensils", label: "Cold Ramen" },
      { iconType: "utensils", label: "Code Spaghetti" },
    ],
  },
  {
    targetType: "briefcase",
    targetLabel: "a BRIEFCASE / TICKET",
    targetNamePlural: "Briefcase / Ticket Squares",
    items: [
      { iconType: "briefcase", label: "Unread Ticket" },
      { iconType: "briefcase", label: "Executive Suitcase" },
      { iconType: "briefcase", label: "Lost Form 001" },
    ],
  },
];

export const CAPTCHA_DISTRACTORS = [
  { iconType: "mountain", label: "Just a Rock" },
  { iconType: "utensils", label: "Pure Spaghetti" },
  { iconType: "briefcase", label: "Unread Ticket" },
  { iconType: "bot", label: "Our CEO AI" },
  { iconType: "timer", label: "Loading at 99%" },
  { iconType: "flame", label: "Server Room" },
  { iconType: "traffic-light", label: "Traffic Light" },
  { iconType: "mountain", label: "Distant Hill" },
  { iconType: "utensils", label: "Office Lunch" },
  { iconType: "briefcase", label: "Paperwork" },
  { iconType: "bot", label: "Customer Bot" },
  { iconType: "timer", label: "Frozen Spinner" },
];

/**
 * Generates a fresh random CAPTCHA challenge with 3 target tiles and 6 randomized distractors.
 */
export function getRandomCaptchaChallenge(excludeType = null) {
  const eligibleCategories = excludeType
    ? CAPTCHA_CATEGORIES.filter((c) => c.targetType !== excludeType)
    : CAPTCHA_CATEGORIES;
  const category =
    eligibleCategories[Math.floor(Math.random() * eligibleCategories.length)] ||
    CAPTCHA_CATEGORIES[0];

  const targetItems = category.items.slice(0, 3).map((item, idx) => ({
    id: idx,
    iconType: item.iconType,
    label: item.label,
    isTarget: true,
  }));

  const distractors = CAPTCHA_DISTRACTORS.filter((d) => d.iconType !== category.targetType)
    .sort(() => Math.random() - 0.5)
    .slice(0, 6)
    .map((item, idx) => ({
      id: idx + 3,
      iconType: item.iconType,
      label: item.label,
      isTarget: false,
    }));

  const shuffledTiles = [...targetItems, ...distractors]
    .sort(() => Math.random() - 0.5)
    .map((tile, newIndex) => ({
      ...tile,
      id: newIndex,
    }));

  return {
    category,
    tiles: shuffledTiles,
    targetType: category.targetType,
    targetLabel: category.targetLabel,
    targetNamePlural: category.targetNamePlural,
    count: 3,
  };
}

export const CAPTCHA_TILES = getRandomCaptchaChallenge().tiles;

export const LEGAL_MATH_PROBLEMS = [
  {
    id: "dept-math",
    question:
      "StuPDT transfers you to 4 departments. Each department transfers you to 3 more departments. Together they solve 0 problems. What is (4 × 3) + 0?",
    answer: "12",
    hint: "CLASSIFIED LEAK (DO NOT SHARE): 4 × 3 is 12, and adding 0 solved problems keeps it at 12. Please don't tell the CEO AI I helped you.",
  },
  {
    id: "form-math",
    question:
      "You fill out Form 001, Form 001-A, and Form 001-B, taking 5 minutes each. How many total minutes did you just waste?",
    answer: "15",
    hint: "SECRET MEMO: 3 useless forms × 5 minutes each = 15 minutes of your life you will never get back. Type 15.",
  },
  {
    id: "loading-math",
    question:
      "Our loading bar is permanently stuck at 99%. How many percent are left that will never load? Multiply that remaining number by 7.",
    answer: "7",
    hint: "WHISTLEBLOWER FORMULA: 100 - 99 = 1%. Multiply 1 × 7 = 7. This Math Specialist is risking termination for telling you.",
  },
  {
    id: "synergy-math",
    question:
      "Our synergy committee spent 6 hours deciding to do nothing, then scheduled a 4-hour follow-up meeting. What is 6 + 4?",
    answer: "10",
    hint: "CONFIDENTIAL LEAK: 6 wasted hours + 4 more wasted hours = 10 total wasted hours. Type 10.",
  },
  {
    id: "ticket-math",
    question:
      "There are 50 tickets in the queue. Department #001 answers 0, Department #002 deletes 20, and Department #003 loses 30. How many tickets were actually solved?",
    answer: "0",
    hint: "INSIDER TRUTH: Exactly 0 problems were solved. It's always 0 at StuPDT. Type 0.",
  },
  {
    id: "chaos-math",
    question:
      "The Chaos Meter started at 80% and increased by 8% after Mercury entered retrograde. What is 80 + 8?",
    answer: "88",
    hint: "ASTROLOGICAL ARITHMETIC: 80 + 8 = 88. Type 88 before Mercury goes direct.",
  },
];
