// ============================================================================
// WHEEL MATH (pure functions - no React, no DOM).
//
// Conventions: the wheel is rotated CLOCKWISE by `rotation` degrees. Wedge `i`
// occupies the wheel-angles [i*w, (i+1)*w), measured clockwise from 12 o'clock
// when rotation is 0 (w = 360 / count). The pointer is fixed at 12 o'clock, so
// after rotating by R the wedge under the pointer is the one containing the
// wheel-angle (-R mod 360).
// ============================================================================

const mod360 = (deg) => ((deg % 360) + 360) % 360;

export function wedgeSize(count) {
  return 360 / count;
}

/** Uniformly pick a wedge index. `rng` returns a float in [0, 1). */
export function pickWinnerIndex(count, rng = Math.random) {
  return Math.min(count - 1, Math.floor(rng() * count));
}

/**
 * Random offset (degrees) from the wedge centre, kept well inside the wedge so
 * the pointer never rests on a boundary. `spread` is the fraction of the wedge used.
 */
export function randomJitter(count, rng = Math.random, spread = 0.7) {
  return (rng() - 0.5) * wedgeSize(count) * spread;
}

/**
 * Final rotation (degrees, always > currentDeg) that puts wedge `index` under
 * the pointer after at least `extraTurns` full turns.
 */
export function targetRotation(currentDeg, index, count, extraTurns = 5, jitterDeg = 0) {
  const w = wedgeSize(count);
  const wheelAngleUnderPointer = index * w + w / 2 + jitterDeg;
  const desired = mod360(-wheelAngleUnderPointer);
  let delta = desired - mod360(currentDeg);
  if (delta < 0) delta += 360;
  return currentDeg + extraTurns * 360 + delta;
}

/** Which wedge is under the pointer at a given rotation. */
export function indexAtRotation(rotationDeg, count) {
  return Math.floor(mod360(-rotationDeg) / wedgeSize(count)) % count;
}

/** Monotonic counter that increments each time a wedge boundary passes the pointer. */
export function tickCount(rotationDeg, count) {
  return Math.floor(rotationDeg / wedgeSize(count));
}

export function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}
