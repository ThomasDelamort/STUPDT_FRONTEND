#!/usr/bin/env node
/**
 * build-sprites.mjs: turns the opaque presentation-board sprite sheets in
 * `art/source/` into transparent, normalised, pivot-anchored atlases for
 * "THE OFFICE" (src/assets/office/sprites/<name>.png + <name>.json).
 *
 * Pipeline per sheet (see OFFICE_FEATURE_PROMPT.md §3.2):
 *   1. per-sheet background median, key at max-channel distance > KEY_T
 *   2. (Actions row) classify + remove baked decorations BEFORE merging
 *   3. euclidean morphological closing (CLOSE_R px) + fill holes
 *   4. connected components -> nearest slot centre (no fixed slot borders)
 *   5. per-row scale normalisation against the idle head size
 *   6. feet-baseline pivot + stable horizontal anchor per animation
 *   7. shelf-pack into a palette PNG atlas + JSON; QA contact sheet
 *
 * Also converts the office background to WebP.
 *
 * Usage: pnpm sprites
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "art", "source");
const OUT = path.join(ROOT, "src", "assets", "office", "sprites");
const OFFICE_OUT = path.join(ROOT, "src", "assets", "office");
const QA = path.join(ROOT, "art", "qa");

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------
const KEY_T = 8; // max-channel distance from the background median
const CLOSE_R = 8; // morphological closing radius (px)
const DECO_RING = 3; // px removed around a detected decoration (halo/outline)
const WEAK_L = 6; // summed RGB lift over bg that counts as (weak) foreground
const FLOOR_BAND = 16; // rows above the floor where beside-the-feet shadow is stripped
const BRIDGE_MAX = 40; // max vertical gap bridged between stacked parts (px)
const DECO_GLOW = 8; // weak-only pixels this close to a decoration are its glow
const NECK_GAP = 22; // vertical gaps <= this are filled in the neck zone
const EDGE_GUARD = 3; // px ignored along each inner panel edge (frame bleed)
const PAD = 2; // atlas padding between frames

const STD_ACTIONS = ["interact", "talk", "think", "cheer", "hurt", "defeat", "emote"];

/** @type {{ name: string, file: string, actions: string[] }[]} */
const SHEETS = [
  { name: "gab", file: "GabSprite.png", actions: STD_ACTIONS },
  { name: "neal", file: "NealSprite.png", actions: STD_ACTIONS },
  { name: "drake", file: "DrakeSprite.png", actions: STD_ACTIONS },
  { name: "janus", file: "JanusSprite.png", actions: STD_ACTIONS },
  {
    name: "nimrod",
    file: "NimrodSprite.png",
    actions: ["interact", "talk", "think", "present", "explain", "hurt", "defeat", "emote"],
  },
  { name: "suit", file: "SuitSprite.png", actions: STD_ACTIONS },
  { name: "suitvoxel", file: "SuitVoxelSprite.png", actions: STD_ACTIONS },
];

// Inner panel rects [x0, x1, y0, y1] (measured, identical ±3 px on all sheets).
const PANELS = {
  turn: { rect: [368, 1232, 135, 354], n: 8 },
  idle: { rect: [22, 500, 495, 678], n: 4 },
  walk: { rect: [536, 1232, 495, 678], n: 8 },
  run: { rect: [22, 766, 750, 908], n: 8 },
  jump: { rect: [803, 1232, 750, 908], n: 4 },
  actions: { rect: [22, 1010, 985, 1168], n: 7 },
};

// Hero portrait head crop (sheet px) for the avatar.
const AVATAR_RECT = [44, 22, 240, 240]; // x, y, w, h
const AVATAR_SIZE = 96;

// ---------------------------------------------------------------------------
// Pixel helpers
// ---------------------------------------------------------------------------
const INF = 1e20;

/** 1-D squared distance transform (Felzenszwalb & Huttenlocher). */
function dt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Squared euclidean distance from every pixel to the nearest pixel where mask[i] === target. */
function distSq(mask, w, h, target = 1) {
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] === target ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    dt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    dt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

function dilate(mask, w, h, r) {
  const ds = distSq(mask, w, h, 1);
  const out = new Uint8Array(w * h);
  const r2 = r * r;
  for (let i = 0; i < w * h; i++) out[i] = ds[i] <= r2 ? 1 : 0;
  return out;
}

function erode(mask, w, h, r) {
  const ds = distSq(mask, w, h, 0);
  const out = new Uint8Array(w * h);
  const r2 = r * r;
  for (let i = 0; i < w * h; i++) out[i] = mask[i] && ds[i] > r2 ? 1 : 0;
  return out;
}

/** Closing on a padded copy so dilation never hits the buffer edge. */
function close(mask, w, h, r) {
  const p = r + 2;
  const W = w + 2 * p;
  const H = h + 2 * p;
  const big = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) big[(y + p) * W + x + p] = mask[y * w + x];
  const c = erode(dilate(big, W, H, r), W, H, r);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = c[(y + p) * W + x + p];
  return out;
}

function fillHoles(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => {
    if (!mask[i] && !seen[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] || !seen[i] ? 1 : 0;
  return out;
}

/** 8-connected component labelling. Returns labels (0 = background) and stats. */
function label(mask, w, h) {
  const labels = new Int32Array(w * h);
  const comps = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    const id = comps.length + 1;
    const c = { id, area: 0, x0: w, x1: -1, y0: h, y1: -1, sx: 0, sy: 0 };
    labels[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i / w) | 0;
      c.area++;
      c.sx += x;
      c.sy += y;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (mask[j] && !labels[j]) {
            labels[j] = id;
            stack.push(j);
          }
        }
      }
    }
    c.cx = c.sx / c.area;
    c.cy = c.sy / c.area;
    comps.push(c);
  }
  return { labels, comps };
}

/** Morphological opening with a 2x2 square (removes 1-px speckles). */
function open2x2(m, w, h) {
  const block = new Uint8Array(w * h);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      block[i] = m[i] && m[i + 1] && m[i + w] && m[i + w + 1] ? 1 : 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[i] =
        block[i] || (x > 0 && block[i - 1]) || (y > 0 && block[i - w]) || (x > 0 && y > 0 && block[i - w - 1])
          ? 1
          : 0;
    }
  }
  return out;
}

function histMedian(data, channels, c) {
  const hist = new Uint32Array(256);
  const n = data.length / channels;
  for (let i = 0; i < n; i++) hist[data[i * channels + c]]++;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n / 2) return v;
  }
  return 0;
}

// Decoration colour classes (raw RGB).
const isYellow = (r, g, b) => r > 170 && g > 140 && b < 110 && r - b > 100 && g - b > 70;
const isRed = (r, g, b) => r > 130 && g < 90 && b < 95 && r - g > 80 && r - b > 70; // not warm skin
const isGrey = (r, g, b) => Math.min(r, g, b) > 95 && Math.max(r, g, b) - Math.min(r, g, b) < 40;

// ---------------------------------------------------------------------------
// Panel extraction
// ---------------------------------------------------------------------------

/**
 * @param {Buffer} data raw RGB sheet
 * @param {number} SW sheet width
 * @param {number[]} bg background median
 * @param {string} panelKey
 * @param {number} n slots
 */
function extractPanel(data, SW, bg, panelKey, n) {
  const [x0, x1, y0, y1] = PANELS[panelKey].rect;
  const w = x1 - x0;
  const h = y1 - y0;
  const px = (x, y) => ((y + y0) * SW + (x + x0)) * 3;

  // 1. raw key.
  //  strong: max-channel distance > KEY_T (the brief's recipe)
  //  weak:   slightly LIGHTER than the background (near-black trousers are
  //          ~4-6 levels lighter; noise is ±3) after a 2x2 opening (despeckle)
  //  shadow-like: darker than bg and grey -> ground shadows (and some black
  //          clothing, which is why shadows are only stripped near the floor)
  const m0 = new Uint8Array(w * h);
  const strong = new Uint8Array(w * h);
  const weakRaw = new Uint8Array(w * h);
  const shadowLike = new Uint8Array(w * h);
  const cls = new Uint8Array(w * h); // 1 yellow, 2 red, 3 grey/white
  const isWhite = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = px(x, y);
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      const dist = Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2]));
      const L = r - bg[0] + (g - bg[1]) + (b - bg[2]);
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const i = y * w + x;
      if (dist > KEY_T) strong[i] = 1;
      // (reddish lifts are the panel frame's glow, never clothing)
      if (L >= WEAK_L && dist > 2 && r - g <= 6) weakRaw[i] = 1;
      if (L < 0 && chroma <= 10 && dist <= 22) shadowLike[i] = 1;
      cls[i] = dist > KEY_T ? (isYellow(r, g, b) ? 1 : isRed(r, g, b) ? 2 : isGrey(r, g, b) ? 3 : 0) : 0;
      if (Math.min(r, g, b) > 215) isWhite[i] = 1;
    }
  }
  const weak = open2x2(weakRaw, w, h);
  for (let i = 0; i < w * h; i++) m0[i] = strong[i] || weak[i] ? 1 : 0;
  // edge guard: the red panel frame's anti-aliased edge can bleed into the
  // outermost columns/rows of the inner rect
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < EDGE_GUARD || y < EDGE_GUARD || x >= w - EDGE_GUARD || y >= h - EDGE_GUARD) {
        const i = y * w + x;
        m0[i] = 0;
        strong[i] = 0;
      }
    }
  }

  const slotCentre = (i) => (i + 0.5) * (w / n);

  // 1b. ground shadows / lit floor discs. Some boards bake a soft disc under
  // the feet that is the SAME colour as near-black trousers, so this is done
  // by position: find the floor (lowest row with solid, non-shadow pixels:
  // the soles), then strip weak/shadow-like pixels below it, and beside the
  // feet span in the last FLOOR_BAND rows.
  {
    const sw = w / n;
    const solid = (i) => strong[i] && !shadowLike[i];
    for (let s = 0; s < n; s++) {
      const xa = Math.max(0, Math.floor(s * sw));
      const xb = Math.min(w, Math.ceil((s + 1) * sw));
      let floor = -1;
      for (let y = h - 1; y >= 0 && floor < 0; y--) {
        let cnt = 0;
        for (let x = xa; x < xb; x++) if (solid(y * w + x)) cnt++;
        if (cnt >= 4) floor = y;
      }
      if (floor < 0) continue;
      const bandTop = Math.max(0, floor - FLOOR_BAND);
      let L = xb;
      let R = xa - 1;
      for (let y = bandTop; y <= floor; y++) {
        for (let x = xa; x < xb; x++) {
          if (solid(y * w + x)) {
            if (x < L) L = x;
            if (x > R) R = x;
          }
        }
      }
      for (let y = bandTop; y < h; y++) {
        for (let x = xa; x < xb; x++) {
          const i = y * w + x;
          if (solid(i) || !m0[i]) continue;
          // beyond the feet, below the soles, or not hanging from the legs
          // above (a disc patch between the shoes) -> floor, not character
          const fromAbove = y > 0 && m0[i - w];
          if (y > floor || x < L - 2 || x > R + 2 || !fromAbove) m0[i] = 0;
        }
      }
    }
  }
  const nearestSlot = (cx) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(cx - slotCentre(i));
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };

  // 2. decoration removal (Actions row only)
  let decoMask = new Uint8Array(w * h);
  if (panelKey === "actions") {
    const anyCls = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) anyCls[i] = cls[i] ? 1 : 0;
    const ring = dilate(anyCls, w, h, 4);
    // reference body from STRONG pixels only: weak glow around the marks
    // would otherwise merge them into the head after closing
    const mb = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mb[i] = m0[i] && strong[i] && !ring[i] ? 1 : 0;
    const b1 = fillHoles(close(mb, w, h, CLOSE_R), w, h);
    const { labels: bl, comps: bc } = label(b1, w, h);
    // main body per slot
    const mainBySlot = new Array(n).fill(null);
    for (const c of bc) {
      const s = nearestSlot((c.x0 + c.x1) / 2);
      if (!mainBySlot[s] || c.area > mainBySlot[s].area) mainBySlot[s] = c;
    }
    const mainIds = new Set(mainBySlot.filter(Boolean).map((c) => c.id));
    const bodyMask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bodyMask[i] = mainIds.has(bl[i]) ? 1 : 0;
    const bodyNear = dilate(bodyMask, w, h, 1);

    const seeds = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) seeds[i] = m0[i] && cls[i] ? 1 : 0;
    const { labels: sl, comps: sc } = label(seeds, w, h);
    const stats = sc.map(() => ({ yellow: 0, red: 0, grey: 0, white: 0, overlap: 0 }));
    for (let i = 0; i < w * h; i++) {
      const id = sl[i];
      if (!id) continue;
      const st = stats[id - 1];
      if (cls[i] === 1) st.yellow++;
      else if (cls[i] === 2) st.red++;
      else st.grey++;
      if (isWhite[i]) st.white++;
      if (bodyNear[i]) st.overlap++;
    }
    const isDeco = new Uint8Array(sc.length + 1);
    for (const c of sc) {
      if (c.area < 3) continue;
      const st = stats[c.id - 1];
      const body = mainBySlot[nearestSlot(c.cx)];
      if (!body) {
        isDeco[c.id] = 1;
        continue;
      }
      const T = body.y0;
      const H = body.y1 - body.y0;
      const overlap = st.overlap / c.area;
      if (st.yellow / c.area > 0.5) {
        isDeco[c.id] = 1; // sparks: no character wears saturated yellow
        continue;
      }
      if (st.red / c.area > 0.5 && overlap < 0.6 && c.cy < T + 0.8 * H) {
        isDeco[c.id] = 1; // hurt marks floating beside the head / body
        continue;
      }
      if (overlap > 0.3) continue; // embedded body feature (collar, tie, stripes)
      if (c.cy > T + 0.55 * H) continue; // lower body (shoes, cuffs)
      const tall = c.y1 - c.y0 > 2.5 * (c.x1 - c.x0 + 1);
      if (c.cy < T + 0.15 * H && c.area >= 60 && st.white / c.area > 0.5) {
        isDeco[c.id] = 1; // speech bubble ("..." / "?") above the head
      } else if (c.cy < T + 0.1 * H && tall) {
        isDeco[c.id] = 1; // falling grey "defeat" lines
      }
    }
    if (process.env.DEBUG_DECO) {
      for (const c of sc) {
        if (c.area < 15) continue;
        const st = stats[c.id - 1];
        const body = mainBySlot[nearestSlot(c.cx)];
        console.log(
          `  slot${nearestSlot(c.cx)} area=${c.area} cy=${body ? ((c.cy - body.y0) / (body.y1 - body.y0)).toFixed(2) : "?"} ov=${(st.overlap / c.area).toFixed(2)} y=${(st.yellow / c.area).toFixed(2)} r=${(st.red / c.area).toFixed(2)} g=${(st.grey / c.area).toFixed(2)} deco=${isDeco[c.id]}`,
        );
      }
    }
    const raw = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) raw[i] = isDeco[sl[i]] ? 1 : 0;
    decoMask = dilate(raw, w, h, DECO_RING);
    // decorations glow: weak-only pixels further out belong to them too
    const glow = dilate(raw, w, h, DECO_GLOW);
    for (let i = 0; i < w * h; i++) if (glow[i] && !strong[i]) decoMask[i] = 1;
  }

  // 3. final mask: remove decorations, close, fill
  const m1 = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m1[i] = m0[i] && !decoMask[i] ? 1 : 0;
  const m2 = fillHoles(close(m1, w, h, CLOSE_R), w, h);

  // 4. components -> nearest slot centre; keep main + close sizeable attachments.
  // Neighbouring frames can touch after closing (Nimrod's walk): a component
  // spanning two slot centres is cut at its narrowest column between them.
  splitMerged(m2, w, h, n, slotCentre);
  const { labels, comps } = label(m2, w, h);
  const bySlot = Array.from({ length: n }, () => []);
  for (const c of comps) bySlot[nearestSlot(c.cx)].push(c);

  const frames = [];
  for (let s = 0; s < n; s++) {
    const list = bySlot[s].sort((a, b) => b.area - a.area);
    const main = list[0];
    if (!main) throw new Error(`${panelKey} slot ${s}: no sprite found`);
    const keep = new Set([main.id]);
    for (const c of list.slice(1)) {
      const gapX = Math.max(0, Math.max(main.x0 - c.x1, c.x0 - main.x1));
      const gapY = Math.max(0, Math.max(main.y0 - c.y1, c.y0 - main.y1));
      if (c.area >= 0.03 * main.area && Math.max(gapX, gapY) <= 12) {
        keep.add(c.id);
        continue;
      }
      // Vertically stacked part (head over a black turtleneck, shoes under
      // black trousers): bridge column-wise across the gap.
      const ox0 = Math.max(main.x0, c.x0);
      const ox1 = Math.min(main.x1, c.x1);
      const overlap = ox1 - ox0 + 1;
      // below: feet under the body. above: only a big part (a head), never
      // small leftovers floating over the head.
      const below = c.y0 > main.y1 - 4 && c.area >= 0.008 * main.area;
      const above = c.y1 < main.y0 + 4 && c.area >= 0.12 * main.area;
      if (overlap >= 0.4 * (c.x1 - c.x0 + 1) && (below || above) && gapY <= BRIDGE_MAX) {
        keep.add(c.id);
        for (let x = ox0; x <= ox1; x++) {
          // nearest main pixel and nearest part pixel in this column
          let ym = -1;
          let yc = -1;
          if (below) {
            for (let y = c.y0 - 1; y >= main.y0 && ym < 0; y--) if (labels[y * w + x] === main.id) ym = y;
            for (let y = c.y0; y <= c.y1 && yc < 0; y++) if (labels[y * w + x] === c.id) yc = y;
          } else {
            for (let y = c.y1 + 1; y <= main.y1 && ym < 0; y++) if (labels[y * w + x] === main.id) ym = y;
            for (let y = c.y1; y >= c.y0 && yc < 0; y--) if (labels[y * w + x] === c.id) yc = y;
          }
          if (ym < 0 || yc < 0 || Math.abs(yc - ym) > BRIDGE_MAX + 8) continue;
          const ya = Math.min(ym, yc);
          const yb = Math.max(ym, yc);
          for (let y = ya; y <= yb; y++) if (!labels[y * w + x]) labels[y * w + x] = main.id;
        }
      }
    }
    let fx0 = w;
    let fx1 = -1;
    let fy0 = h;
    let fy1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (keep.has(labels[y * w + x])) {
          if (x < fx0) fx0 = x;
          if (x > fx1) fx1 = x;
          if (y < fy0) fy0 = y;
          if (y > fy1) fy1 = y;
        }
      }
    }
    const fw = fx1 - fx0 + 1;
    const fh = fy1 - fy0 + 1;
    const mask = new Uint8Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        mask[y * fw + x] = keep.has(labels[(y + fy0) * w + (x + fx0)]) ? 1 : 0;
      }
    }
    fillNeckGap(mask, fw, fh);
    // RGBA with 1 px feathered edge
    const rgba = Buffer.alloc(fw * fh * 4);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const i = y * fw + x;
        if (!mask[i]) continue;
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= fw || yy >= fh || !mask[yy * fw + xx]) {
              edge = true;
              break;
            }
          }
        }
        const o = px(x + fx0, y + fy0);
        rgba[i * 4] = data[o];
        rgba[i * 4 + 1] = data[o + 1];
        rgba[i * 4 + 2] = data[o + 2];
        rgba[i * 4 + 3] = edge ? 170 : 255;
      }
    }
    frames.push({
      slot: s,
      sheetRect: [fx0 + x0, fy0 + y0, fw, fh],
      w: fw,
      h: fh,
      mask,
      rgba,
    });
  }

  // QA: decoration pixels removed (for the mask debug image)
  return { frames, decoMask, m0, rect: [x0, x1, y0, y1], w, h };
}

/**
 * Neck zone: a black turtleneck between hair and shoulders (Neal's back
 * views) can be indistinguishable from the board. Fill the vertical gap
 * between the hair and the body, but only where it spans a WIDE run of
 * neighbouring columns (a real neck), never thin slivers beside the hair.
 */
function fillNeckGap(mask, fw, fh) {
  const zy0 = Math.floor(fh * 0.18);
  const zy1 = Math.ceil(fh * 0.62);
  const maxGap = Math.round(NECK_GAP * 1.5);
  const top = new Int32Array(fw).fill(-1); // last hair row
  const bot = new Int32Array(fw).fill(-1); // first body row
  for (let x = 0; x < fw; x++) {
    let last = -1;
    for (let y = 0; y < fh; y++) {
      if (!mask[y * fw + x]) continue;
      if (last >= zy0 && y - last > 1 && y - last - 1 <= maxGap && y <= zy1) {
        top[x] = last;
        bot[x] = y;
        break;
      }
      last = y;
    }
  }
  // contiguous runs of candidate columns, bridging breaks of <= 3 columns
  let x = 0;
  while (x < fw) {
    if (top[x] < 0) {
      x++;
      continue;
    }
    let end = x;
    let k = x + 1;
    while (k < fw) {
      if (top[k] >= 0) {
        end = k;
        k++;
      } else if (k - end <= 3) k++;
      else break;
    }
    if (end - x + 1 >= fw * 0.25) {
      let prev = x;
      for (let c = x; c <= end; c++) {
        let t = top[c];
        let b = bot[c];
        if (t < 0) {
          let nx = c + 1;
          while (nx <= end && top[nx] < 0) nx++;
          t = Math.round((top[prev] + top[nx]) / 2);
          b = Math.round((bot[prev] + bot[nx]) / 2);
        } else prev = c;
        for (let y = t + 1; y < b; y++) mask[y * fw + c] = 1;
      }
    }
    x = end + 1;
  }
}

/** In-place: cut components that cover more than one slot centre. */
function splitMerged(mask, w, h, n, slotCentre) {
  for (let pass = 0; pass < n; pass++) {
    const { labels, comps } = label(mask, w, h);
    let cut = false;
    for (const c of comps) {
      const centres = [];
      for (let i = 0; i < n; i++) {
        const sc = slotCentre(i);
        if (sc > c.x0 && sc < c.x1) centres.push(sc);
      }
      if (centres.length < 2) continue;
      for (let k = 0; k < centres.length - 1; k++) {
        const a = Math.ceil(centres[k] + 10);
        const b = Math.floor(centres[k + 1] - 10);
        let bestX = (a + b) >> 1;
        let best = Infinity;
        for (let x = a; x <= b; x++) {
          let cnt = 0;
          for (let y = 0; y < h; y++) if (labels[y * w + x] === c.id) cnt++;
          if (cnt < best) {
            best = cnt;
            bestX = x;
          }
        }
        for (let y = 0; y < h; y++) if (labels[y * w + bestX] === c.id) mask[y * w + bestX] = 0;
        cut = true;
      }
    }
    if (!cut) return;
  }
}

// ---------------------------------------------------------------------------
// Frame metrics
// ---------------------------------------------------------------------------

/** Widest silhouette span in a band of rows [a, b) (frame-local). */
function bandWidth(f, a, b) {
  let best = 0;
  for (let y = Math.max(0, a); y < Math.min(f.h, b); y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < f.w; x++) {
      if (f.mask[y * f.w + x]) {
        if (l < 0) l = x;
        r = x;
      }
    }
    if (l >= 0) best = Math.max(best, r - l + 1);
  }
  return best;
}

/** Centroid x of mask pixels in rows [a, b). */
function bandCentroid(f, a, b) {
  let sx = 0;
  let n = 0;
  for (let y = Math.max(0, Math.floor(a)); y < Math.min(f.h, Math.ceil(b)); y++) {
    for (let x = 0; x < f.w; x++) {
      if (f.mask[y * f.w + x]) {
        sx += x;
        n++;
      }
    }
  }
  return n ? sx / n : f.w / 2;
}

/** Extreme point of the silhouette in a band: side = 'left' | 'right' | 'top'. */
function extremePoint(f, a, b, side, xa = 0, xb = f.w) {
  let best = null;
  for (let y = Math.max(0, Math.floor(a)); y < Math.min(f.h, Math.ceil(b)); y++) {
    for (let x = Math.max(0, xa); x < Math.min(f.w, xb); x++) {
      if (!f.mask[y * f.w + x]) continue;
      if (!best) best = [x, y];
      else if (side === "left" && x < best[0]) best = [x, y];
      else if (side === "right" && x > best[0]) best = [x, y];
      else if (side === "top" && y < best[1]) best = [x, y];
    }
  }
  return best;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------------------
// Per-sheet build
// ---------------------------------------------------------------------------
async function buildSheet(sheet) {
  const file = path.join(SRC, sheet.file);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const SW = info.width;
  const bg = [0, 1, 2].map((c) => histMedian(data, 3, c));

  const panels = {};
  for (const key of Object.keys(PANELS)) {
    const n = key === "actions" ? sheet.actions.length : PANELS[key].n;
    panels[key] = extractPanel(data, SW, bg, key, n);
  }

  // ---- scale normalisation against the idle head size -------------------
  // Head band = the top HEAD_BAND sheet-px of each silhouette (hair + face).
  const idleH = median(panels.idle.frames.map((f) => f.h));
  const HEAD_BAND = Math.round(idleH * 0.3);
  const headW = (f, s = 1) => bandWidth(f, Math.round(4 * s), Math.round(HEAD_BAND * s));
  const idleHead = median(panels.idle.frames.map((f) => headW(f)));

  // Turnaround: compare its FRONT view's head to idle's (same pose).
  // (Heights disagree by a few % because the boards draw slightly longer
  // bodies in some rows; the brief normalises on head size, which is what
  // the eye tracks on a chibi.)
  const turnFrontHead = headW(panels.turn.frames[0]);
  const turnScale = idleHead / turnFrontHead;
  // Side-view head ratio (side / front) measured inside the turnaround row,
  // used to normalise side-facing rows (walk, run).
  const sideRatio =
    median([headW(panels.turn.frames[2]), headW(panels.turn.frames[6])]) / turnFrontHead;
  const walkHead = median(panels.walk.frames.map((f) => headW(f)));
  const runHead = median(panels.run.frames.map((f) => headW(f)));
  const walkScale = (idleHead * sideRatio) / walkHead;
  const runScale = (idleHead * sideRatio) / runHead;
  // Actions: median head of the upright standing poses (interact/talk/emote).
  const upright = panels.actions.frames.filter((_, i) =>
    ["interact", "talk", "emote"].includes(sheet.actions[i]),
  );
  const actHead = median(upright.map((f) => headW(f)));
  const actScale = idleHead / actHead;
  // Jump frames are drawn at the run row's scale (same row in the sheet).
  const jumpScale = runScale;

  const clampScale = (s) => Math.min(1.2, Math.max(0.85, s));
  const rowScale = {
    turn: clampScale(turnScale),
    idle: 1,
    walk: clampScale(walkScale),
    run: clampScale(runScale),
    jump: clampScale(jumpScale),
    actions: clampScale(actScale),
  };

  // ---- frames: anchors (pre-scale, frame-local) -------------------------
  /** @type {{key:string, panel:string, f:any, ax:number, scale:number}[]} */
  const all = [];
  const pushFrames = (panelKey, names) => {
    panels[panelKey].frames.forEach((f, i) => {
      all.push({ key: names[i], panel: panelKey, f, scale: rowScale[panelKey] });
    });
  };
  pushFrames(
    "turn",
    Array.from({ length: 8 }, (_, i) => `turn_${i}`),
  );
  pushFrames(
    "idle",
    Array.from({ length: 4 }, (_, i) => `idle_${i}`),
  );
  pushFrames(
    "walk",
    Array.from({ length: 8 }, (_, i) => `walk_${i}`),
  );
  pushFrames(
    "run",
    Array.from({ length: 8 }, (_, i) => `run_${i}`),
  );
  pushFrames(
    "jump",
    Array.from({ length: 4 }, (_, i) => `jump_${i}`),
  );
  pushFrames(
    "actions",
    sheet.actions.map((a) => `${a}_0`),
  );

  // Horizontal anchor: grounded poses use the feet band (rock-solid feet);
  // locomotion uses the head band (the most stable part of an in-place cycle).
  for (const e of all) {
    const { f } = e;
    const locomotion = e.panel === "walk" || e.panel === "run";
    const airborne = e.panel === "jump" && (e.key === "jump_1" || e.key === "jump_2");
    if (locomotion || airborne) e.ax = bandCentroid(f, 2, HEAD_BAND / e.scale);
    else e.ax = bandCentroid(f, f.h - Math.max(6, f.h * 0.1), f.h);
  }
  // Walk/run: one shared offset between head anchor and the frame, so the
  // cycle is anchored on the average head x (removes per-frame hair jitter).
  for (const panelKey of ["walk", "run"]) {
    const list = all.filter((e) => e.panel === panelKey);
    const rel = list.map((e) => e.ax - e.f.w / 2);
    const avg = rel.reduce((a, b) => a + b, 0) / rel.length;
    for (const e of list) {
      // keep the true head centroid but limit deviation from the cycle mean to ±1.5 px
      const d = e.ax - e.f.w / 2 - avg;
      e.ax = e.f.w / 2 + avg + Math.max(-1.5, Math.min(1.5, d));
    }
  }

  // ---- resize + pack ----------------------------------------------------
  const prepared = [];
  for (const e of all) {
    const { f, scale } = e;
    const nw = Math.max(1, Math.round(f.w * scale));
    const nh = Math.max(1, Math.round(f.h * scale));
    const sx = nw / f.w;
    const sy = nh / f.h;
    const buf =
      scale === 1
        ? await sharp(f.rgba, { raw: { width: f.w, height: f.h, channels: 4 } })
            .png()
            .toBuffer()
        : await sharp(f.rgba, { raw: { width: f.w, height: f.h, channels: 4 } })
            .resize(nw, nh, { kernel: "lanczos3" })
            .png()
            .toBuffer();
    // anchors (scaled frame-local)
    const pivot = [round1(e.ax * sx), nh];
    const anchors = computeAnchors(e.key, f, sx, sy);
    prepared.push({ key: e.key, panel: e.panel, w: nw, h: nh, buf, pivot, anchors, scale });
  }

  // Uniform cells: every frame sits in an identical cell with its pivot at
  // the same cell-local point, so at runtime a frame change is a pure
  // background-position write (no width/height/layout churn).
  const left = Math.ceil(Math.max(...prepared.map((p) => p.pivot[0])));
  const right = Math.ceil(Math.max(...prepared.map((p) => p.w - p.pivot[0])));
  const up = Math.ceil(Math.max(...prepared.map((p) => p.pivot[1])));
  const half = Math.max(left, right);
  const CELL_W = 2 * half + 2 * PAD;
  const CELL_H = up + 2 * PAD;
  const CELL_PIVOT = [half + PAD, up + PAD];
  const COLS = Math.max(1, Math.floor(1024 / CELL_W));
  prepared.forEach((p, i) => {
    p.cellX = (i % COLS) * CELL_W;
    p.cellY = Math.floor(i / COLS) * CELL_H;
    p.offX = Math.round(CELL_PIVOT[0] - p.pivot[0]);
    p.offY = Math.round(CELL_PIVOT[1] - p.pivot[1]);
    p.x = p.cellX + p.offX;
    p.y = p.cellY + p.offY;
  });
  const rows = Math.ceil(prepared.length / COLS);
  const ATLAS_W = COLS * CELL_W;
  const avatar = { w: AVATAR_SIZE, h: AVATAR_SIZE, x: 0, y: rows * CELL_H };
  const ATLAS_H = avatar.y + AVATAR_SIZE;

  const avatarBuf = await sharp(file)
    .extract({
      left: AVATAR_RECT[0],
      top: AVATAR_RECT[1],
      width: AVATAR_RECT[2],
      height: AVATAR_RECT[3],
    })
    .resize(AVATAR_SIZE, AVATAR_SIZE, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  const atlasPng = await sharp({
    create: { width: ATLAS_W, height: ATLAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      ...prepared.map((p) => ({ input: p.buf, left: p.x, top: p.y })),
      { input: avatarBuf, left: avatar.x, top: avatar.y },
    ])
    .png({ palette: true, quality: 92, effort: 10, dither: 0.6, compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(path.join(OUT, `${sheet.name}.png`), atlasPng);

  // ---- JSON ---------------------------------------------------------------
  // frames are uniform cells; `trim` is the drawn sprite's rect inside the
  // cell (used for bubble/head placement); anchors are cell-local.
  const frames = {};
  const anchors = {};
  for (const p of prepared) {
    frames[p.key] = {
      x: p.cellX,
      y: p.cellY,
      w: CELL_W,
      h: CELL_H,
      pivot: CELL_PIVOT,
      trim: [p.offX, p.offY, p.w, p.h],
    };
    if (p.anchors) {
      anchors[p.key] = Object.fromEntries(
        Object.entries(p.anchors).map(([k, v]) => [k, v ? [round1(v[0] + p.offX), round1(v[1] + p.offY)] : null]),
      );
    }
  }
  const seq = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}_${i}`);
  const animations = {
    idle: { frames: seq("idle", 4), fps: 4, loop: true },
    walk: { frames: seq("walk", 8), fps: 10, loop: true },
    run: { frames: seq("run", 8), fps: 14, loop: true },
    jump: { frames: seq("jump", 4), fps: 8, loop: false },
    turn: { frames: seq("turn", 8), fps: 6, loop: true },
  };
  for (const a of sheet.actions) animations[a] = { frames: [`${a}_0`], fps: 1, loop: false };

  // Turnaround order (verified by eye on the contact sheet): the board rotates
  // front -> 3/4 facing screen-left -> left profile -> back-left -> back ->
  // back-right -> right profile -> 3/4 facing screen-right.
  const views = {
    front: "turn_0",
    frontLeft: "turn_1",
    left: "turn_2",
    backLeft: "turn_3",
    back: "turn_4",
    backRight: "turn_5",
    right: "turn_6",
    frontRight: "turn_7",
  };

  // walk stride estimate: front-foot travel across the in-place cycle
  const walkStride = estimateStride(prepared.filter((p) => p.panel === "walk"), panels.walk.frames, rowScale.walk);
  const runStride = estimateStride(prepared.filter((p) => p.panel === "run"), panels.run.frames, rowScale.run);

  const json = {
    name: sheet.name,
    image: `${sheet.name}.png`,
    size: [ATLAS_W, ATLAS_H],
    cell: { w: CELL_W, h: CELL_H, pivot: CELL_PIVOT },
    frames,
    animations,
    views,
    anchors,
    avatar: { x: avatar.x, y: avatar.y, w: avatar.w, h: avatar.h },
    metrics: {
      idleHeight: median(prepared.filter((p) => p.panel === "idle").map((p) => p.h)),
      rowScale: Object.fromEntries(Object.entries(rowScale).map(([k, v]) => [k, round3(v)])),
      walkStridePx: round1(walkStride),
      runStridePx: round1(runStride),
    },
  };
  await fs.writeFile(path.join(OUT, `${sheet.name}.json`), JSON.stringify(json, null, 1) + "\n");

  // validation: head width per row AFTER normalisation (should all match idle)
  const postHead = {};
  for (const k of ["turn", "idle", "walk", "run", "actions"]) {
    const list = all.filter((e) => e.panel === k);
    const sel =
      k === "turn"
        ? [list[0]]
        : k === "actions"
          ? list.filter((e) => ["interact_0", "talk_0", "emote_0"].includes(e.key))
          : list;
    postHead[k] = round1(median(sel.map((e) => headW(e.f, 1 / e.scale) * e.scale)));
  }
  json.metrics.headWidthByRow = postHead;
  await fs.writeFile(path.join(OUT, `${sheet.name}.json`), JSON.stringify(json, null, 1) + "\n");

  const raw = {
    turnScale,
    sideRatio,
    walkScale,
    runScale,
    actScale,
    idleHead,
    turnFrontHead,
    walkHead,
    runHead,
    actHead,
  };
  console.log(
    `${sheet.name.padEnd(10)} bg=${bg.join(",")} atlas=${ATLAS_W}x${ATLAS_H} ${(atlasPng.length / 1024).toFixed(0)}KB  scales ${JSON.stringify(
      json.metrics.rowScale,
    )} raw ${JSON.stringify(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round3(v)])))} stride walk=${json.metrics.walkStridePx} run=${json.metrics.runStridePx}`,
  );

  return { sheet, panels, prepared, json, atlasPng, bg };
}

/** Hand anchors for prop attachment (scaled frame-local coords). */
function computeAnchors(key, f, sx, sy) {
  const S = (p) => (p ? [round1(p[0] * sx), round1(p[1] * sy)] : null);
  const h = f.h;
  const mid = f.w / 2;
  if (key === "interact_0" || key === "talk_0" || key === "explain_0" || key === "present_0") {
    // arm stretched to screen-right at shoulder height
    return { hand: S(extremePoint(f, h * 0.35, h * 0.75, "right")) };
  }
  if (key === "cheer_0") {
    return {
      handL: S(extremePoint(f, 0, h * 0.5, "top", 0, Math.floor(mid - f.w * 0.15))),
      handR: S(extremePoint(f, 0, h * 0.5, "top", Math.ceil(mid + f.w * 0.15), f.w)),
    };
  }
  if (key.startsWith("idle_") || key === "emote_0" || key === "think_0") {
    return {
      handL: S(extremePoint(f, h * 0.45, h * 0.72, "left")),
      handR: S(extremePoint(f, h * 0.45, h * 0.72, "right")),
    };
  }
  return null;
}

/** Peak-to-peak travel of the lowest (front) foot in an in-place cycle. */
function estimateStride(prepared, raw, scale) {
  const xs = raw.map((f, i) => {
    // rightmost mask pixel in the bottom 8% rows = toe of the leading foot
    const p = extremePoint(f, f.h * 0.92, f.h, "right");
    return p ? p[0] * scale - prepared[i].pivot[0] : 0;
  });
  return (Math.max(...xs) - Math.min(...xs)) * 2;
}

const round1 = (v) => Math.round(v * 10) / 10;
const round3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------
// QA: contact sheet + per-sheet mask debug
// ---------------------------------------------------------------------------
async function buildContactSheet(results) {
  const CELL_W = 130;
  const CELL_H = 215;
  const COLS = 16;
  const rowsPer = 3;
  const W = COLS * CELL_W;
  const H = results.length * rowsPer * CELL_H + 40;
  // checkerboard
  const base = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = ((x >> 3) + (y >> 3)) & 1 ? 200 : 235;
      const o = (y * W + x) * 4;
      base[o] = c;
      base[o + 1] = c;
      base[o + 2] = c;
      base[o + 3] = 255;
    }
  }
  const comps = [];
  const svg = [];
  results.forEach((r, ri) => {
    const groups = [
      r.prepared.filter((p) => p.panel === "turn" || p.panel === "idle"),
      r.prepared.filter((p) => p.panel === "walk" || p.panel === "run"),
      r.prepared.filter((p) => p.panel === "jump" || p.panel === "actions"),
    ];
    const idleTop = r.json.metrics.idleHeight;
    groups.forEach((g, gi) => {
      const rowY = (ri * rowsPer + gi) * CELL_H;
      const baseY = rowY + CELL_H - 14;
      svg.push(
        `<line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="#0a0" stroke-width="1"/>`,
        `<line x1="0" y1="${baseY - idleTop}" x2="${W}" y2="${baseY - idleTop}" stroke="#08f" stroke-width="1" stroke-dasharray="4 4"/>`,
      );
      g.forEach((p, i) => {
        const cxp = i * CELL_W + CELL_W / 2;
        const left = Math.round(cxp - p.pivot[0]);
        const top = Math.round(baseY - p.pivot[1]);
        comps.push({ input: p.buf, left: Math.max(0, left), top: Math.max(0, top) });
        svg.push(
          `<line x1="${cxp - 6}" y1="${baseY}" x2="${cxp + 6}" y2="${baseY}" stroke="#f00" stroke-width="2"/>`,
          `<line x1="${cxp}" y1="${baseY - 6}" x2="${cxp}" y2="${baseY + 6}" stroke="#f00" stroke-width="2"/>`,
          `<text x="${i * CELL_W + 4}" y="${rowY + 12}" font-family="Arial" font-size="11" fill="#222">${r.sheet.name}:${p.key}</text>`,
        );
        if (p.anchors) {
          for (const v of Object.values(p.anchors)) {
            if (!v) continue;
            svg.push(
              `<circle cx="${left + v[0]}" cy="${top + v[1]}" r="3" fill="none" stroke="#f0f" stroke-width="1.5"/>`,
            );
          }
        }
      });
    });
  });
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join("")}</svg>`,
  );
  await sharp(base, { raw: { width: W, height: H, channels: 4 } })
    .composite([...comps, { input: overlay, left: 0, top: 0 }])
    .png({ compressionLevel: 9, palette: true, quality: 80 })
    .toFile(path.join(QA, "contact-sheet.png"));
}

/** Shows the raw sheet with removed decorations in magenta and kept outlines in cyan. */
async function buildMaskDebug(r) {
  const p = r.panels.actions;
  const [x0, , y0] = p.rect;
  const { data } = await sharp(path.join(SRC, r.sheet.file))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const SW = 1254;
  const out = Buffer.alloc(p.w * p.h * 3);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      const o = ((y + y0) * SW + (x + x0)) * 3;
      if (p.decoMask[i] && p.m0[i]) {
        out[i * 3] = 255;
        out[i * 3 + 1] = 0;
        out[i * 3 + 2] = 255;
      } else {
        out[i * 3] = data[o];
        out[i * 3 + 1] = data[o + 1];
        out[i * 3 + 2] = data[o + 2];
      }
    }
  }
  await sharp(out, { raw: { width: p.w, height: p.h, channels: 3 } })
    .png()
    .toFile(path.join(QA, `${r.sheet.name}-decorations.png`));
}

/**
 * Runtime "cover" patches for props that are baked into office.png and get
 * animated (the office image itself is never edited):
 *  - patch-bag.png: what's behind the punching bag, approximated by a
 *    row-wise blend of the columns left/right of it (only slivers show while
 *    the bag swings)
 *  - patch-dumbbells.png: mat texture cloned from just right of the dumbbells
 * Rects must match OFFICE_PATCHES in src/constants/office.js.
 */
const PATCH_BAG = { x: 806, y: 152, w: 64, h: 196 };
const PATCH_DB = { x: 788, y: 378, w: 84, h: 58, cloneDx: 60, cloneDy: 8 }; // clone along the mat edge slope

async function buildPatches(officeSrc) {
  const { data, info } = await sharp(officeSrc).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const at = (x, y, c) => data[(y * W + x) * 3 + c];

  const bag = Buffer.alloc(PATCH_BAG.w * PATCH_BAG.h * 3);
  for (let y = 0; y < PATCH_BAG.h; y++) {
    const yy = PATCH_BAG.y + y;
    const L = [0, 1, 2].map((c) => (at(PATCH_BAG.x - 3, yy, c) + at(PATCH_BAG.x - 2, yy, c)) / 2);
    const R = [0, 1, 2].map(
      (c) => (at(PATCH_BAG.x + PATCH_BAG.w + 1, yy, c) + at(PATCH_BAG.x + PATCH_BAG.w + 2, yy, c)) / 2,
    );
    for (let x = 0; x < PATCH_BAG.w; x++) {
      const t = x / (PATCH_BAG.w - 1);
      for (let c = 0; c < 3; c++) bag[(y * PATCH_BAG.w + x) * 3 + c] = Math.round(L[c] * (1 - t) + R[c] * t);
    }
  }
  await sharp(bag, { raw: { width: PATCH_BAG.w, height: PATCH_BAG.h, channels: 3 } })
    .blur(1.2)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OFFICE_OUT, "patch-bag.png"));

  const db = Buffer.alloc(PATCH_DB.w * PATCH_DB.h * 3);
  for (let y = 0; y < PATCH_DB.h; y++) {
    for (let x = 0; x < PATCH_DB.w; x++) {
      for (let c = 0; c < 3; c++) {
        db[(y * PATCH_DB.w + x) * 3 + c] = at(PATCH_DB.x + PATCH_DB.cloneDx + x, PATCH_DB.y + PATCH_DB.cloneDy + y, c);
      }
    }
  }
  await sharp(db, { raw: { width: PATCH_DB.w, height: PATCH_DB.h, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OFFICE_OUT, "patch-dumbbells.png"));
}

// ---------------------------------------------------------------------------
async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(QA, { recursive: true });
  const only = process.argv.slice(2);
  const results = [];
  for (const sheet of SHEETS) {
    if (only.length && !only.includes(sheet.name)) continue;
    results.push(await buildSheet(sheet));
  }
  await buildContactSheet(results);
  for (const r of results) await buildMaskDebug(r);

  // office background -> WebP
  const officeSrc = path.join(SRC, "Neon_Gamer_Lounge_and_City_Nightscape.png");
  const webp = await sharp(officeSrc).webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer();
  await fs.writeFile(path.join(OFFICE_OUT, "office.webp"), webp);
  console.log(`office.webp ${(webp.length / 1024).toFixed(0)}KB`);
  await buildPatches(officeSrc);

  let total = 0;
  for (const r of results) total += r.atlasPng.length;
  console.log(`atlases total ${(total / 1024).toFixed(0)}KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
