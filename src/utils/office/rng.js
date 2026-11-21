// Seeded randomness for THE OFFICE: deterministic arcs per prompt text.

/** 32-bit FNV-1a hash of a string. */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small, fast seeded PRNG (mulberry32). */
export class Rng {
  /** @param {number} seed */
  constructor(seed = Date.now()) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** @returns {number} float in [0, 1) */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  /** @template T @param {T[]} arr @returns {T} */
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick. @template T @param {T[]} arr @param {(t: T) => number} weight */
  weighted(arr, weight) {
    const total = arr.reduce((s, t) => s + Math.max(0, weight(t)), 0);
    if (total <= 0) return this.pick(arr);
    let r = this.next() * total;
    for (const t of arr) {
      r -= Math.max(0, weight(t));
      if (r <= 0) return t;
    }
    return arr[arr.length - 1];
  }

  /** @template T @param {T[]} arr @returns {T[]} new shuffled array */
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
