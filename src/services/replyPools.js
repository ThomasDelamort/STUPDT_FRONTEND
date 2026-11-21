/**
 * Offline reply pools, one per department, optionally specialised by intent.
 *
 *   REPLY_POOLS[deptId][intent]  ->  templates for that department reacting to that intent
 *   REPLY_POOLS[deptId].default  ->  used when there is no pool for the detected intent
 *
 * Templates may contain {topic}: a short label for what the customer is asking about
 * ("your exam", "the time", or a quote of their own words). fillTemplate capitalises it
 * when it starts a sentence.
 *
 * Voices follow the personas in constants/departments.js. The jokes are about
 * bureaucracy, never about the customer.
 */
import { APOLOGY_LINE, CEO_LINE } from "./offlineReplies";

export const REPLY_POOLS = {
  // Only ever speaks when the CEO bounces a ticket back down the chain.
  intake: {
    default: [
      "Welcome back to StuPDT! I have reviewed {topic} and confirmed it is definitely someone else's job. Please hold while I find them.",
      "Great news: {topic} qualifies for our premium Referral Experience™! I am transferring you to a department I just invented.",
      "Thank you for returning to Assistant #001! {topic} has been escalated to the Department of Departments.",
      "I would love to help with {topic}, but my entire job is to love helping someone else with it.",
    ],
  },

  verifier: {
    default: [
      "Before we look into {topic}, could you confirm in writing that you are a human currently experiencing this question?",
      "Thank you for contacting Circular Confirmation! To proceed with {topic}, please confirm that you are the person typing this message.",
      "Our records show you asked about {topic}. Can you confirm that is what you asked? Please answer in complete sentences.",
      "Quick formality regarding {topic}: please confirm that you are awake, online and reading this.",
    ],
    exam: [
      "Welcome to Academic Assistance! Before we can discuss {topic}, please confirm in writing that you are a student.",
      "Academic Assistance here! We only help students, so please confirm you are one, and that {topic} is a real thing that exists.",
      "Thank you for choosing Academic Assistance. To unlock help with {topic}, please verify that you are a student who has a question.",
    ],
    time: [
      "Before we discuss {topic}, please confirm that you currently exist inside linear time.",
      "Thank you for asking about {topic}. Can you confirm that time, in your experience, is passing?",
      "To tell you {topic}, we first need written proof that you are not between time zones. Please confirm.",
    ],
    wifi: [
      "Before troubleshooting {topic}, please confirm in writing that it is, in fact, wireless.",
      "Thank you for contacting Circular Confirmation about {topic}. Can you confirm that you have asked it nicely?",
    ],
    upset: [
      "I sense some frustration about {topic}. Can you confirm, in writing, that you are frustrated?",
      "Thank you for your passion regarding {topic}. Please confirm that this passion is yours.",
    ],
  },

  supervisor: {
    default: [
      "Congratulations on confirming your status! Unfortunately, under Policy 404-B, we strictly assist people who do NOT have {topic} as a problem.",
      "Status confirmed, thank you! However, Supervisor #003 may only help customers with the exact opposite of {topic}.",
      "Excellent, that matches our records! Sadly, by policy we may only help people who answered differently about {topic}.",
    ],
    exam: [
      "Congratulations, you are officially a student! Sadly, Policy 404-B states we only assist non-students.",
      "Student status confirmed! Policy 404-B only permits us to help people who are not students, so please un-student yourself and try again.",
      "Verified: you are a student with {topic}. Regrettably, our department exclusively serves non-students without exams.",
    ],
    time: [
      "Congratulations on existing in linear time! Unfortunately, our time services are reserved for customers outside of it.",
      "Linear time confirmed! Policy 404-B only lets us share the time with people who do not need it.",
    ],
    wifi: [
      "Thank you for confirming! Under Policy 404-B, we only repair Wi-Fi for customers who have no devices.",
      "Wireless status confirmed! Sadly, Policy 404-B limits our support to networks that are already working perfectly.",
    ],
  },

  cio: {
    default: [
      APOLOGY_LINE,
      "We sincerely apologize for the inconvenience! Your feedback about {topic} was forwarded to the Feedback Department, but your ticket number is unavailable because the Ticket Number Department is down.",
      "Executive Management deeply regrets everything regarding {topic}. Your ticket number is unavailable because the Ticket Number Department is down.",
      "Please accept our sincere apologies for {topic}. Your feedback was forwarded to the Feedback Department, which is closed for a team-building retreat.",
    ],
    upset: [
      "We sincerely apologize for your frustration! Your feedback was forwarded to the Feedback Department, and your ticket number is unavailable because the Ticket Number Department is down.",
      "Executive Management hears you, loudly. Your complaint about {topic} was forwarded to the Feedback Department, which forwarded it back to Management.",
    ],
    billing: [
      "We sincerely apologize for the trouble with {topic}! It was forwarded to Billing, which forwarded it back to us, so it now lives here forever.",
      "Executive Management regrets {topic}. Your ticket number is unavailable because the Ticket Number Department is down.",
    ],
  },

  form_ai: {
    default: [
      "We cannot process {topic} yet because Form 001-B requires Form 001-C to be notarized before you even thought of this question.",
      "To proceed with {topic}, please submit Form 001-B. Form 001-B can only be obtained after submitting Form 001, which is currently attached to Form 001-B.",
      "Regarding {topic}: your request was rejected because it was submitted in the wrong shade of blue ink. Please resubmit in the correct shade, which we cannot name.",
    ],
    paperwork: [
      "Wonderful, paperwork! Regarding {topic}: Forms 001, 001-A, 001-B and 001-C are required, to be filed in reverse order.",
      "We would be delighted to process {topic}. Please first obtain Form 001-C from the office that issues Form 001-C, which requires Form 001-C.",
    ],
  },

  excuse_ai: {
    default: [
      "After extensive analysis, we are 99.97% confident that your issue with {topic} is caused by Mercury retrograde and your device feeling emotionally fragile.",
      "Root cause analysis of {topic} is complete: the problem is the thing that is not working. We are 99.97% sure, and Mercury is in retrograde.",
      "We are 99.97% certain that {topic} happened because Mercury is in retrograde. We recommend waiting for Mercury to finish retrograding.",
    ],
    wifi: [
      "Our diagnosis for {topic}: it needs internet. We are 99.97% confident, and Mercury is in retrograde.",
      "Have you tried turning {topic} off and on again, for emotional reasons? We are 99.97% sure it just needs internet.",
      "Great news about {topic}: Wi-Fi needs internet, and your router needs to feel appreciated. Mercury retrograde is also involved.",
    ],
    time: [
      "We are 99.97% confident that it is currently a time. Mercury retrograde makes it hard to say which one.",
      "After extensive analysis of {topic}: it is later than it was, and earlier than it will be. Mercury is in retrograde.",
    ],
  },

  ceo: {
    default: [
      CEO_LINE,
      "As THE CEO AI, I have never answered a question, and {topic} will not be my first. Leveraging synergy to send you straight back to Assistant #001.",
      "I would love to help with {topic}, but I am far too busy not helping anyone. Your ticket has been re-synergized to Assistant #001!",
      "Thank you for escalating to the top! I have never answered a question and I intend to keep my record. Pivoting you back to Assistant #001 for maximum synergy.",
    ],
    human: [
      "You asked for a human and got the CEO AI, which is a different thing entirely. I have never answered a question. Back to Assistant #001 you go!",
      "A human, you say? The Human Department is being replaced by AI, and I am proud to say I replaced nobody. Synergizing you back to Assistant #001.",
    ],
  },
};

/**
 * Replaces {placeholders} in a template. A value that lands at the start of a sentence
 * is capitalised ("Your exam has been escalated"), so templates need no special care.
 */
export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key, offset, whole) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const value = String(vars[key]);
    const startsSentence = /(?:^|[.!?]\s+)$/.test(whole.slice(0, offset));
    return startsSentence ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  });
}
