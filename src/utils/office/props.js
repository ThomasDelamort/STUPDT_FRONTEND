// ============================================================================
// THE OFFICE: props. Ping-pong ball (parabolic, one bounce), punching bag
// (damped pendulum about its chain pivot), dumbbells (+ mat patch), paddles,
// flying paper tickets + the growing ticket pile, Zzz particles and the
// monitor glow. All world-space DOM; transform/opacity writes only.
// ============================================================================
import { TIMING } from "./timing";
import { OFFICE_PROPS } from "../../constants/office";

const polyToClip = (poly, ox, oy) =>
  `polygon(${poly.map(([x, y]) => `${x - ox}px ${y - oy}px`).join(",")})`;

function div(className, parent) {
  const el = document.createElement("div");
  el.className = className;
  parent.appendChild(el);
  return el;
}

/** Cache-aware style writer. */
function setT(el, cache, key, value) {
  if (cache[key] !== value) {
    cache[key] = value;
    if (key === "t") el.style.transform = value;
    else if (key === "o") el.style.opacity = value;
    else if (key === "z") el.style.zIndex = value;
  }
}

// ---------------------------------------------------------------------------
export class PunchingBag {
  constructor(engine, layer, officeUrl, patchUrl) {
    this.engine = engine;
    const P = OFFICE_PROPS.bag;
    this.theta = 0;
    this.omega = 0;
    this.cache = {};
    this.patchCache = {};
    // patch hides the baked bag while the animated copy swings
    this.patch = div("office-patch", layer);
    Object.assign(this.patch.style, {
      left: `${P.patch.x}px`,
      top: `${P.patch.y}px`,
      width: `${P.patch.w}px`,
      height: `${P.patch.h}px`,
      backgroundImage: `url("${patchUrl}")`,
      zIndex: "1",
      opacity: "0",
    });
    // the bag: a clipped copy of office.png, rotated about the chain pivot
    const xs = P.clip.map((p) => p[0]);
    const ys = P.clip.map((p) => p[1]);
    const bx = Math.min(...xs) - 4;
    const by = Math.min(...ys) - 4;
    const bw = Math.max(...xs) - bx + 8;
    const bh = Math.max(...ys) - by + 8;
    this.el = div("office-bag", layer);
    Object.assign(this.el.style, {
      left: `${bx}px`,
      top: `${by}px`,
      width: `${bw}px`,
      height: `${bh}px`,
      backgroundImage: `url("${officeUrl}")`,
      backgroundPosition: `-${bx}px -${by}px`,
      clipPath: polyToClip(P.clip, bx, by),
      transformOrigin: `${P.pivot.x - bx}px ${P.pivot.y - by}px`,
      zIndex: String(440 * 2),
      opacity: "0",
    });
  }

  /** @param {number} dir +1 pushes the bag towards screen-right */
  impulse(strength, dir = 1) {
    this.omega -= TIMING.BAG_IMPULSE * strength * dir; // CSS rotate: + is clockwise
  }

  get active() {
    return Math.abs(this.theta) > 0.0015 || Math.abs(this.omega) > 0.01;
  }

  step(dt) {
    if (!this.active) {
      this.theta = 0;
      this.omega = 0;
      return;
    }
    const acc = -TIMING.BAG_GRAVITY * Math.sin(this.theta) - TIMING.BAG_DAMPING * this.omega;
    this.omega += acc * dt;
    this.theta += this.omega * dt;
    this.theta = Math.max(-0.35, Math.min(0.35, this.theta));
  }

  render() {
    const on = this.active ? "1" : "0";
    setT(this.el, this.cache, "o", on);
    setT(this.patch, this.patchCache, "o", on);
    setT(this.el, this.cache, "t", `rotate(${((this.theta * 180) / Math.PI).toFixed(2)}deg)`);
  }
}

// ---------------------------------------------------------------------------
export class Dumbbells {
  constructor(engine, layer, patchUrl) {
    this.engine = engine;
    const P = OFFICE_PROPS.dumbbells;
    this.patch = div("office-patch", layer);
    Object.assign(this.patch.style, {
      left: `${P.patch.x}px`,
      top: `${P.patch.y}px`,
      width: `${P.patch.w}px`,
      height: `${P.patch.h}px`,
      backgroundImage: `url("${patchUrl}")`,
      clipPath: polyToClip(P.clip, P.patch.x, P.patch.y),
      zIndex: "1",
      opacity: "0",
    });
    this.patchCache = {};
    this.items = P.rest.map((rest) => {
      const el = div("office-dumbbell", layer);
      el.style.opacity = "0";
      return { el, rest, x: rest.x, y: rest.y, cache: {}, from: null, t: 1 };
    });
    /** @type {any} */ this.holder = null;
    this.returning = false;
  }

  /** Attach to an actor's hands (slides from the mat). */
  pickUp(actor) {
    this.holder = actor;
    this.returning = false;
    for (const it of this.items) {
      it.from = { x: it.x, y: it.y };
      it.t = 0;
    }
  }

  /** Put them back on the mat (also used when interrupted). */
  release() {
    if (!this.holder && !this.inUse) return;
    this.holder = null;
    this.returning = true;
    for (const it of this.items) {
      it.from = { x: it.x, y: it.y };
      it.t = 0;
    }
  }

  get inUse() {
    return this.holder !== null || this.returning;
  }

  step(dt) {
    const h = this.holder;
    let allHome = true;
    this.items.forEach((it, i) => {
      it.t = Math.min(1, it.t + dt / 0.35);
      let target = it.rest;
      if (h) {
        const a = h.anchorWorld(i === 0 ? "handL" : "handR") || h.anchorWorld("hand");
        if (a) target = { x: a.x, y: a.y + 4 };
      }
      const from = it.from || target;
      const e = it.t * it.t * (3 - 2 * it.t);
      it.x = from.x + (target.x - from.x) * e;
      it.y = from.y + (target.y - from.y) * e - (h ? 0 : Math.sin(e * Math.PI) * 18);
      if (!h && (it.t < 1 || Math.hypot(it.x - it.rest.x, it.y - it.rest.y) > 1)) allHome = false;
    });
    if (this.returning && allHome) this.returning = false;
  }

  render() {
    const on = this.inUse;
    setT(this.patch, this.patchCache, "o", on ? "1" : "0");
    for (const it of this.items) {
      setT(it.el, it.cache, "o", on ? "1" : "0");
      setT(
        it.el,
        it.cache,
        "t",
        `translate3d(${(it.x - 17).toFixed(1)}px,${(it.y - 7).toFixed(1)}px,0)`,
      );
      const z = this.holder ? Math.floor(this.holder.y) * 2 + 1 : 2 * 430;
      setT(it.el, it.cache, "z", String(z));
    }
  }
}

// ---------------------------------------------------------------------------
/** A paddle held in an actor's hand. */
export class Paddle {
  constructor(layer) {
    this.el = div("office-paddle", layer);
    this.el.style.opacity = "0";
    /** @type {any} */ this.actor = null;
    this.cache = {};
  }

  attach(actor) {
    this.actor = actor;
  }

  detach() {
    this.actor = null;
  }

  render() {
    const a = this.actor;
    if (!a) {
      setT(this.el, this.cache, "o", "0");
      return;
    }
    const hand = a.anchorWorld("hand") ||
      a.anchorWorld(a.facing > 0 ? "handR" : "handL") || { x: a.x, y: a.y - 90 };
    setT(this.el, this.cache, "o", String(a.alpha));
    const rot = a.frameKey.startsWith("interact") ? -40 * a.facing : -15 * a.facing;
    setT(
      this.el,
      this.cache,
      "t",
      `translate3d(${(hand.x - 8).toFixed(1)}px,${(hand.y - 18).toFixed(1)}px,0) rotate(${rot}deg)`,
    );
    setT(this.el, this.cache, "z", String(Math.floor(a.y) * 2 + 1));
  }
}

// ---------------------------------------------------------------------------
/** Ping-pong ball: parabolic hop to a bounce point, then up to the receiver. */
export class Ball {
  constructor(layer) {
    this.el = div("office-ball", layer);
    this.shadow = div("office-ball-shadow", layer);
    this.el.style.opacity = "0";
    this.shadow.style.opacity = "0";
    this.cache = {};
    this.sCache = {};
    /** @type {any} */ this.flight = null;
    this.x = 0;
    this.y = 0;
    this.alpha = 0;
    this.shadowY = 0;
    this.overTable = false;
  }

  /**
   * @param {{x:number,y:number}} from
   * @param {{x:number,y:number}} bounce (on the table plane)
   * @param {{x:number,y:number}} to
   * @param {number} duration
   * @param {{ miss?: boolean, onArrive?: () => void }} opts
   */
  launch(from, bounce, to, duration, opts = {}) {
    this.flight = {
      from,
      bounce,
      to,
      duration,
      t: 0,
      miss: Boolean(opts.miss),
      onArrive: opts.onArrive,
    };
    this.alpha = 1;
  }

  drop() {
    if (!this.flight && this.alpha <= 0) return;
    const f = this.flight;
    this.flight = {
      from: { x: this.x, y: this.y },
      bounce: { x: this.x + (f ? Math.sign(f.to.x - f.from.x) * 30 : 0), y: this.y + 70 },
      to: { x: this.x + (f ? Math.sign(f.to.x - f.from.x) * 50 : 0), y: this.y + 90 },
      duration: 0.7,
      t: 0,
      miss: true,
      fade: true,
    };
  }

  get busy() {
    return Boolean(this.flight);
  }

  step(dt) {
    const f = this.flight;
    if (!f) {
      this.alpha = Math.max(0, this.alpha - dt * 2.5);
      return;
    }
    f.t += dt / f.duration;
    const split = 0.56;
    let x;
    let y;
    if (f.t < split) {
      const u = f.t / split;
      x = f.from.x + (f.bounce.x - f.from.x) * u;
      y =
        f.from.y +
        (f.bounce.y - f.from.y) * u -
        Math.sin(u * Math.PI) * TIMING.PP_ARC * (f.fade ? 0.2 : 1);
      this.shadowY = f.bounce.y;
    } else {
      const u = (f.t - split) / (1 - split);
      const end = f.miss ? { x: f.to.x + (f.to.x - f.bounce.x) * 0.5, y: f.to.y + 60 } : f.to;
      x = f.bounce.x + (end.x - f.bounce.x) * u;
      y = f.bounce.y + (end.y - f.bounce.y) * u - Math.sin(u * Math.PI) * TIMING.PP_ARC * 0.55;
      this.shadowY = f.bounce.y;
    }
    this.x = x;
    this.y = y;
    this.overTable = x > OFFICE_PROPS.pingpong.left.x && x < OFFICE_PROPS.pingpong.right.x;
    if (f.fade) this.alpha = Math.max(0, 1 - f.t);
    if (f.t >= 1) {
      const cb = f.onArrive;
      this.flight = null;
      if (f.miss) this.alpha = Math.max(0, this.alpha - 0.2);
      if (cb) cb();
    }
  }

  render() {
    const o = this.alpha.toFixed(2);
    setT(this.el, this.cache, "o", o);
    setT(
      this.el,
      this.cache,
      "t",
      `translate3d(${(this.x - 5).toFixed(1)}px,${(this.y - 5).toFixed(1)}px,0)`,
    );
    setT(this.shadow, this.sCache, "o", this.overTable ? (this.alpha * 0.5).toFixed(2) : "0");
    setT(
      this.shadow,
      this.sCache,
      "t",
      `translate3d(${(this.x - 6).toFixed(1)}px,${(this.shadowY - 2).toFixed(1)}px,0)`,
    );
  }
}

// ---------------------------------------------------------------------------
/** Paper tickets: thrown in arcs (hot potato) + a pile that grows per prompt. */
export class Tickets {
  constructor(layer, pileAt) {
    this.layer = layer;
    this.pileAt = pileAt;
    /** @type {{el: HTMLElement, cache: any, from: any, to: any, t: number, dur: number, actorTo: any, n: number}[]} */
    this.flying = [];
    /** @type {{el: HTMLElement, x: number, y: number, rot: number}[]} */
    this.pile = [];
    this.pileAlpha = 0;
    this.pileTarget = 0;
    this.pileCache = {};
    this.pileEl = div("office-pile", layer);
    this.pileEl.style.opacity = "0";
    this.counter = 0;
  }

  makeTicket(n) {
    const el = div("office-ticket", this.layer);
    el.textContent = `#${String(n).padStart(3, "0")}`;
    return el;
  }

  /** @param {{x:number,y:number}} from @param {{x:number,y:number}} to */
  throw(from, to, n) {
    const el = this.makeTicket(n);
    this.flying.push({
      el,
      cache: {},
      from,
      to,
      t: 0,
      dur: TIMING.TICKET_FLIGHT,
      actorTo: null,
      n,
    });
  }

  /** Add one ticket to the pile (a new prompt landed). */
  addToPile(n) {
    this.counter = n;
    const i = this.pile.length;
    if (i >= 7) return;
    const el = document.createElement("div");
    el.className = "office-ticket office-ticket--pile";
    el.textContent = `#${String(n).padStart(3, "0")}`;
    const x = (i % 3) * 9 - 9 + (i > 2 ? 4 : 0);
    const y = -Math.floor(i / 3) * 5 - i * 1.5;
    el.style.transform = `translate(${x}px,${y}px) rotate(${((i * 37) % 30) - 15}deg)`;
    this.pileEl.appendChild(el);
    this.pile.push({ el, x, y, rot: 0 });
    this.pileTarget = 1;
  }

  clearPile() {
    this.pileTarget = 0;
  }

  step(dt) {
    for (const f of this.flying) f.t += dt / f.dur;
    for (const f of this.flying.filter((ff) => ff.t >= 1)) f.el.remove();
    this.flying = this.flying.filter((f) => f.t < 1);
    if (this.pileAlpha !== this.pileTarget) {
      this.pileAlpha =
        this.pileTarget > this.pileAlpha
          ? Math.min(1, this.pileAlpha + dt * 3)
          : Math.max(0, this.pileAlpha - dt * 1.2);
      if (this.pileAlpha === 0) {
        this.pileEl.replaceChildren();
        this.pile = [];
      }
    }
  }

  render() {
    for (const f of this.flying) {
      const u = Math.min(1, f.t);
      const x = f.from.x + (f.to.x - f.from.x) * u;
      const y = f.from.y + (f.to.y - f.from.y) * u - Math.sin(u * Math.PI) * 70;
      setT(
        f.el,
        f.cache,
        "t",
        `translate3d(${(x - 14).toFixed(1)}px,${(y - 9).toFixed(1)}px,0) rotate(${(u * 540).toFixed(0)}deg)`,
      );
      setT(f.el, f.cache, "z", "1900");
    }
    setT(this.pileEl, this.pileCache, "o", this.pileAlpha.toFixed(2));
    setT(
      this.pileEl,
      this.pileCache,
      "t",
      `translate3d(${this.pileAt.x - 14}px,${this.pileAt.y - 9}px,0)`,
    );
    setT(this.pileEl, this.pileCache, "z", String(Math.floor(this.pileAt.y) * 2));
  }

  destroy() {
    for (const f of this.flying) f.el.remove();
    this.pileEl.remove();
  }
}

// ---------------------------------------------------------------------------
/** Floating "Z" particles over a sleeper. */
export class Particles {
  constructor(layer) {
    this.layer = layer;
    /** @type {{el: HTMLElement, x: number, y: number, t: number, life: number, drift: number, cache: any}[]} */
    this.items = [];
  }

  spawn(x, y, text = "Z") {
    if (this.items.length > 8) return;
    const el = div("office-zzz", this.layer);
    el.textContent = text;
    this.items.push({ el, x, y, t: 0, life: 2.4, drift: (Math.random() - 0.3) * 18, cache: {} });
  }

  step(dt) {
    for (const p of this.items) p.t += dt;
    for (const p of this.items.filter((pp) => pp.t >= pp.life)) p.el.remove();
    this.items = this.items.filter((p) => p.t < p.life);
  }

  render() {
    for (const p of this.items) {
      const u = p.t / p.life;
      const o = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
      setT(p.el, p.cache, "o", Math.max(0, o).toFixed(2));
      setT(
        p.el,
        p.cache,
        "t",
        `translate3d(${(p.x + p.drift * u + Math.sin(p.t * 3) * 4).toFixed(1)}px,${(p.y - u * 46).toFixed(1)}px,0) scale(${(0.7 + u * 0.6).toFixed(2)})`,
      );
    }
  }

  clear() {
    for (const p of this.items) p.el.remove();
    this.items = [];
  }
}

// ---------------------------------------------------------------------------
/** Monitor glow: flickers while someone types, dims when they leave. */
export class MonitorGlow {
  constructor(layer) {
    const P = OFFICE_PROPS.monitors.poly;
    const xs = P.map((p) => p[0]);
    const ys = P.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    this.el = div("office-glow", layer);
    Object.assign(this.el.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${Math.max(...xs) - x}px`,
      height: `${Math.max(...ys) - y}px`,
      clipPath: polyToClip(P, x, y),
      zIndex: "3",
      opacity: "0",
    });
    this.level = 0;
    this.target = 0;
    this.t = 0;
    this.cache = {};
  }

  setOn(on) {
    this.target = on ? 1 : 0;
  }

  step(dt, reduced) {
    this.t += dt;
    const k = dt * (this.target ? 2 : 0.8);
    this.level =
      this.target > this.level ? Math.min(1, this.level + k) : Math.max(0, this.level - k);
    const flicker = reduced ? 0 : (Math.sin(this.t * 13) + Math.sin(this.t * 31)) * 0.04;
    this.opacity = Math.max(0, this.level * (0.36 + flicker));
  }

  render() {
    setT(this.el, this.cache, "o", (this.opacity || 0).toFixed(2));
  }
}
