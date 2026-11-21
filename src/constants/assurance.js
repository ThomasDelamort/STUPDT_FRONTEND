// ============================================================================
// ASSURANCE BUTTON - dialogue tree for the chain of "are you sure?" popups.
//
// Each step is one popup with a Yes and a No button. `yes` / `no` point at the
// next step id, or at an `{ end: true, toast }` object that closes the popup and
// shows the toast. Switching answers mid-chain restarts at ASSURANCE_START.
//
//   Yes chain: start -> yes2 -> yes3 -> yes4 -> END
//   No chain:  start -> no2  -> no3  -> no4  -> END
// ============================================================================

export const ASSURANCE_START = "start";

const END_AFTER_YES = {
  end: true,
  toast: "Assurance granted. You may now proceed to nothing.",
};

const END_AFTER_NO = {
  end: true,
  toast: "Feelings logged. Your ticket was escalated to the Department of Awkward Silence.",
};

export const ASSURANCE_STEPS = {
  start: {
    text: "Are you sure you want to proceed?",
    yes: "yes2",
    no: "no2",
  },
  yes2: {
    text: "Are you really sure you want to proceed?",
    yes: "yes3",
    no: ASSURANCE_START,
  },
  yes3: {
    text: "Are you really really sure you want to proceed?",
    yes: "yes4",
    no: ASSURANCE_START,
  },
  yes4: {
    text: "Are you really really, really sure you want to proceed?",
    yes: END_AFTER_YES,
    no: ASSURANCE_START,
  },
  no2: {
    text: "Why aren't you sure?",
    yes: ASSURANCE_START,
    no: "no3",
  },
  no3: {
    text: "I'm sorry",
    yes: ASSURANCE_START,
    no: "no4",
  },
  no4: {
    text: "You mad?",
    yes: ASSURANCE_START,
    no: END_AFTER_NO,
  },
};
