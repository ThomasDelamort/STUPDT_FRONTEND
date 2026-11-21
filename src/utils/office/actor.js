// ============================================================================
// THE OFFICE: one staff member. Owns position, path-following, facing,
// animation/pose evaluation and its DOM nodes (sprite, floor shadow, name
// tag). Rendering writes only transform / background-position / opacity
// (+ z-index when the feet cross a depth bucket).
// ============================================================================
import { TIMING } from "./timing";
import { ellipseDist } from "./pathing";
import { OFFICE_POSES, OFFICE_DEPTH } from "../../constants/office";

/** @typedef {{x: number, y: number}} Pt */

const VIEW_BY_ANGLE = ["right", "frontRight", "front", "frontLeft", "left", "backLeft", "back", "backRight"];

/** Nearest of the 8 turnaround views for a facing vector (screen space). */
export function viewForVector(dx, dy) {
  const a = Math.atan2(dy, dx); // 0 = right, +pi/2 = towards camera
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return VIEW_BY_ANGLE[i];
}

export function depthScale(y) {
  const t = (y - OFFICE_DEPTH.yBack) / (OFFICE_DEPTH.yFront - OFFICE_DEPTH.yBack);
  const c = Math.max(0, Math.min(1, t));
  return OFFICE_DEPTH.scaleBack + (OFFICE_DEPTH.scaleFront - OFFICE_DEPTH.scaleBack) * c;
}

export class Actor {
  /**
   * @param {any} engine
   * @param {import('../../constants/office').OfficeCharacter} character
   * @param {import('./atlas').Atlas} atlas
   * @param {number} index
   */
  constructor(engine, character, atlas, index) {
    this.engine = engine;
    this.char = character;
    this.id = character.id;
    this.name = character.name;
    this.atlas = atlas;
    this.index = index;

    // --- world state ---
    this.x = 0;
    this.y = 0;
    this.px = 0; // previous step (render interpolation)
    this.py = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // +1 screen-right, -1 screen-left (mirrors side frames)

    // --- movement ---
    /** @type {Pt[]} */ this.path = [];
    /** @type {Pt | null} */ this.goal = null;
    this.moveMode = /** @type {'walk' | 'run' | null} */ (null);
    this.direct = false; // scripted straight-line move (sit down / stand up)
    this.directSpeed = 0;
    this.directWalk = false; // animate the walk cycle during a direct move
    this.exiting = false; // standing up / dropping off the bar
    /** @type {number | null} */ this.zOverride = null; // pinned depth (seats)
    this.travelToken = 0;
    /** @type {any} */ this.activity = null;
    /** @type {any} */ this.member = null;
    /** @type {(() => void) | null} */ this.onArrive = null;
    this.blockedFor = 0;
    this.vertical = false; // side-walk vs front/back-walk hysteresis state
    this.walkPhase = 0; // continuous cycle phase in frames; never reset

    // --- pose / animation ---
    this.poseName = "stand";
    this.poseTime = 0;
    /** @type {string | null} */ this.view = null; // turnaround view when standing still
    this.lookView = /** @type {string | null} */ (null); // brief look-around
    this.frameKey = "idle_0";
    this.flip = false;
    this.fx = { offX: 0, offY: 0, lift: 0, rot: 0, sx: 1, sy: 1, sink: 0 };
    /** @type {((a: Actor, dt: number) => void) | null} */ this.fxHook = null;
    this.alpha = 1;
    this.targetAlpha = 1;
    this.shadowOn = true;
    this.tagOn = true;

    // --- behaviour (owned by the director) ---
    this.state = "idle";
    this.stateTime = 0;
    /** @type {any} */ this.task = null;
    this.slot = /** @type {string | null} */ (null);
    this.mark = /** @type {string | null} */ (null); // "!" / "?!" over head
    this.markUntil = 0;

    // --- DOM ---
    const cell = atlas.cell;
    this.cellW = cell.w;
    this.cellH = cell.h;
    this.pivotX = cell.pivot[0];
    this.pivotY = cell.pivot[1];

    const el = document.createElement("div");
    el.className = "office-sprite";
    el.style.width = `${this.cellW}px`;
    el.style.height = `${this.cellH}px`;
    el.style.backgroundImage = `url("${atlas.url}")`;
    el.style.transformOrigin = `${this.pivotX}px ${this.pivotY}px`;
    el.dataset.actor = this.id;
    this.el = el;

    const shadow = document.createElement("div");
    shadow.className = "office-shadow";
    this.shadowEl = shadow;

    const tag = document.createElement("div");
    tag.className = "office-tag";
    tag.style.setProperty("--accent", character.accent);
    tag.textContent = character.name.toUpperCase();
    this.tagEl = tag;

    const mark = document.createElement("div");
    mark.className = "office-mark";
    this.markEl = mark;

    // last-written cache (avoid redundant style writes)
    this._t = "";
    this._bg = "";
    this._z = -1;
    this._o = -1;
    this._st = "";
    this._tagT = "";
    this._markT = "";
    this._markText = "";
  }

  mount(layers) {
    layers.sprites.appendChild(this.el);
    layers.shadows.appendChild(this.shadowEl);
    layers.overlay.appendChild(this.tagEl);
    layers.overlay.appendChild(this.markEl);
  }

  unmount() {
    this.el.remove();
    this.shadowEl.remove();
    this.tagEl.remove();
    this.markEl.remove();
  }

  // ------------------------------------------------------------------------
  // Placement & movement
  // ------------------------------------------------------------------------
  placeAt(x, y) {
    this.x = this.px = x;
    this.y = this.py = y;
  }

  get moving() {
    return this.moveMode !== null || this.direct;
  }

  get scale() {
    return TIMING.SPRITE_SCALE * depthScale(this.y);
  }

  /** Visible standing height in world px (bubbles sit above this). */
  get headHeight() {
    return this.atlas.standHeight * this.scale;
  }

  /**
   * Path-find to a walkable point.
   * @param {Pt} target
   * @param {{ mode?: 'walk' | 'run', onArrive?: () => void, avoid?: boolean }} [opts]
   */
  moveTo(target, opts = {}) {
    const nav = this.engine.nav;
    const blockers = opts.avoid === false ? [] : this.engine.blockersFor(this);
    let path = nav.findPath({ x: this.x, y: this.y }, target, blockers);
    if (!path) path = nav.findPath({ x: this.x, y: this.y }, target, []);
    if (!path) path = [nav.nearestWalkable(target)];
    this.path = path;
    this.goal = path[path.length - 1];
    this.moveMode = opts.mode || "walk";
    // long dashes sprint (up to +35%): far-away staff still make the huddle
    let len = 0;
    let px = this.x;
    let py = this.y;
    for (const p of path) {
      len += Math.hypot(p.x - px, p.y - py);
      px = p.x;
      py = p.y;
    }
    this.sprint = this.moveMode === "run" ? 1 + Math.max(0, Math.min(0.35, (len - 380) / 900)) : 1;
    this.direct = false;
    this.onArrive = opts.onArrive || null;
    this.blockedFor = 0;
  }

  /** Scripted straight move (into a seat / onto the bar). Ignores the nav grid. */
  moveDirect(target, speed, onArrive) {
    this.path = [target];
    this.goal = target;
    this.direct = true;
    this.directSpeed = speed;
    this.moveMode = null;
    this.onArrive = onArrive || null;
  }

  /** Step aside (perpendicular, onto walkable floor) and then resume the route. */
  sidestep(other) {
    const goal = this.goal;
    const mode = this.moveMode || "walk";
    const cb = this.onArrive;
    const ax = other.x - this.x;
    const ay = other.y - this.y;
    const len = Math.hypot(ax, ay) || 1;
    const nav = this.engine.nav;
    const cands = [1, -1].map((side) => ({ x: this.x + (-ay / len) * 48 * side, y: this.y + (ax / len) * 24 * side }));
    const spot = cands.find((p) => nav.walkableAt(p.x, p.y)) || nav.nearestWalkable({ x: this.x - ax * 0.6, y: this.y - ay * 0.6 });
    this.sidestepping = true;
    this.moveTo(spot, {
      mode,
      avoid: false,
      onArrive: () => {
        this.sidestepping = false;
        if (goal) this.moveTo(goal, { mode, onArrive: cb || undefined });
      },
    });
    this.blockedFor = 0;
  }

  stop() {
    this.sidestepping = false;
    this.path = [];
    this.goal = null;
    this.moveMode = null;
    this.direct = false;
    this.directWalk = false;
    this.onArrive = null;
    this.vx = 0;
    this.vy = 0;
  }

  /** Face a world point (sets side facing + standing view). */
  faceTowards(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) > 2) this.facing = dx >= 0 ? 1 : -1;
    this.view = viewForVector(dx, dy);
  }

  setPose(name, { view = null, facing = 0 } = {}) {
    if (this.poseName !== name) {
      this.poseName = name;
      this.poseTime = 0;
    }
    if (view !== null) this.view = view;
    if (facing) this.facing = facing;
  }

  setMark(text, seconds) {
    this.mark = text;
    this.markUntil = this.engine.time + seconds;
  }

  // ------------------------------------------------------------------------
  // Simulation step
  // ------------------------------------------------------------------------
  step(dt) {
    this.px = this.x;
    this.py = this.y;
    this.stateTime += dt;
    this.poseTime += dt;

    if (this.path.length) this.integrateMovement(dt);
    else {
      this.vx = 0;
      this.vy = 0;
    }

    // opacity fades (reduced-motion relocation)
    if (this.alpha !== this.targetAlpha) {
      const k = dt / (TIMING.FADE_MS / 1000);
      this.alpha =
        this.alpha < this.targetAlpha
          ? Math.min(this.targetAlpha, this.alpha + k)
          : Math.max(this.targetAlpha, this.alpha - k);
    }
    if (this.mark && this.engine.time > this.markUntil) this.mark = null;

    this.evaluatePose(dt);

    // teleport guard (debug counter): nothing may move faster than running
    const moved = Math.hypot(this.x - this.px, this.y - this.py);
    if (moved > TIMING.RUN_SPEED * 1.6 * dt + 0.5 && !this.engine.allowJump) {
      this.engine.debugStats.teleports++;
      if (this.engine.debug) console.warn(`[office] ${this.id} jumped ${moved.toFixed(1)}px in one step`);
    }
  }

  integrateMovement(dt) {
    const target = this.path[0];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const isLast = this.path.length === 1;

    let speed;
    if (this.direct) speed = this.directSpeed;
    else speed = this.moveMode === "run" ? TIMING.RUN_SPEED * (this.sprint || 1) : TIMING.WALK_SPEED;
    speed *= depthScale(this.y);

    // arrive easing on the final leg
    if (isLast && !this.direct) {
      const remaining = dist;
      const floor = this.moveMode === "run" ? 0.55 : 0.35;
      if (remaining < TIMING.ARRIVE_RADIUS) speed *= Math.max(floor, remaining / TIMING.ARRIVE_RADIUS);
    }

    // separation: wait for whoever is in the way; replan around them if it
    // lasts; if still stuck head-on, the lower-priority actor side-steps
    // (the last few px of the final leg never yield: a neighbour that happens
    // to sit "ahead" of a tiny remaining vector must not freeze the arrival)
    if (!this.direct && !(isLast && dist < 14)) {
      const other = this.engine.actorAhead(this, dx / (dist || 1), dy / (dist || 1));
      if (other) {
        this.blockedFor += dt;
        if (this.blockedFor > TIMING.YIELD_MAX * 2.5 && other.index < this.index && !this.sidestepping) {
          this.sidestep(other);
          return;
        }
        if (this.blockedFor > TIMING.YIELD_MAX && !this.replanned) {
          this.replanned = true;
          const goal = this.goal;
          const mode = this.moveMode || "walk";
          const cb = this.onArrive;
          const keep = this.blockedFor;
          if (goal) this.moveTo(goal, { mode, onArrive: cb || undefined });
          this.blockedFor = keep;
        }
        this.vx = 0;
        this.vy = 0;
        return;
      }
      this.blockedFor = 0;
      this.replanned = false;
    }

    const stepLen = speed * dt;
    if (dist <= stepLen || dist < 0.5) {
      this.x = target.x;
      this.y = target.y;
      this.path.shift();
      if (!this.path.length) {
        const cb = this.onArrive;
        this.stop();
        if (cb) cb();
      }
      return;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    this.vx = nx * speed;
    this.vy = ny * speed;
    this.x += nx * stepLen;
    this.y += ny * stepLen;
  }

  // ------------------------------------------------------------------------
  // Pose -> frame + transform parameters
  // ------------------------------------------------------------------------
  evaluatePose(dt) {
    const fx = this.fx;
    fx.offX = 0;
    fx.offY = 0;
    fx.lift = 0;
    fx.rot = 0;
    fx.sx = 1;
    fx.sy = 1;
    fx.sink = 0;
    const reduced = this.engine.reducedMotion;
    const atlas = this.atlas;

    const speed = Math.hypot(this.vx, this.vy);
    if ((this.moveMode || (this.direct && this.directWalk)) && speed > 1) {
      // locomotion
      const ax = Math.abs(this.vx);
      const ay = Math.abs(this.vy);
      const ratio = ay / (ax + 1e-3);
      if (this.vertical && ratio < 1 - TIMING.TURN_HYSTERESIS) this.vertical = false;
      else if (!this.vertical && ratio > 1 + TIMING.TURN_HYSTERESIS) this.vertical = true;
      const running = this.moveMode === "run";
      const cyclePx = (running ? TIMING.RUN_CYCLE_PX : TIMING.WALK_CYCLE_PX) * depthScale(this.y);
      const fps = (8 * speed) / cyclePx;
      this.walkPhase = (this.walkPhase + fps * dt) % 8; // phase continues across turns
      if (!this.vertical) {
        if (this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;
        this.frameKey = `${running ? "run" : "walk"}_${Math.floor(this.walkPhase) % 8}`;
        this.flip = this.facing < 0;
      } else {
        // front/back view + bob (no front-facing walk cycle in the sheets)
        const toward = this.vy > 0;
        const diag = ax > ay * 0.45;
        let view = toward ? "front" : "back";
        if (diag) view = toward ? (this.vx > 0 ? "frontRight" : "frontLeft") : this.vx > 0 ? "backRight" : "backLeft";
        this.frameKey = atlas.viewFrame(view);
        this.flip = false;
        const bob = Math.abs(Math.sin((this.walkPhase / 8) * Math.PI * 2));
        fx.lift = reduced ? 0 : bob * TIMING.BOB_PX * (running ? 1.8 : 1);
        fx.rot = reduced ? 0 : Math.sin((this.walkPhase / 8) * Math.PI * 2) * (running ? 2 : 1.2);
      }
      this.view = null;
      return;
    }

    const pose = OFFICE_POSES[this.poseName] || OFFICE_POSES.stand;
    const fpsScale = reduced ? 0 : 1;
    let flipAllowed = true;
    if (pose.anim === "idle") {
      const look = this.lookView || this.view;
      if (look && look !== "front") {
        this.frameKey = atlas.viewFrame(look);
        flipAllowed = false;
      } else {
        const fps = reduced ? TIMING.REDUCED_FPS : TIMING.IDLE_FPS;
        const n = Math.floor(this.engine.time * fps + this.index * 1.7) % 4;
        this.frameKey = `idle_${n}`;
        flipAllowed = false;
      }
    } else if (pose.view) {
      const v = pose.view === "auto" ? this.view || "front" : pose.view;
      this.frameKey = atlas.viewFrame(this.lookView || v);
      flipAllowed = false;
    } else if (pose.frames) {
      const fps = pose.fps || 0;
      const n = fps ? Math.floor(this.poseTime * (reduced ? Math.min(fps, TIMING.REDUCED_FPS) : fps)) : 0;
      const key = pose.frames[n % pose.frames.length];
      this.frameKey = atlas.has(key) ? key : "idle_0";
    }
    this.flip = flipAllowed && this.facing < 0;

    if (pose.sink) fx.sink = pose.sink;
    if (pose.rotate) fx.rot = pose.rotate * (this.flip ? -1 : 1);
    if (!reduced) {
      const t = this.engine.time;
      if (pose.jitter) fx.offX += Math.sin(t * pose.jitter.hz * Math.PI * 2) * pose.jitter.amp * 0.5;
      if (pose.shake) {
        fx.offX += Math.sin(t * 47 + this.index) * pose.shake;
        fx.lift += Math.abs(Math.sin(t * 11)) * pose.shake;
      }
      if (pose.breathe) {
        const b = (Math.sin(t * TIMING.BREATHE_HZ * Math.PI * 2) + 1) / 2;
        fx.sy = 1 + b * 0.03;
      }
      if (pose.hop) fx.lift += Math.sin(Math.min(1, this.poseTime / 0.45) * Math.PI) * pose.hop;
      if (pose.lunge) fx.offX += Math.sin(Math.min(1, this.poseTime / 0.22) * Math.PI) * pose.lunge * this.facing;
    }
    if (this.fxHook) this.fxHook(this, dt * fpsScale);
  }

  // ------------------------------------------------------------------------
  // Render (interpolated). s = world->screen scale for the overlay layer.
  // ------------------------------------------------------------------------
  render(alpha, s) {
    const x = this.px + (this.x - this.px) * alpha;
    const y = this.py + (this.y - this.py) * alpha;
    const fx = this.fx;
    const sc = TIMING.SPRITE_SCALE * depthScale(y);
    const frame = this.atlas.frame(this.frameKey);
    const drawnH = frame.pivot[1] - frame.trim[1];
    const sinkPx = fx.sink * drawnH * sc;
    const X = x + fx.offX;
    const Y = y + fx.offY - fx.lift + sinkPx;
    const sx = sc * fx.sx * (this.flip ? -1 : 1);
    const sy = sc * fx.sy;

    const t = `translate3d(${(X - this.pivotX).toFixed(2)}px,${(Y - this.pivotY).toFixed(2)}px,0) rotate(${fx.rot.toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    if (t !== this._t) {
      this.el.style.transform = t;
      this._t = t;
    }
    const bg = `-${frame.x}px -${frame.y}px`;
    if (bg !== this._bg) {
      this.el.style.backgroundPosition = bg;
      this._bg = bg;
    }
    const z = this.zOverride ?? Math.floor(y) * 2;
    if (z !== this._z) {
      this.el.style.zIndex = String(z);
      this._z = z;
    }
    const o = Math.round(this.alpha * 100) / 100;
    if (o !== this._o) {
      this.el.style.opacity = String(o);
      this.shadowEl.style.opacity = String(o * (this.shadowOn ? 1 : 0));
      this.tagEl.style.opacity = String(this.tagOn ? o : 0);
      this._o = o;
    }

    // floor shadow (stays on the floor when hopping / hanging)
    const shadowY = this.shadowOn ? y : y;
    const st = `translate3d(${(x - 28 * sc).toFixed(1)}px,${(shadowY - 8 * sc).toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
    if (st !== this._st) {
      this.shadowEl.style.transform = st;
      this._st = st;
    }

    // name tag: just under the feet, in screen px
    const tagT = `translate3d(${(x * s).toFixed(1)}px,${((y + 6) * s).toFixed(1)}px,0) translateX(-50%)`;
    if (tagT !== this._tagT) {
      this.tagEl.style.transform = tagT;
      this._tagT = tagT;
    }

    // "!" mark over the head
    const markText = this.mark || "";
    if (markText !== this._markText) {
      this.markEl.textContent = markText;
      this.markEl.style.opacity = markText ? "1" : "0";
      this._markText = markText;
    }
    if (markText) {
      const headY = Y - drawnH * sc * fx.sy - 6;
      const mt = `translate3d(${(X * s).toFixed(1)}px,${(headY * s).toFixed(1)}px,0) translate(-50%,-100%)`;
      if (mt !== this._markT) {
        this.markEl.style.transform = mt;
        this._markT = mt;
      }
    }
    return { x: X, y: Y, sc, drawnH };
  }

  /** World anchor of the speech bubble (above the visible head). */
  bubbleAnchor(alpha) {
    const x = this.px + (this.x - this.px) * alpha + this.fx.offX;
    const y = this.py + (this.y - this.py) * alpha;
    const sc = TIMING.SPRITE_SCALE * depthScale(y);
    const frame = this.atlas.frame(this.frameKey);
    const drawnH = frame.pivot[1] - frame.trim[1];
    const top = y - this.fx.lift + this.fx.sink * drawnH * sc - drawnH * sc;
    return { x, y: top - 4 };
  }

  /** World position of a cell-local anchor on the current frame (props). */
  anchorWorld(name) {
    const a = this.atlas.anchor(this.frameKey, name);
    if (!a) return null;
    const sc = TIMING.SPRITE_SCALE * depthScale(this.y);
    const frame = this.atlas.frame(this.frameKey);
    const drawnH = frame.pivot[1] - frame.trim[1];
    const lx = (a[0] - this.pivotX) * (this.flip ? -1 : 1);
    const ly = a[1] - this.pivotY;
    return {
      x: this.x + this.fx.offX + lx * sc,
      y: this.y + this.fx.offY - this.fx.lift + this.fx.sink * drawnH * sc + ly * sc,
    };
  }

  /** Overlap test used by separation (perspective ellipse). */
  distTo(other) {
    return ellipseDist(this.x, this.y, other.x, other.y);
  }
}
