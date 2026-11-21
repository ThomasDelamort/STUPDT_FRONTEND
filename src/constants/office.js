// ============================================================================
// THE OFFICE: data for the idle sprite scene + staff huddle
// ----------------------------------------------------------------------------
// Everything here is data: roster, personas, stations, cast scenes, the
// navigation polygons, occluders, the semantic pose registry and all
// dialogue. Coordinates are WORLD px in the 1672x941 office image.
// Station anchors were eyeballed and then calibrated with `?office-debug`.
// ============================================================================

export const OFFICE_WORLD = { w: 1672, h: 941 };

// ---------------------------------------------------------------------------
// Roster & personas (affectionate placeholders, tune freely)
// ---------------------------------------------------------------------------
/**
 * @typedef {{ id: string, name: string, atlas: string, enabled: boolean,
 *   accent: string, emote: string, persona: string,
 *   affinity: Record<string, number> }} OfficeCharacter
 */

/** @type {OfficeCharacter[]} */
export const OFFICE_ROSTER = [
  {
    id: "gab",
    name: "Gab",
    atlas: "gab",
    enabled: true,
    accent: "#FF6B1A",
    emote: "ROCK",
    persona: "Unbothered. Settles every dispute with rock-paper-scissors.",
    affinity: { beanbag: 3, couch: 2 },
  },
  {
    id: "neal",
    name: "Neal",
    atlas: "neal",
    enabled: true,
    accent: "#0EC7F5",
    emote: "PRESENT",
    persona: "Over-explains. Keeps opening the laptop to present a deck.",
    affinity: { computer: 3, chess: 2 },
  },
  {
    id: "drake",
    name: "Drake",
    atlas: "drake",
    enabled: true,
    accent: "#1FE03F",
    emote: "THUMBS UP",
    persona: "Hype-man. Thumbs-up while everything burns.",
    affinity: { weights: 3, bag: 3, pullup: 2 },
  },
  {
    id: "janus",
    name: "Janus",
    atlas: "janus",
    enabled: true,
    accent: "#FFE600",
    emote: "PEACE",
    persona: "Chaos goblin. Makes deeply unhelpful suggestions.",
    affinity: { pingpong: 3, chess: 2 },
  },
  // Not in the four-person brief: processed and ready, flip `enabled` to cast.
  {
    id: "nimrod",
    name: "Nimrod",
    atlas: "nimrod",
    enabled: false,
    accent: "#F52820",
    emote: "APPLAUSE",
    persona: "Holds the mic. Presents and explains, at length.",
    affinity: { couch: 2, computer: 1 },
  },
  {
    id: "suit",
    name: "The Suit",
    atlas: "suit",
    enabled: false,
    accent: "#F5E9D8",
    emote: "WAVE",
    persona: "Management. Waves on the way past.",
    affinity: { chess: 2 },
  },
  {
    id: "suitvoxel",
    name: "The Other Suit",
    atlas: "suitvoxel",
    enabled: false,
    accent: "#F5E9D8",
    emote: "WAVE",
    persona: "Also management. Nobody knows which one is in charge.",
    affinity: { couch: 2 },
  },
];

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
export const OFFICE_DEPTH = {
  // mild depth scaling: 0.9x at the back wall -> 1.1x at the front edge
  yBack: 395,
  yFront: 941,
  scaleBack: 0.9,
  scaleFront: 1.1,
};

// ---------------------------------------------------------------------------
// Activities & spots
// ---------------------------------------------------------------------------
/** The nine required activities (coverage-tracked by the director). */
export const OFFICE_ACTIVITIES = [
  "computer",
  "pingpong1v1",
  "pingpong2v2",
  "couch",
  "chess",
  "pullup",
  "bag",
  "weights",
  "beanbag",
];

/** Human labels (debug overlay / notes). */
export const OFFICE_ACTIVITY_LABELS = {
  computer: "Using the computer",
  pingpong1v1: "1v1 table tennis",
  pingpong2v2: "2v2 table tennis",
  couch: "All four on the couch",
  chess: "1v1 chess",
  pullup: "Pull-ups",
  bag: "Punching bag",
  weights: "Lifting weights",
  beanbag: "Bean bag nap",
};

/** Which affinity key an activity counts towards. */
export const OFFICE_ACTIVITY_AFFINITY = {
  computer: "computer",
  pingpong1v1: "pingpong",
  pingpong2v2: "pingpong",
  couch: "couch",
  chess: "chess",
  pullup: "pullup",
  bag: "bag",
  weights: "weights",
  beanbag: "beanbag",
};

/**
 * Individual spots. `x,y` = feet anchor when performing. `approach` = the
 * walkable point pathing targets; the ENTER/EXIT step between approach and
 * anchor is scripted (it may pass "into" furniture, e.g. sitting down).
 * `face`: 1 = screen-right, -1 = screen-left. `view`: turnaround view.
 * `behind`: occluder the actor stays behind from ENTER to EXIT, so stepping
 * into a seat from the front doesn't pop across the seat's depth line.
 */
export const OFFICE_SPOTS = {
  computer: { x: 437, y: 468, approach: { x: 437, y: 522 }, view: "back", behind: "deskChair" },
  pullup: { x: 708, y: 392, approach: { x: 708, y: 470 }, barY: 186 },
  bag: { x: 774, y: 458, face: 1 },
  weights: { x: 912, y: 450, face: -1 },
  ppL: { x: 978, y: 428, face: 1 },
  ppR: { x: 1432, y: 425, face: -1 },
  ppL2a: { x: 970, y: 404, face: 1 },
  ppL2b: { x: 992, y: 466, face: 1 },
  ppR2a: { x: 1404, y: 418, face: -1 },
  ppR2b: { x: 1440, y: 476, face: -1 },
  couch0: { x: 300, y: 742, approach: { x: 524, y: 780 }, view: "front", behind: "couchFront" },
  couch1: { x: 412, y: 738, approach: { x: 556, y: 806 }, view: "front", behind: "couchFront" },
  couch2: { x: 530, y: 722, approach: { x: 590, y: 780 }, view: "front", behind: "couchFront" },
  couch3: { x: 640, y: 712, approach: { x: 620, y: 806 }, view: "front", behind: "couchFront" },
  chessA: { x: 752, y: 812, approach: { x: 740, y: 928 }, view: "backRight", face: 1, behind: "chessChairA" },
  chessB: { x: 995, y: 664, approach: { x: 1078, y: 590 }, view: "frontLeft", face: -1 },
  beanbag: { x: 1508, y: 712, approach: { x: 1345, y: 690 }, face: 1 },
};

/** Activity -> how many actors and which spots. */
export const OFFICE_GROUPS = {
  computer: { activity: "computer", spots: ["computer"] },
  pullup: { activity: "pullup", spots: ["pullup"] },
  bag: { activity: "bag", spots: ["bag"] },
  weights: { activity: "weights", spots: ["weights"] },
  beanbag: { activity: "beanbag", spots: ["beanbag"] },
  pingpong1v1: { activity: "pingpong1v1", spots: ["ppL", "ppR"] },
  pingpong2v2: { activity: "pingpong2v2", spots: ["ppL2a", "ppL2b", "ppR2a", "ppR2b"] },
  chess: { activity: "chess", spots: ["chessA", "chessB"] },
  couch: { activity: "couch", spots: ["couch0", "couch1", "couch2", "couch3"] },
};

/** Solo activities can re-roll inside a scene. */
export const OFFICE_SOLO = ["computer", "pullup", "bag", "weights", "beanbag"];

/**
 * Weighted cast scenes (hotkeys 1-9 in debug force these in order).
 * Each scene assigns all four actors.
 */
export const OFFICE_SCENES = [
  { id: "pp2v2", label: "2v2 Table Tennis Grand Final", weight: 1, groups: ["pingpong2v2"] },
  { id: "couch4", label: "Couch Summit (All Hands)", weight: 1, groups: ["couch"] },
  { id: "chess_pc_weights", label: "Chess, Code & Curls", weight: 1, groups: ["chess", "computer", "weights"] },
  { id: "pp1v1_bean_pullup", label: "Rally, Nap, Reps", weight: 1, groups: ["pingpong1v1", "beanbag", "pullup"] },
  { id: "chess_bag_bean", label: "Grandmasters & Grievances", weight: 1, groups: ["chess", "bag", "beanbag"] },
  { id: "pp1v1_pc_bag", label: "Rally, Code, Punch", weight: 1, groups: ["pingpong1v1", "computer", "bag"] },
  { id: "gym", label: "Mandatory Wellness Hour", weight: 0.8, groups: ["pullup", "bag", "weights", "computer"] },
  { id: "chess_pullup_bean", label: "Quiet Hours (Allegedly)", weight: 0.8, groups: ["chess", "pullup", "beanbag"] },
  { id: "pp1v1_chess", label: "Tournament Season", weight: 0.9, groups: ["pingpong1v1", "chess"] },
];

/** Open floor points for wandering and look-arounds. */
export const OFFICE_WANDER = [
  { x: 640, y: 525 },
  { x: 880, y: 515 },
  { x: 1120, y: 530 },
  { x: 1290, y: 560 },
  { x: 834, y: 592 },
  { x: 1040, y: 590 },
  { x: 560, y: 520 },
  { x: 1266, y: 646 },
  { x: 1330, y: 760 },
  { x: 560, y: 880 },
];

/** The huddle: ellipse around the open floor between the rug and chess. */
export const OFFICE_HUDDLE = {
  // calibrated: every slot clears the couch arm (left), the chess table
  // (below) and the mouth of the desk/couch corridor, so nobody standing in
  // a slot can wall off another actor's route
  x: 970,
  y: 535,
  rx: 178,
  ry: 52,
  // slot angles (degrees, screen space: 90 = towards the camera)
  slots: [190, 255, 345, 80, 300, 215],
  ticketPile: { x: 968, y: 548 },
};

// ---------------------------------------------------------------------------
// Navigation (walkable floor minus furniture footprints)
// ---------------------------------------------------------------------------
export const OFFICE_NAV = {
  // The floor continues a little below the frame: the front of the couch is
  // only reachable through the foreground (the couch arm touches a chess
  // chair in the art), so walkers there are cropped by the frame edge.
  height: 1004,
  cell: 16, // A* grid size (world px)
  radius: 14, // actor footprint radius used to inflate obstacles
  walk: [
    [196, 500],
    [598, 500],
    [606, 452],
    [612, 400],
    [1418, 390],
    [1528, 418],
    [1528, 532],
    [1672, 532],
    [1672, 1000],
    [0, 1000],
    [0, 524],
    [196, 524],
  ],
  obstacles: [
    {
      id: "couch",
      poly: [
        [124, 560],
        [470, 548],
        [768, 545],
        [770, 700],
        [640, 714],
        [476, 754],
        [476, 802],
        [124, 802],
      ],
    },
    { id: "sideTable", poly: [[0, 794], [506, 794], [506, 941], [0, 941]] },
    { id: "plantTopLeft", poly: [[0, 664], [140, 664], [140, 800], [0, 800]] },
    { id: "deskChair", poly: [[372, 436], [506, 436], [506, 490], [372, 490]] },
    { id: "rackPostL", poly: [[586, 392], [614, 392], [614, 450], [586, 450]] },
    { id: "rackPostR", poly: [[776, 388], [806, 388], [806, 446], [776, 446]] },
    { id: "dumbbells", poly: [[786, 378], [870, 378], [870, 434], [786, 434]] },
    {
      id: "pingpong",
      poly: [
        [1040, 388],
        [1392, 384],
        [1388, 448],
        [1048, 470],
      ],
    },
    {
      id: "chess",
      poly: [
        [700, 618],
        [1242, 610],
        [1242, 902],
        [842, 908],
        [636, 908],
        [636, 702],
      ],
    },
    {
      id: "beanbag",
      poly: [
        [1372, 562],
        [1672, 546],
        [1672, 806],
        [1400, 804],
        [1370, 700],
      ],
    },
    { id: "plantBottomRight", poly: [[1488, 784], [1672, 760], [1672, 941], [1488, 941]] },
    { id: "pillar", poly: [[1418, 350], [1528, 350], [1528, 414], [1418, 414]] },
  ],
};

// ---------------------------------------------------------------------------
// Occluders: a second copy of office.png clipped to the furniture that must
// cover sprites. `sortY` joins the same depth sort as the sprites' feet.
// ---------------------------------------------------------------------------
export const OFFICE_OCCLUDERS = [
  {
    id: "couchFront",
    sortY: 790,
    poly: [
      [124, 598],
      [250, 600],
      [262, 690],
      [470, 700],
      [474, 690],
      [600, 684],
      [610, 680],
      [700, 666],
      [770, 664],
      [770, 708],
      [640, 716],
      [478, 756],
      [478, 802],
      [124, 802],
    ],
  },
  {
    id: "chessTable",
    sortY: 795,
    poly: [
      [800, 704],
      [930, 690],
      [1218, 678],
      [1238, 690],
      [1238, 790],
      [1232, 900],
      [1204, 904],
      [1200, 800],
      [866, 806],
      [862, 904],
      [834, 904],
      [822, 798],
      [800, 790],
    ],
  },
  {
    id: "chessChairA",
    sortY: 906,
    poly: [
      [690, 792],
      [836, 782],
      [836, 906],
      [690, 906],
    ],
  },
  {
    id: "deskChair",
    sortY: 484,
    poly: [
      [374, 318],
      [500, 316],
      [502, 420],
      [474, 436],
      [474, 480],
      [392, 480],
      [392, 436],
      [372, 420],
    ],
  },
  {
    id: "pingpongTable",
    sortY: 450,
    poly: [
      [1020, 352],
      [1064, 312],
      [1342, 318],
      [1394, 346],
      [1394, 368],
      [1384, 448],
      [1054, 472],
      [1024, 372],
    ],
  },
  {
    id: "beanbagLip",
    sortY: 790,
    poly: [
      [1372, 640],
      [1420, 690],
      [1500, 722],
      [1600, 726],
      [1672, 704],
      [1672, 806],
      [1380, 806],
    ],
  },
  {
    id: "lampTable",
    sortY: 941,
    poly: [
      [132, 712],
      [232, 712],
      [232, 790],
      [506, 790],
      [506, 941],
      [24, 941],
      [24, 790],
      [132, 790],
    ],
  },
  {
    id: "plantBottomRight",
    sortY: 941,
    poly: [
      [1494, 742],
      [1580, 730],
      [1672, 728],
      [1672, 941],
      [1494, 941],
    ],
  },
];

// ---------------------------------------------------------------------------
// Props & patches (rects must match scripts/build-sprites.mjs buildPatches)
// ---------------------------------------------------------------------------
export const OFFICE_PROPS = {
  bag: {
    pivot: { x: 837, y: 146 },
    // bag + chain silhouette inside office.png
    clip: [
      [829, 143],
      [845, 143],
      [852, 212],
      [866, 218],
      [866, 336],
      [852, 348],
      [822, 348],
      [810, 336],
      [810, 218],
      [822, 212],
    ],
    patch: { x: 806, y: 152, w: 64, h: 196 },
    bodyCenter: { x: 837, y: 280 },
  },
  dumbbells: {
    patch: { x: 788, y: 378, w: 84, h: 58 },
    // dumbbell silhouettes (patch is clipped to these)
    clip: [
      [790, 392],
      [806, 380],
      [842, 384],
      [870, 398],
      [870, 432],
      [822, 434],
      [790, 424],
    ],
    rest: [
      { x: 812, y: 412 },
      { x: 846, y: 418 },
    ],
  },
  monitors: {
    poly: [
      [252, 232],
      [330, 226],
      [334, 206],
      [468, 206],
      [468, 312],
      [332, 318],
      [330, 314],
      [254, 318],
    ],
  },
  pingpong: {
    // table surface plane for the ball bounce
    left: { x: 1030, y: 352 },
    right: { x: 1385, y: 350 },
    surfaceY: 340,
    netX: 1210,
  },
};

// ---------------------------------------------------------------------------
// Semantic pose registry. Only idle(4) walk(8) run(8) jump(4) + the actions
// row + 8 turnaround views exist, so everything else is faked from those.
// Swap in dedicated art later by editing `frames` only.
//   frames: atlas frame keys (looped at fps); view: a turnaround view
//   sink: fraction of sprite height lowered (clipped by an occluder: "sit")
//   lunge/hop: px offsets; rotate: degrees; jitter: {amp, hz}; shake: px
// ---------------------------------------------------------------------------
export const OFFICE_POSES = {
  stand: { anim: "idle" },
  sit: { frames: ["idle_0", "idle_1", "idle_2", "idle_3"], fps: 1.5, sink: 0.28 },
  sitChess: { view: "auto", sink: 0.3 },
  sitThink: { frames: ["think_0"], sink: 0.3 },
  sitMove: { frames: ["interact_0"], sink: 0.3 },
  sitTalk: { frames: ["talk_0"], sink: 0.28 },
  boxGuard: { view: "right" },
  type: { view: "back", jitter: { amp: 1, hz: 8 }, sink: 0.04 },
  typeThink: { view: "backLeft", sink: 0.04 },
  paddleReady: { frames: ["idle_0", "idle_1"], fps: 3 },
  swing: { frames: ["interact_0"], lunge: 8 },
  punch: { frames: ["interact_0"], lunge: 10 },
  guard: { frames: ["idle_0", "idle_2"], fps: 3 },
  kick: { frames: ["jump_2"], rotate: -12, hop: 8 },
  pullup: { frames: ["cheer_0"] },
  lift: { frames: ["cheer_0"] },
  liftRest: { frames: ["idle_0"] },
  sleep: { frames: ["defeat_0"], breathe: true, sink: 0.12 },
  chill: { frames: ["idle_0", "idle_2"], fps: 1, sink: 0.33 },
  point: { frames: ["interact_0"] },
  shout: { frames: ["talk_0", "interact_0"], fps: 6, shake: 1.4 },
  exasperated: { frames: ["cheer_0"], mark: "?!" },
  shrug: { frames: ["emote_0"] },
  recoil: { frames: ["hurt_0"] },
  defeated: { frames: ["defeat_0"] },
  hop: { frames: ["jump_1", "jump_2", "jump_3"], fps: 8, hop: 14 },
  huff: { view: "back" },
  think: { frames: ["think_0"] },
  cheer: { frames: ["cheer_0"] },
  emote: { frames: ["emote_0"] },
  talk: { frames: ["talk_0"] },
  startle: { frames: ["jump_0"] },
  stretch: { frames: ["cheer_0"] },
};

// ---------------------------------------------------------------------------
// Dialogue (offline + deterministic: no API calls, ever)
// {snip} = the prompt, truncated (~28 chars). {dept} = department name.
// {kw}   = a keyword-tailored line (see OFFICE_KEYWORD_LINES).
// Every line must stay <= 60 chars once filled (checked in dev).
// Gestures map to OFFICE_POSES keys. `at` = who the gesture targets.
// ---------------------------------------------------------------------------

/** Keyword detectors -> tailored lines (cheap regexes, generic fallback). */
export const OFFICE_KEYWORDS = [
  { id: "exam", test: /\b(exam|study|test|quiz|homework|class)\w*/i },
  { id: "wifi", test: /\b(wi-?fi|internet|router|network|signal)\b/i },
  { id: "time", test: /\b(time|clock|o'?clock|hour|late|when)\b/i },
  { id: "answer", test: /\b(answer|help|please|just)\b/i },
];

export const OFFICE_KEYWORD_LINES = {
  exam: [
    "An exam? Have you tried not having one?",
    "Studying requires Form 001-C. In triplicate.",
    "We only tutor people with no exams.",
  ],
  wifi: [
    "Wi-Fi needs internet. 99.97% sure.",
    "Router's emotionally unstable. Let it rest.",
    "Unplug it, cry, plug it back in.",
  ],
  time: [
    "Time is a social construct, Neal.",
    "It's 4:04. Time not found.",
    "Confirm you exist in linear time first.",
  ],
  answer: [
    "They want an ANSWER?! Unprecedented.",
    "Answers are a Premium Nothing feature.",
    "Helping sets a dangerous precedent.",
  ],
  generic: [
    "Sounds like a Tuesday problem.",
    "Has anyone tried transferring it?",
    "Classic 404-B situation, honestly.",
  ],
};

/**
 * Argument arcs. Picked by a hash of the prompt text. `climax` = the beat
 * index after which a verdict may interrupt (the arc's punchline is done).
 * Each beat lists variants; the dialogue engine never repeats a line within
 * 5 consecutive prompts (falls back to OFFICE_FILLER_LINES).
 */
export const OFFICE_ARCS = [
  {
    id: "blame",
    title: "The Blame Game",
    climax: 5,
    beats: [
      {
        who: "neal",
        gesture: "point",
        at: "drake",
        lines: [
          '"{snip}"? That\'s yours.',
          'Ticket says "{snip}". Your dept.',
          '"{snip}" is a Drake problem.',
        ],
      },
      {
        who: "drake",
        gesture: "recoil",
        lines: [
          "Whoa! Love the energy. Not mine.",
          "Huge ticket. Massive. Not my dept.",
          "Me?! I just do hype and cardio.",
        ],
      },
      {
        who: "janus",
        gesture: "exasperated",
        lines: [
          "Blame Mercury. It's always Mercury.",
          "Let's blame the Wi-Fi. It can't object.",
          "I vote we blame the user. Bold move.",
        ],
      },
      { who: "neal", gesture: "shout", kw: true },
      {
        who: "gab",
        gesture: "shrug",
        lines: [
          "I'm on break. Spiritually.",
          "Not it. I called not-it in 2019.",
          "I don't make the rules. I nap.",
        ],
      },
      {
        who: "drake",
        gesture: "point",
        at: "janus",
        lines: [
          "Janus touched it last!",
          'Janus said "hmm". That\'s ownership.',
          "Janus has the vibe of an owner.",
        ],
      },
      {
        who: "janus",
        gesture: "huff",
        lines: ["I said hmm IRONICALLY.", "Hmm is not a commitment.", "I'm turning my back on this."],
      },
      {
        who: "neal",
        gesture: "emote",
        lines: [
          "Per my deck, slide 12: not us.",
          "Let me open the laptop. It's a flowchart.",
          "The flowchart has a loop. It's fine.",
        ],
      },
    ],
  },
  {
    id: "potato",
    title: "Ticket Hot Potato",
    climax: 5,
    beats: [
      {
        who: "drake",
        gesture: "cheer",
        lines: [
          "New ticket! Who wants it? Not me!",
          "Ticket in! Let's GOOO (away from me).",
          "Fresh ticket! Smells like overtime.",
        ],
      },
      {
        who: "drake",
        gesture: "point",
        at: "janus",
        ticket: "janus",
        lines: ["Not my department!", "Catch! Not my department!", "Yours now. Not my department!"],
      },
      {
        who: "janus",
        gesture: "point",
        at: "neal",
        ticket: "neal",
        lines: ["Nope. Not my department!", "Hot! Hot! Not my department!", "Return to sender. Not mine!"],
      },
      {
        who: "neal",
        gesture: "shout",
        at: "gab",
        ticket: "gab",
        lines: [
          "Technically not my department!",
          "Forwarding per policy 404-B!",
          "Escalating to Gab. Formally!",
        ],
      },
      {
        who: "gab",
        gesture: "shrug",
        lines: [
          "I don't have a department.",
          "I'm a freelancer. Of naps.",
          "Ticket stays here. I'm sitting down.",
        ],
      },
      {
        who: "gab",
        gesture: "point",
        at: "drake",
        ticket: "drake",
        lines: ["...Fine. Drake, catch.", "Boomerang. Back to Drake.", "Drake, it missed you."],
      },
      { who: "drake", gesture: "exasperated", kw: true },
      {
        who: "janus",
        gesture: "think",
        lines: [
          "What if we laminate it?",
          "We could fold it into a swan.",
          "Feed it to the shredder for luck.",
        ],
      },
    ],
  },
  {
    id: "rps",
    title: "Rock-Paper-Scissors for who has to answer",
    climax: 6,
    beats: [
      {
        who: "gab",
        gesture: "talk",
        lines: [
          "Simple. Rock-paper-scissors.",
          "We settle this the ancient way.",
          "Loser answers. Winner naps.",
        ],
      },
      {
        who: "janus",
        gesture: "talk",
        lines: ["You always throw rock, Gab.", "Bet. I've been training.", "Fine. Best of one. Go."],
      },
      {
        who: "gab",
        gesture: "emote",
        lines: ["ROCK.", "Rock. Always rock.", "Rock. It's a lifestyle."],
      },
      {
        who: "janus",
        gesture: "emote",
        lines: ["SCISSORS. Peace sign counts.", "Peace. Which is scissors.", "Scissors! I mean, peace!"],
      },
      {
        who: "neal",
        gesture: "emote",
        lines: [
          "Per the rules deck, rock wins.",
          "Slide 3: rock beats scissors.",
          "I made a ruling chart. Rock.",
        ],
      },
      {
        who: "janus",
        gesture: "hop",
        lines: ["Best of seven! BEST OF SEVEN!", "Rematch! Best of seven!", "Two out of three! Of seven!"],
      },
      { who: "drake", gesture: "cheer", kw: true },
      {
        who: "gab",
        gesture: "emote",
        lines: ["Rock.", "Still rock.", "Rock again. Undefeated."],
      },
    ],
  },
  {
    id: "vote",
    title: "The Vote",
    climax: 5,
    beats: [
      {
        who: "neal",
        gesture: "talk",
        lines: [
          'Motion: we help with "{snip}".',
          'Formal vote on "{snip}".',
          'All in favor of helping with "{snip}"?',
        ],
      },
      {
        who: "drake",
        gesture: "cheer",
        lines: ["YES! Wait, what are we voting on?", "Hype vote! Yes! Maybe!", "Thumbs up. Thumbs sideways?"],
      },
      {
        who: "janus",
        gesture: "shrug",
        lines: ["Abstain. Chaotically.", "I vote for a different question.", "I vote we vote again."],
      },
      {
        who: "gab",
        gesture: "shrug",
        lines: ["Nay. I'm comfortable.", "No. Helping is cardio.", "Nay. Also, I'm sitting."],
      },
      { who: "neal", gesture: "think", kw: true },
      {
        who: "neal",
        gesture: "exasperated",
        lines: [
          "That's 2-2. Constitutional crisis.",
          "Tie. Per bylaws, nobody helps.",
          "Unanimous: we cannot help.",
        ],
      },
      {
        who: "drake",
        gesture: "emote",
        lines: [
          "Love the democracy. Thumbs up!",
          "Great meeting, team. Huge.",
          "Democracy! Nothing happened!",
        ],
      },
    ],
  },
  {
    id: "deck",
    title: "Neal Opens The Laptop",
    climax: 5,
    beats: [
      {
        who: "neal",
        gesture: "emote",
        lines: [
          "One sec. I made a deck about this.",
          "Opening the laptop. 47 slides.",
          "I have a framework for this.",
        ],
      },
      {
        who: "janus",
        gesture: "recoil",
        lines: ["Not the laptop.", "He's opening the laptop again.", "Everybody hide. Laptop's out."],
      },
      {
        who: "neal",
        gesture: "talk",
        lines: [
          'Slide 1: what is "{snip}"?',
          'Slide 2: who owns "{snip}"?',
          'Slide 4: "{snip}", a journey.',
        ],
      },
      {
        who: "drake",
        gesture: "cheer",
        lines: ["Incredible slides. No notes!", "Standing ovation! Sitting one!", "Synergy! I felt that!"],
      },
      { who: "neal", gesture: "shout", kw: true },
      {
        who: "gab",
        gesture: "shrug",
        lines: ["Wake me at the Q&A.", "Is there a summary slide?", "This could've been a nap."],
      },
      {
        who: "neal",
        gesture: "point",
        at: "gab",
        lines: [
          "Final slide: forward it. Thank you.",
          "In conclusion: not our problem.",
          "Questions? No? Transferring.",
        ],
      },
    ],
  },
];

/** Generic argue lines used when a beat's variants are all "recently used". */
export const OFFICE_FILLER_LINES = [
  { gesture: "shout", text: "Who approved this ticket?!" },
  { gesture: "point", text: "That's a Form 001-C thing." },
  { gesture: "shrug", text: "Ticket Number Department is down." },
  { gesture: "think", text: "Have we tried transferring it?" },
  { gesture: "exasperated", text: "We ALWAYS transfer this one." },
  { gesture: "recoil", text: "Don't look at me. I'm decorative." },
  { gesture: "point", text: "Let's circle back to circling back." },
  { gesture: "shout", text: "Synergize it! Then forward it!" },
  { gesture: "think", text: "Can we outsource this to Mercury?" },
  { gesture: "shrug", text: "Policy says we only help no one." },
  { gesture: "emote", text: "Put it in the parking lot." },
  { gesture: "talk", text: "Per my last email, no." },
  { gesture: "exasperated", text: "Our SLA is 'eventually, maybe'." },
  { gesture: "point", text: "Classic Excuse & Blame AI material." },
  { gesture: "talk", text: "Let's take this offline. Forever." },
  { gesture: "shout", text: "Is the CEO AI cc'd on this?" },
  { gesture: "think", text: "What if the user is the bug?" },
  { gesture: "shrug", text: "I'd help, but I'm 99.97% confident." },
];

/** Looped while the real reply is slow ("stalling"). */
export const OFFICE_STALL_LINES = [
  { gesture: "think", text: "Still deliberating. Very hard." },
  { gesture: "talk", text: "Is it lunch yet?" },
  { gesture: "shrug", text: "Let's wait for Ticket Numbers." },
  { gesture: "talk", text: "Has anyone pinged the API?" },
  { gesture: "think", text: "Loading consensus... 99%." },
  { gesture: "shrug", text: "Hold music intensifies." },
  { gesture: "talk", text: "We're waiting on Legal. Legal is Gab." },
  { gesture: "think", text: "Someone refresh the hamsters." },
];

/** Verdict (after the real reply lands). {dept} = replying department. */
export const OFFICE_VERDICT_LINES = [
  { gesture: "cheer", text: "Verdict: {dept} has it now." },
  { gesture: "point", text: "{dept} it is. Godspeed, ticket." },
  { gesture: "emote", text: "Motion passed: blame {dept}." },
  { gesture: "cheer", text: "Unanimous! {dept}'s problem now." },
  { gesture: "shrug", text: "Forwarded to {dept}. Case closed." },
  { gesture: "emote", text: "{dept} answered! (They didn't.)" },
  { gesture: "cheer", text: "Great teamwork. {dept} owns it." },
  { gesture: "point", text: "Ruling: {dept}. No appeals." },
];

/** A second prompt lands mid-argument. */
export const OFFICE_ANOTHER_LINES = [
  { gesture: "exasperated", text: "Another one?!" },
  { gesture: "recoil", text: "ANOTHER ticket?! The pile grows!" },
  { gesture: "exasperated", text: "Ticket #{n}?! Hide!" },
  { gesture: "hop", text: "They're multiplying!" },
];

/** First reaction while running to the huddle (within ~1.2 s). */
export const OFFICE_ALARM_LINES = [
  { gesture: "startle", text: "Ticket incoming!" },
  { gesture: "startle", text: "Huddle! HUDDLE!" },
  { gesture: "startle", text: "A user! Everyone act busy!" },
  { gesture: "startle", text: "We have a live one!" },
  { gesture: "startle", text: "Positions! Look helpful!" },
  { gesture: "startle", text: "Somebody's typing at us!" },
  { gesture: "startle", text: "Code Beige! Everyone huddle!" },
];

/** Ambient (idle) micro-bubbles: <= 3 words, rare. */
export const OFFICE_AMBIENT_LINES = {
  any: ["Synergy.", "Per my email.", "Circle back.", "Hmm.", "Big if true.", "Mercury, again.", "Low battery.", "Huh."],
  computer: ["It compiled!", "Deploying...", "Who wrote this?", "Ctrl+Z. Ctrl+Z."],
  chess: ["Check.", "Your move.", "Hmm. Bold.", "Check. Probably."],
  pingpong: ["Nice shot!", "Out!", "Edge!", "Rematch?"],
  pullup: ["One more.", "Light weight!", "For the gains."],
  bag: ["Hyah!", "For Form 001!", "Take that, Q3!"],
  weights: ["Light weight!", "Feel the burn.", "One more set."],
  beanbag: ["Zzz...", "Five more mins.", "Do not disturb."],
  couch: ["Great meeting.", "Love this team.", "So, synergy?"],
};

/** Code Red (Grand Finale modal) panic lines. */
export const OFFICE_PANIC_LINES = [
  "CODE RED!",
  "They want an ANSWER!",
  "Abandon desk!",
  "Not the CEO!",
  "Shred everything!",
  "Where's Form 001?!",
];

/** Header copy (StuPDT voice). */
export const OFFICE_COPY = {
  title: "THE OFFICE",
  subtitle: "Live Feed: Staff Currently Doing Nothing Productively",
  statusIdle: "ON BREAK",
  statusHuddle: "HUDDLE: REVIEWING YOUR CONCERN",
  statusHuddleShort: "HUDDLE IN PROGRESS",
  statusCodeRed: "CODE RED",
  captionIdle: "Live from the break room. No tickets are being processed at this time.",
  offscreenHint: "The staff are discussing your message",
  loading: "Badging in the staff...",
  ariaLabel:
    "The StuPDT office: four staff members (Gab, Neal, Drake and Janus) hang out in a neon break room and argue about your messages.",
};
