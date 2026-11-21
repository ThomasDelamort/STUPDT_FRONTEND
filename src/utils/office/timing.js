// ============================================================================
// THE OFFICE: every duration, speed and tuning knob in one place.
// Times in seconds unless the name says MS. Distances in world px.
// ============================================================================

export const TIMING = {
  // --- simulation loop ----------------------------------------------------
  STEP: 1 / 30, // fixed logic timestep (rendering interpolates between steps)
  MAX_DT: 0.05, // a throttled tab never advances more than this per frame
  HIDDEN_TICK_MS: 250, // sim-only tick while the card is offscreen / tab hidden

  // --- sprites ----------------------------------------------------------------
  SPRITE_SCALE: 1.25, // world px per sheet px (standing ≈ 0.75x squat rack)
  WALK_SPEED: 104,
  RUN_SPEED: 285,
  // world px travelled per full 8-frame cycle at SPRITE_SCALE; anim fps is
  // derived from speed so feet don't skate (tuned by eye in the player)
  WALK_CYCLE_PX: 92,
  RUN_CYCLE_PX: 190,
  IDLE_FPS: 4,
  BOB_PX: 2.5, // walking bob for front/back (vertical) movement
  ARRIVE_RADIUS: 26, // start easing within this distance of the goal
  TURN_HYSTERESIS: 0.25, // side vs vertical walk switch hysteresis

  // --- separation ---------------------------------------------------------
  PERSONAL_SPACE: 54, // ellipse radius (y counts double, perspective); sprites are ~95 px wide
  YIELD_MAX: 1.1, // seconds to wait before replanning around someone

  // --- director -------------------------------------------------------------
  SCENE_MIN: 15,
  SCENE_MAX: 35,
  DEPART_STAGGER: 2, // 0..2 s staggered departures
  SOLO_REROLL_MIN: 8,
  SOLO_REROLL_MAX: 20,
  COVERAGE_WINDOW: 300, // all nine activities within ~5 min
  FIRST_SCENE_DELAY: 0.6,

  // --- micro-life -----------------------------------------------------------
  AMBIENT_MIN_GAP: 6, // at most one ambient bubble per ~6 s, never overlapping
  AMBIENT_CHANCE: 0.35,
  AMBIENT_MS: 1500,
  LOOKAROUND_MIN: 3,
  LOOKAROUND_MAX: 7,

  // --- ping-pong ------------------------------------------------------------
  PP_RALLY_MIN: 3,
  PP_RALLY_MAX: 7,
  PP_FLIGHT: 0.62, // seconds per hit (end to end)
  PP_ARC: 70, // ball apex height above the table plane
  PP_BETWEEN_POINTS: 1.6,

  // --- gym ------------------------------------------------------------------
  PULLUP_REP: 1.2, // seconds per rep
  PULLUP_AMP: 22, // px oscillation
  PULLUP_SET: [5, 9], // reps per set
  BAG_PUNCH_GAP: [0.45, 1.1],
  BAG_DAMPING: 1.25,
  BAG_GRAVITY: 32, // pendulum stiffness (g / L, rad/s^2)
  BAG_IMPULSE: 0.55, // angular velocity added per punch (rad/s)
  LIFT_REP: 1.4,

  // --- chess / computer / beanbag ------------------------------------------
  CHESS_TURN: [2.5, 5.5],
  TYPE_HEADTURN: [5, 11],
  BREATHE_HZ: 0.28,
  ZZZ_EVERY: 1.6,

  // --- huddle / argument ----------------------------------------------------
  STARTLE_MS: 400, // everyone visibly stopped within this
  STARTLE_STAGGER_MS: 200,
  FIRST_BUBBLE_DELAY: 0.55, // after the startle (<= 1.2 s)
  BUBBLE_BASE_MS: 600, // lifetime = base + per-char * chars
  BUBBLE_PER_CHAR_MS: 65,
  BEAT_GAP_MS: 220,
  OVERLAP_MS: 600, // interruption overlap (max 2 bubbles, <= 700 ms)
  TYPE_CPS: 38, // typewriter characters per second
  HEAT_STEPS: 3, // bubble outline escalation levels
  VERDICT_MS: 2400, // verdict beat (<= 2.5 s)
  VERDICT_DEADLINE: 2.4, // maximum simulation seconds from reply to verdict
  OPENING_BEAT: 1.6,
  DISPERSE_DELAY_MS: 1500,
  TICKET_FLIGHT: 0.7,
  BLIP_VOLUME: 0.012, // optional bubble blip (very quiet, respects mute)

  // --- reduced motion -------------------------------------------------------
  REDUCED_FPS: 1.5,
  FADE_MS: 350,
};

/** Bubble lifetime in ms for a line of text. */
export function bubbleLifetimeMs(text) {
  return TIMING.BUBBLE_BASE_MS + TIMING.BUBBLE_PER_CHAR_MS * String(text).length;
}
