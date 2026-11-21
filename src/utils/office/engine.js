// ============================================================================
// THE OFFICE: engine. Fixed-timestep simulation with render interpolation,
// one requestAnimationFrame loop, no React state per frame. Everything it
// creates (DOM, loops, timers) is torn down in destroy(), so StrictMode's
// double effects never leave a duplicate loop behind.
// ============================================================================
import officeUrl from "../../assets/office/office.webp";
import patchBagUrl from "../../assets/office/patch-bag.png";
import patchDumbbellsUrl from "../../assets/office/patch-dumbbells.png";
import { TIMING } from "./timing";
import { Rng } from "./rng";
import { NavGrid, ellipseDist } from "./pathing";
import { Actor } from "./actor";
import { loadAtlas, decodeImage } from "./atlas";
import { Bubbles } from "./bubbles";
import { Dialogue, validateDialogue } from "./dialogue";
import { Director } from "./director";
import { PunchingBag, Dumbbells, Ball, Paddle, Tickets, Particles, MonitorGlow } from "./props";
import { OFFICE_WORLD, OFFICE_NAV, OFFICE_HUDDLE } from "../../constants/office";

export const OFFICE_IMAGE_URL = officeUrl;

/**
 * Preload + decode the office image and every enabled atlas.
 * @param {import('../../constants/office').OfficeCharacter[]} characters
 */
export async function loadOfficeAssets(characters) {
  const [, , , ...atlases] = await Promise.all([
    decodeImage(officeUrl),
    decodeImage(patchBagUrl),
    decodeImage(patchDumbbellsUrl),
    ...characters.map((c) => loadAtlas(c.atlas)),
  ]);
  return { atlases };
}

function layer(parent, name) {
  const el = document.createElement("div");
  el.className = `office-layer office-layer--${name}`;
  parent.appendChild(el);
  return el;
}

export class OfficeEngine {
  /**
   * @param {{
   *   root: HTMLElement, overlay: HTMLElement,
   *   characters: import('../../constants/office').OfficeCharacter[],
   *   atlases: import('./atlas').Atlas[],
   *   tx: (s: string) => string,
   *   sound?: { playTone: Function } | null,
   *   reducedMotion?: boolean, debug?: boolean,
   *   onStatus?: (s: string) => void,
   *   onCaption?: (c: {name: string, text: string} | null) => void,
   *   onDebug?: (snap: any) => void,
   * }} opts
   */
  constructor(opts) {
    this.opts = opts;
    this.tx = opts.tx || ((s) => s);
    this.sound = opts.sound || null;
    this.reducedMotion = Boolean(opts.reducedMotion);
    this.debug = Boolean(opts.debug);
    this.rng = new Rng((Date.now() ^ 0x2545f491) >>> 0);
    this.time = 0;
    this.scale = 0.5;
    this.sceneW = 836;
    this.visible = true;
    this.running = false;
    this.allowJump = false;
    this.status = "idle";
    /** @type {{at: number, fn: () => void}[]} */
    this.timers = [];
    /** @type {((dt: number) => void) | null} */
    this.panicTicker = null;
    this.ticketCounter = 0;
    this.debugStats = { teleports: 0, fps: 0, seen: {}, scene: "", arc: "", lastStartle: 0, replyAt: 0 };

    this.nav = new NavGrid({ ...OFFICE_NAV, width: OFFICE_WORLD.w, height: OFFICE_NAV.height || OFFICE_WORLD.h });

    // layers (plain absolute divs: no stacking context, so sprite z-indexes
    // interleave with the React-rendered occluders in the world's context)
    this.root = opts.root;
    this.overlay = opts.overlay;
    this.layers = {
      shadows: layer(this.root, "shadows"),
      props: layer(this.root, "props"),
      sprites: layer(this.root, "sprites"),
      overlay: this.overlay,
    };

    this.props = {
      bag: new PunchingBag(this, this.layers.props, officeUrl, patchBagUrl),
      dumbbells: new Dumbbells(this, this.layers.props, patchDumbbellsUrl),
      ball: new Ball(this.layers.props),
      glow: new MonitorGlow(this.layers.props),
      tickets: new Tickets(this.layers.props, OFFICE_HUDDLE.ticketPile),
      particles: new Particles(this.layers.props),
      paddles: [0, 1, 2, 3].map(() => new Paddle(this.layers.props)),
      takePaddle: () => this.claimPaddle(),
      returnPaddle: (p) => {
        p.taken = false;
      },
    };

    this.actors = opts.characters.map((c, i) => {
      const a = new Actor(this, c, opts.atlases[i], i);
      a.mount(this.layers);
      return a;
    });
    this.bubbles = new Bubbles(this, this.overlay);
    this.dialogue = new Dialogue(this.actors.map((a) => a.id));
    this.director = new Director(this);

    if (this.debug) {
      const bad = validateDialogue();
      if (bad.length) console.warn("[office] lines over 60 chars:", bad);
    }

    /** @param {number} t */
    this.onFrame = (t) => this.frame(t);
    this.raf = 0;
    this.hiddenTimer = 0;
    this.last = 0;
    this.acc = 0;
    this.fpsFrames = 0;
    this.fpsT = 0;
    this.debugT = 0;
  }

  claimPaddle() {
    const p = this.props.paddles.find((pp) => !pp.taken);
    if (p) p.taken = true;
    return p || null;
  }

  // ------------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    this.director.init();
    this.tick(0);
    this.renderAll(1);
    this.resume();
  }

  resume() {
    if (!this.running) return;
    this.stopHiddenTicks();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.acc = 0;
    // render the current state once so nothing "catches up" visibly
    for (const a of this.actors) {
      a.px = a.x;
      a.py = a.y;
    }
    this.raf = requestAnimationFrame(this.onFrame);
  }

  /** Card offscreen / tab hidden: stop drawing, keep a low-rate sim tick. */
  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (!this.running) return;
    if (visible) this.resume();
    else {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.startHiddenTicks();
    }
  }

  startHiddenTicks() {
    this.stopHiddenTicks();
    let last = performance.now();
    const tickHidden = () => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      this.advance(dt);
      this.hiddenTimer = window.setTimeout(tickHidden, TIMING.HIDDEN_TICK_MS);
    };
    this.hiddenTimer = window.setTimeout(tickHidden, TIMING.HIDDEN_TICK_MS);
  }

  stopHiddenTicks() {
    if (this.hiddenTimer) window.clearTimeout(this.hiddenTimer);
    this.hiddenTimer = 0;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stopHiddenTicks();
    this.timers = [];
    this.director.destroy();
    for (const a of this.actors) a.unmount();
    this.bubbles.destroy();
    this.props.tickets.destroy();
    this.props.particles.clear();
    for (const l of [this.layers.shadows, this.layers.props, this.layers.sprites]) l.remove();
  }

  // ------------------------------------------------------------------------
  // Loop
  // ------------------------------------------------------------------------
  frame(now) {
    if (!this.running || !this.visible) return;
    const t0 = performance.now();
    const dt = Math.min(TIMING.MAX_DT, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    // timeScale: debug/QA fast-forward (more fixed steps per frame)
    this.acc += dt * (this.debug ? this.timeScale || 1 : 1);
    while (this.acc >= TIMING.STEP) {
      this.tick(TIMING.STEP);
      this.acc -= TIMING.STEP;
    }
    this.renderAll(this.acc / TIMING.STEP);

    this.fpsFrames++;
    this.fpsT += dt;
    if (this.fpsT >= 1) {
      this.debugStats.fps = Math.round(this.fpsFrames / this.fpsT);
      this.fpsFrames = 0;
      this.fpsT = 0;
    }
    this.debugStats.jsMs = performance.now() - t0;
    if (this.opts.onDebug) {
      this.debugT += dt;
      if (this.debugT > 0.2) {
        this.debugT = 0;
        this.opts.onDebug(this.snapshot());
      }
    }
    this.raf = requestAnimationFrame(this.onFrame);
  }

  /** Advance the sim without drawing (hidden). */
  advance(dt) {
    let left = dt;
    while (left > 1e-6) {
      const step = Math.min(TIMING.STEP, left);
      this.tick(step);
      left -= step;
    }
  }

  tick(dt) {
    this.time += dt;
    // sim-clock timers (fade relocations etc.)
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      this.timers = this.timers.filter((t) => t.at > this.time);
      for (const t of due) t.fn();
    }
    this.director.update(dt);
    if (this.panicTicker) this.panicTicker(dt);
    for (const a of this.actors) a.step(dt);
    this.allowJump = false;
    this.props.bag.step(dt);
    this.props.dumbbells.step(dt);
    this.props.ball.step(dt);
    this.props.glow.step(dt, this.reducedMotion);
    this.props.tickets.step(dt);
    this.props.particles.step(dt);
    this.bubbles.step(dt);
  }

  renderAll(alpha) {
    const s = this.scale;
    for (const a of this.actors) a.render(alpha, s);
    this.props.bag.render();
    this.props.dumbbells.render();
    this.props.ball.render();
    this.props.glow.render();
    this.props.tickets.render();
    this.props.particles.render();
    for (const p of this.props.paddles) p.render();
    this.bubbles.render(alpha, s, this.sceneW);
  }

  // ------------------------------------------------------------------------
  // Services used by actors / activities / director
  // ------------------------------------------------------------------------
  after(seconds, fn) {
    this.timers.push({ at: this.time + seconds, fn });
  }

  /** Reduced motion: fade out, relocate, fade in (no walking). */
  fadeRelocate(actor, target, done) {
    actor.stop();
    actor.targetAlpha = 0;
    this.after(TIMING.FADE_MS / 1000, () => {
      this.allowJump = true;
      actor.placeAt(target.x, target.y);
      actor.targetAlpha = 1;
      if (done) done();
    });
  }

  /** Stationary actors are temporary obstacles for path planning. */
  blockersFor(actor) {
    // anyone not currently moving (incl. walkers waiting on a yield)
    return this.actors
      .filter((o) => o !== actor && Math.hypot(o.vx, o.vy) < 1 && o.alpha > 0.5)
      .map((o) => ({ x: o.x, y: o.y, r: TIMING.PERSONAL_SPACE * 1.1 }));
  }

  /**
   * Separation: someone inside personal space that `actor` must yield to.
   * Anyone standing still ahead blocks; a higher-priority walker blocks
   * unless it is clearly behind us (so side-by-side walkers fall in line
   * instead of overlapping).
   */
  actorAhead(actor, nx, ny) {
    for (const o of this.actors) {
      if (o === actor || o.alpha < 0.5) continue;
      const d = ellipseDist(actor.x, actor.y, o.x, o.y);
      if (d > TIMING.PERSONAL_SPACE) continue;
      const dot = ((o.x - actor.x) * nx + (o.y - actor.y) * ny) / (d || 1);
      const oStill = Math.hypot(o.vx, o.vy) < 1;
      if (oStill && dot > 0.25) return o;
      // runners (huddle dash) pass each other; walkers fall in line
      if (!oStill && actor.moveMode !== "run" && o.index < actor.index && dot > -0.5) return o;
    }
    return null;
  }

  /**
   * A moving actor just ahead, heading the same way: followers slow down to
   * fall in line (queue) instead of clumping. Never blocks, never deadlocks.
   */
  leaderAhead(actor, nx, ny) {
    for (const o of this.actors) {
      if (o === actor || o.alpha < 0.5) continue;
      const sp = Math.hypot(o.vx, o.vy);
      if (sp < 1) continue;
      const d = ellipseDist(actor.x, actor.y, o.x, o.y);
      if (d > TIMING.PERSONAL_SPACE * 1.6) continue;
      const dot = ((o.x - actor.x) * nx + (o.y - actor.y) * ny) / (d || 1);
      const same = (o.vx * nx + o.vy * ny) / sp;
      if (dot > 0.6 && same > 0.5) return o;
    }
    return null;
  }

  setScale(s, sceneW) {
    this.scale = s;
    this.sceneW = sceneW;
    if (this.running && !this.visible) return;
    this.renderAll(1);
  }

  setTx(tx) {
    this.tx = tx;
  }

  setReducedMotion(on) {
    this.reducedMotion = Boolean(on);
  }

  setDebug(on) {
    this.debug = Boolean(on);
  }

  setStatus(status) {
    if (status === this.status) return;
    this.status = status;
    if (this.opts.onStatus) this.opts.onStatus(status);
  }

  caption(name, text) {
    if (this.opts.onCaption) this.opts.onCaption(name && text ? { name, text } : null);
  }

  /** One very quiet tone per bubble (huddle only, respects mute). */
  blip(actor) {
    if (!this.sound) return;
    try {
      this.sound.playTone(330 + actor.index * 70, "sine", 0.06, TIMING.BLIP_VOLUME);
    } catch {
      // audio is best-effort
    }
  }

  // ------------------------------------------------------------------------
  // Public events
  // ------------------------------------------------------------------------
  /** @param {{ id: string, text: string, dept: string }} prompt */
  prompt(prompt) {
    this.director.onPrompt(prompt);
  }

  /** @param {{ deptName: string }} info */
  reply(info) {
    this.director.onReply(info);
  }

  codeRed(on) {
    this.director.codeRed(on);
  }

  forceScene(i) {
    this.director.forceScene(i);
  }

  snapshot() {
    return {
      ...this.debugStats,
      atlases: this.actors.map((a) => a.atlas),
      time: this.time,
      mode: this.director.mode,
      status: this.status,
      actors: this.actors.map((a) => ({
        id: a.id,
        x: a.x,
        y: a.y,
        state: a.state,
        pose: a.poseName,
        frame: a.frameKey,
        path: a.path.map((p) => [p.x, p.y]),
        activity: a.activity ? a.activity.activity : null,
      })),
    };
  }
}
