// ============================================================================
// THE OFFICE: navigation. A walkable polygon minus inflated furniture
// footprints, rasterised once into an 8 px bitmap; A* on a 16 px grid,
// line-of-sight string-pulling, nearest-walkable snapping. No teleports:
// every route is a continuous polyline across walkable floor.
// ============================================================================

/** @typedef {{x: number, y: number}} Pt */

/** Even-odd point-in-polygon. @param {number[][]} poly */
export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

/** Distance from a point to a polygon's outline. */
export function distToPoly(x, y, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    d = Math.min(d, segDist(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]));
  }
  return d;
}

/** Minimal binary heap keyed by f-score. */
class Heap {
  constructor() {
    /** @type {number[]} */ this.items = [];
    /** @type {number[]} */ this.keys = [];
  }
  get size() {
    return this.items.length;
  }
  push(item, key) {
    const it = this.items;
    const ks = this.keys;
    it.push(item);
    ks.push(key);
    let i = it.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= ks[i]) break;
      [it[p], it[i]] = [it[i], it[p]];
      [ks[p], ks[i]] = [ks[i], ks[p]];
      i = p;
    }
  }
  pop() {
    const it = this.items;
    const ks = this.keys;
    const top = it[0];
    const lastI = it.pop();
    const lastK = ks.pop();
    if (it.length) {
      it[0] = lastI;
      ks[0] = lastK;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < it.length && ks[l] < ks[m]) m = l;
        if (r < it.length && ks[r] < ks[m]) m = r;
        if (m === i) break;
        [it[m], it[i]] = [it[i], it[m]];
        [ks[m], ks[i]] = [ks[i], ks[m]];
        i = m;
      }
    }
    return top;
  }
}

export class NavGrid {
  /**
   * @param {{ walk: number[][], obstacles: {id: string, poly: number[][]}[],
   *   cell: number, radius: number, width: number, height: number }} opts
   */
  constructor({ walk, obstacles, cell, radius, width, height }) {
    this.walk = walk;
    this.obstacles = obstacles;
    this.cell = cell;
    this.radius = radius;
    this.width = width;
    this.height = height;
    this.fine = 8;
    this.fw = Math.ceil(width / this.fine);
    this.fh = Math.ceil(height / this.fine);
    this.bits = new Uint8Array(this.fw * this.fh);
    const edgeMargin = radius * 0.6;
    for (let fy = 0; fy < this.fh; fy++) {
      for (let fx = 0; fx < this.fw; fx++) {
        const x = (fx + 0.5) * this.fine;
        const y = (fy + 0.5) * this.fine;
        let ok = pointInPoly(x, y, walk) && distToPoly(x, y, walk) >= edgeMargin;
        if (ok) {
          for (const o of obstacles) {
            if (pointInPoly(x, y, o.poly) || distToPoly(x, y, o.poly) < radius) {
              ok = false;
              break;
            }
          }
        }
        this.bits[fy * this.fw + fx] = ok ? 1 : 0;
      }
    }
    this.cw = Math.ceil(width / cell);
    this.ch = Math.ceil(height / cell);
    this.coarse = new Uint8Array(this.cw * this.ch);
    for (let cy = 0; cy < this.ch; cy++) {
      for (let cx = 0; cx < this.cw; cx++) {
        this.coarse[cy * this.cw + cx] = this.walkableAt((cx + 0.5) * cell, (cy + 0.5) * cell)
          ? 1
          : 0;
      }
    }
  }

  walkableAt(x, y) {
    const fx = Math.floor(x / this.fine);
    const fy = Math.floor(y / this.fine);
    if (fx < 0 || fy < 0 || fx >= this.fw || fy >= this.fh) return false;
    return this.bits[fy * this.fw + fx] === 1;
  }

  /** @param {Pt} a @param {Pt} b */
  lineOfSight(a, b, blockers = []) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / 4));
    for (let i = 1; i <= steps; i++) {
      const x = a.x + (dx * i) / steps;
      const y = a.y + (dy * i) / steps;
      if (!this.walkableAt(x, y)) return false;
      for (const bl of blockers) if (ellipseDist(x, y, bl.x, bl.y) < bl.r) return false;
    }
    return true;
  }

  /** Nearest walkable point (spiral on the fine grid). @param {Pt} p */
  nearestWalkable(p, maxR = 260) {
    if (this.walkableAt(p.x, p.y)) return { x: p.x, y: p.y };
    const f = this.fine;
    for (let r = f; r <= maxR; r += f) {
      let best = null;
      let bd = Infinity;
      for (let a = 0; a < 32; a++) {
        const t = (a / 32) * Math.PI * 2;
        const x = p.x + Math.cos(t) * r;
        const y = p.y + Math.sin(t) * r;
        if (this.walkableAt(x, y)) {
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < bd) {
            bd = d;
            best = { x, y };
          }
        }
      }
      if (best) return best;
    }
    return { x: p.x, y: p.y };
  }

  /**
   * A* + string pulling. Blockers are other actors ({x, y, r}) treated as
   * temporary obstacles (the start/goal cells are always allowed).
   * @param {Pt} from @param {Pt} to
   * @returns {Pt[] | null} waypoints excluding `from`
   */
  findPath(from, to, blockers = []) {
    const s = this.nearestWalkable(from);
    const g = this.nearestWalkable(to);
    if (this.lineOfSight(s, g, blockers)) return finalize([g], to, g);

    const C = this.cell;
    const toCell = (p) => [
      Math.max(0, Math.min(this.cw - 1, Math.floor(p.x / C))),
      Math.max(0, Math.min(this.ch - 1, Math.floor(p.y / C))),
    ];
    const [sx, sy] = toCell(s);
    const [gx, gy] = toCell(g);
    const W = this.cw;
    const start = sy * W + sx;
    const goal = gy * W + gx;
    const blocked = (idx) => {
      if (idx === start || idx === goal) return false;
      if (!this.coarse[idx]) return true;
      if (!blockers.length) return false;
      const x = ((idx % W) + 0.5) * C;
      const y = (Math.floor(idx / W) + 0.5) * C;
      for (const bl of blockers) if (ellipseDist(x, y, bl.x, bl.y) < bl.r) return true;
      return false;
    };

    const gScore = new Float32Array(this.cw * this.ch).fill(Infinity);
    const came = new Int32Array(this.cw * this.ch).fill(-1);
    const closed = new Uint8Array(this.cw * this.ch);
    const heap = new Heap();
    const h = (i) => {
      const dx = Math.abs((i % W) - gx);
      const dy = Math.abs(Math.floor(i / W) - gy);
      return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * C;
    };
    gScore[start] = 0;
    heap.push(start, h(start));
    let found = false;
    let iterations = 0;
    while (heap.size && iterations++ < 12000) {
      const cur = heap.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= this.ch) continue;
          const ni = ny * W + nx;
          if (closed[ni] || blocked(ni)) continue;
          // no corner cutting
          if (dx && dy && (blocked(cy * W + nx) || blocked(ny * W + cx))) continue;
          const cost = gScore[cur] + (dx && dy ? Math.SQRT2 : 1) * C;
          if (cost < gScore[ni]) {
            gScore[ni] = cost;
            came[ni] = cur;
            heap.push(ni, cost + h(ni));
          }
        }
      }
    }
    if (!found) return null;

    /** @type {Pt[]} */
    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) {
      cells.push({ x: ((c % W) + 0.5) * C, y: (Math.floor(c / W) + 0.5) * C });
    }
    cells.reverse();
    cells[0] = s;
    cells[cells.length - 1] = g;

    // greedy forward string pulling: O(n) line-of-sight checks
    /** @type {Pt[]} */
    const out = [];
    let anchor = s;
    let i = 1;
    while (i < cells.length) {
      let j = i;
      while (j + 1 < cells.length && this.lineOfSight(anchor, cells[j + 1], blockers)) j++;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return finalize(out, to, g);
  }
}

/** Replace the snapped goal with the exact target when it's walkable. */
function finalize(path, to, snapped) {
  if (path.length && Math.hypot(to.x - snapped.x, to.y - snapped.y) < 1)
    path[path.length - 1] = { x: to.x, y: to.y };
  return path;
}

/** Perspective-aware distance (depth on screen is compressed: y counts double). */
export function ellipseDist(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = (y1 - y2) * 2;
  return Math.sqrt(dx * dx + dy * dy);
}
