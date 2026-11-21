// ============================================================================
// THE OFFICE: station behaviours. An Activity owns 1-4 actors and runs each
// through  wait -> travel -> enter -> perform -> (exit)  plus any group logic
// (rallies, chess turns). Interrupting releases props cleanly: the ball
// drops, the bag keeps swinging and damps out, dumbbells go back to the mat,
// the monitor glow dims.
// ============================================================================
import { TIMING } from "./timing";
import { OFFICE_SPOTS, OFFICE_PROPS, OFFICE_OCCLUDERS } from "../../constants/office";

/** z just behind an occluder (sprites use floor(y)*2, occluders sortY*2+1). */
function zBehind(spot) {
  const occ = spot.behind && OFFICE_OCCLUDERS.find((o) => o.id === spot.behind);
  return occ ? occ.sortY * 2 - 1 : null;
}

let tokenSeq = 0;

/**
 * Travel helper that respects reduced motion (fade-relocate instead of walk)
 * and drops stale callbacks when the actor has been reassigned.
 */
export function travel(engine, actor, target, { mode = "walk", direct = false, speed = 70, walk = true, onArrive } = {}) {
  const token = ++tokenSeq;
  actor.travelToken = token;
  const done = () => {
    if (actor.travelToken === token && onArrive) onArrive();
  };
  if (engine.reducedMotion) {
    engine.fadeRelocate(actor, target, done);
    return;
  }
  if (direct) {
    actor.moveDirect(target, speed, done);
    actor.directWalk = walk;
  } else actor.moveTo(target, { mode, onArrive: done });
}

export function cancelTravel(actor) {
  actor.travelToken = ++tokenSeq;
  actor.stop();
}

export class Activity {
  /**
   * @param {any} engine
   * @param {string} activity
   * @param {{actor: any, spotId: string}[]} assignment
   */
  constructor(engine, activity, assignment) {
    this.engine = engine;
    this.activity = activity;
    this.members = assignment.map(({ actor, spotId }, i) => ({
      actor,
      spotId,
      spot: OFFICE_SPOTS[spotId],
      index: i,
      phase: "wait",
      delay: 0,
      t: 0,
      data: /** @type {any} */ ({}),
    }));
    this.t = 0;
    this.finished = false;
    this.seen = false;
  }

  get rng() {
    return this.engine.rng;
  }

  /** @param {boolean} stagger */
  begin(stagger) {
    for (const m of this.members) {
      m.delay = stagger ? this.rng.range(0, TIMING.DEPART_STAGGER) : 0;
      m.phase = "wait";
      m.actor.activity = this;
      m.actor.member = m;
      m.actor.state = "wait";
    }
  }

  /** Initial frame: actors start already performing (no walk-in). */
  beginInPlace() {
    for (const m of this.members) {
      m.actor.activity = this;
      m.actor.member = m;
      m.actor.zOverride = zBehind(m.spot);
      m.actor.placeAt(m.spot.x, m.spot.y);
      this.enterDone(m);
    }
  }

  member(actor) {
    return this.members.find((m) => m.actor === actor);
  }

  get allPerforming() {
    return this.members.every((m) => m.phase === "perform");
  }

  update(dt) {
    this.t += dt;
    for (const m of this.members) {
      m.t += dt;
      if (m.phase === "wait") {
        if (m.actor.exiting) continue;
        m.delay -= dt;
        if (m.delay <= 0) this.depart(m);
      } else if (m.phase === "perform") {
        this.perform(m, dt);
      }
    }
    if (this.allPerforming) this.groupUpdate(dt);
  }

  depart(m) {
    m.phase = "travel";
    m.actor.state = "go_to";
    m.actor.setPose("stand", { view: null });
    const target = m.spot.approach || m.spot;
    travel(this.engine, m.actor, target, { onArrive: () => this.arrived(m) });
  }

  arrived(m) {
    if (m.spot.approach) {
      m.phase = "enter";
      m.actor.state = "enter";
      m.actor.zOverride = zBehind(m.spot);
      this.enter(m);
    } else this.enterDone(m);
  }

  /** Default ENTER: step from the approach point onto the spot. */
  enter(m) {
    travel(this.engine, m.actor, m.spot, {
      direct: true,
      speed: 64,
      onArrive: () => this.enterDone(m),
    });
  }

  enterDone(m) {
    m.phase = "perform";
    m.t = 0;
    m.actor.state = "perform";
    m.actor.directWalk = false;
    if (m.spot.face) m.actor.facing = m.spot.face;
    if (!this.seen) {
      this.seen = true;
      this.engine.director.markSeen(this.activity);
    }
    this.onPerform(m);
  }

  // --- overridables ---------------------------------------------------------
  onPerform(m) {
    m.actor.setPose("stand", { view: m.spot.view || null });
  }

  perform(_m, _dt) {}

  groupUpdate(_dt) {}

  /** Release props held by this member (instant, interruption-safe). */
  releaseProps(_m) {}

  /** Does leaving this spot need a scripted EXIT move (seats, bar)? */
  needsExit(m) {
    return Boolean(m.spot.approach) && (m.phase === "perform" || m.phase === "enter");
  }

  /**
   * Remove an actor from this activity. Seated actors stand up first.
   * @param {any} actor
   * @param {{ urgent?: boolean, delay?: number, onFree?: () => void }} [opts]
   */
  release(actor, opts = {}) {
    const m = this.member(actor);
    if (!m) {
      if (opts.onFree) opts.onFree();
      return;
    }
    this.releaseProps(m);
    actor.fxHook = null;
    actor.lookView = null;
    const exit = this.needsExit(m);
    this.members = this.members.filter((x) => x !== m);
    if (actor.activity === this) {
      actor.activity = null;
      actor.member = null;
    }
    if (!this.members.length) this.finish();
    else this.onMemberLeft(m);
    cancelTravel(actor);
    if (exit) {
      actor.exiting = true;
      actor.state = "exit";
      const free = () => {
        actor.exiting = false;
        actor.zOverride = null;
        actor.setPose("stand", { view: null });
        if (opts.onFree) opts.onFree();
      };
      // (a delayed stand-up that fires mid-huddle hurries too)
      const go = () => this.exitMove(m, opts.urgent || this.engine.director.mode !== "idle" ? 340 : 80, free);
      if (opts.delay && !opts.urgent) this.engine.after(opts.delay, go);
      else go();
    } else {
      actor.zOverride = null;
      actor.setPose("stand", { view: null });
      if (opts.onFree) opts.onFree();
    }
  }

  exitMove(m, speed, done) {
    const a = m.actor;
    a.setPose("stand", { view: null });
    travel(this.engine, a, m.spot.approach, { direct: true, speed, onArrive: done });
  }

  onMemberLeft(_m) {}

  finish() {
    this.finished = true;
  }

  ambient(m) {
    this.engine.director.tryAmbient(m.actor, this.activity);
  }
}

// ===========================================================================
export class ComputerActivity extends Activity {
  enter(m) {
    m.actor.setPose("type", { view: "back" });
    travel(this.engine, m.actor, m.spot, { direct: true, speed: 46, walk: false, onArrive: () => this.enterDone(m) });
  }

  onPerform(m) {
    m.actor.setPose("type", { view: "back" });
    m.data.nextTurn = this.rng.range(...TIMING.TYPE_HEADTURN);
    m.data.turning = 0;
    this.engine.props.glow.setOn(true);
  }

  perform(m, dt) {
    const d = m.data;
    if (d.turning > 0) {
      d.turning -= dt;
      if (d.turning <= 0) m.actor.setPose("type", { view: "back" });
    } else if (m.t > d.nextTurn) {
      m.actor.setPose("typeThink");
      d.turning = 1.4;
      d.nextTurn = m.t + this.rng.range(...TIMING.TYPE_HEADTURN);
      if (this.rng.chance(0.5)) this.ambient(m);
    }
  }

  exitMove(m, speed, done) {
    m.actor.setPose("stand", { view: "back" });
    travel(this.engine, m.actor, m.spot.approach, { direct: true, speed, walk: false, onArrive: done });
  }

  releaseProps() {
    this.engine.props.glow.setOn(false);
  }
}

// ===========================================================================
export class PullupActivity extends Activity {
  onPerform(m) {
    const a = m.actor;
    const d = m.data;
    a.setPose("pullup");
    a.facing = 1;
    // lift needed so the raised hands meet the bar
    const atlas = a.atlas;
    const hl = atlas.anchor("cheer_0", "handL");
    const hr = atlas.anchor("cheer_0", "handR");
    const handTop = Math.min(hl ? hl[1] : 30, hr ? hr[1] : 30);
    const handsAboveFeet = (a.pivotY - handTop) * a.scale;
    d.hang = Math.max(0, m.spot.y - m.spot.barY - handsAboveFeet);
    d.phase = "jump";
    d.pt = 0;
    d.reps = 0;
    d.setReps = this.rng.int(...TIMING.PULLUP_SET);
    d.lift = 0;
    a.fxHook = (actor) => {
      actor.fx.lift += d.lift;
    };
  }

  perform(m, dt) {
    const d = m.data;
    const a = m.actor;
    d.pt += dt;
    if (d.phase === "jump") {
      const u = Math.min(1, d.pt / 0.32);
      d.lift = d.hang * (1 - (1 - u) * (1 - u));
      if (u >= 1) {
        d.phase = "hang";
        d.pt = 0;
      }
    } else if (d.phase === "hang") {
      const rep = TIMING.PULLUP_REP;
      const cyc = d.pt / rep;
      d.lift = d.hang + ((1 - Math.cos(cyc * Math.PI * 2)) / 2) * TIMING.PULLUP_AMP;
      const done = Math.floor(cyc + 0.5);
      if (done > d.reps) {
        d.reps = done;
        this.engine.bubbles.say(a, String(d.reps), { kind: "rep", ms: 700 });
      }
      if (d.reps >= d.setReps && cyc % 1 < 0.05) {
        d.phase = "drop";
        d.pt = 0;
      }
    } else if (d.phase === "drop") {
      const u = Math.min(1, d.pt / 0.28);
      d.lift = d.hang * (1 - u * u);
      if (u >= 1) {
        d.phase = "rest";
        d.pt = 0;
        d.rest = this.rng.range(2, 4);
        a.setPose("stand");
        if (this.rng.chance(0.4)) this.ambient(m);
      }
    } else if (d.phase === "rest" && d.pt > d.rest) {
      a.setPose("pullup");
      d.phase = "jump";
      d.pt = 0;
      d.reps = 0;
      d.setReps = this.rng.int(...TIMING.PULLUP_SET);
    }
  }

  needsExit(m) {
    return m.phase === "perform" && m.data.lift > 1;
  }

  exitMove(m, _speed, done) {
    // drop from the bar
    const a = m.actor;
    const start = m.data.lift;
    let t = 0;
    a.setPose("stand");
    a.fxHook = (actor, dt) => {
      t += dt || 1 / 30;
      const u = Math.min(1, t / 0.25);
      actor.fx.lift += start * (1 - u * u);
      if (u >= 1) {
        actor.fxHook = null;
        done();
      }
    };
  }
}

// ===========================================================================
export class BagActivity extends Activity {
  onPerform(m) {
    m.actor.facing = 1;
    m.actor.setPose("boxGuard");
    m.data.next = this.rng.range(0.4, 1);
    m.data.attack = null;
    m.actor.fxHook = (a) => {
      if (a.poseName === "boxGuard" && !this.engine.reducedMotion) {
        a.fx.lift += Math.abs(Math.sin(this.engine.time * 6)) * 2.2;
      }
    };
  }

  perform(m, dt) {
    const d = m.data;
    const a = m.actor;
    if (d.attack) {
      d.attack.t += dt;
      if (!d.attack.hit && d.attack.t >= d.attack.hitAt) {
        d.attack.hit = true;
        this.engine.props.bag.impulse(d.attack.power, 1);
      }
      if (d.attack.t >= d.attack.dur) {
        d.attack = null;
        a.setPose("boxGuard");
        d.next = this.rng.range(...TIMING.BAG_PUNCH_GAP);
      }
      return;
    }
    d.next -= dt;
    if (d.next <= 0) {
      const kick = this.rng.chance(0.22);
      d.attack = kick
        ? { t: 0, dur: 0.48, hitAt: 0.22, power: 1.8, hit: false }
        : { t: 0, dur: 0.28, hitAt: 0.12, power: 1, hit: false };
      a.setPose(kick ? "kick" : "punch", { facing: 1 });
      if (this.rng.chance(0.08)) this.ambient(m);
    }
  }
}

// ===========================================================================
export class WeightsActivity extends Activity {
  onPerform(m) {
    m.actor.facing = -1;
    m.data.phase = "pick";
    m.data.pt = 0;
    m.data.reps = 0;
    m.data.setReps = this.rng.int(6, 10);
    m.actor.setPose("liftRest");
    this.engine.props.dumbbells.pickUp(m.actor);
  }

  perform(m, dt) {
    const d = m.data;
    const a = m.actor;
    const db = this.engine.props.dumbbells;
    d.pt += dt;
    if (d.phase === "pick" && d.pt > 0.45) {
      d.phase = "reps";
      d.pt = 0;
    } else if (d.phase === "reps") {
      const half = TIMING.LIFT_REP / 2;
      const up = Math.floor(d.pt / half) % 2 === 1;
      a.setPose(up ? "lift" : "stand", { view: "front" });
      const reps = Math.floor(d.pt / TIMING.LIFT_REP);
      if (reps > d.reps) {
        d.reps = reps;
        if (reps === 3 && this.rng.chance(0.5)) this.ambient(m);
      }
      if (d.reps >= d.setReps) {
        d.phase = "put";
        d.pt = 0;
        a.setPose("stand", { view: "frontLeft" });
        db.release();
      }
    } else if (d.phase === "put" && d.pt > this.rng.range(2.2, 3.2)) {
      d.phase = "pick";
      d.pt = 0;
      d.reps = 0;
      d.setReps = this.rng.int(6, 10);
      a.setPose("liftRest");
      db.pickUp(a);
    }
  }

  releaseProps() {
    this.engine.props.dumbbells.release();
  }
}

// ===========================================================================
export class BeanbagActivity extends Activity {
  enter(m) {
    travel(this.engine, m.actor, m.spot, { direct: true, speed: 70, onArrive: () => this.enterDone(m) });
  }

  onPerform(m) {
    const a = m.actor;
    const d = m.data;
    d.mode = this.rng.chance(0.62) ? "sleep" : "chill";
    d.switchAt = this.rng.range(10, 20);
    d.zzz = 0;
    a.facing = 1;
    a.setPose(d.mode);
    let squish = 0;
    a.fxHook = (actor, dt) => {
      if (squish < 0.4) {
        squish += dt || 1 / 30;
        actor.fx.sy *= 1 - Math.sin(Math.min(1, squish / 0.4) * Math.PI) * 0.1;
      }
    };
  }

  perform(m, dt) {
    const d = m.data;
    const a = m.actor;
    if (m.t > d.switchAt) {
      d.mode = d.mode === "sleep" ? "chill" : "sleep";
      d.switchAt = m.t + this.rng.range(10, 20);
      a.setPose(d.mode);
    }
    if (d.mode === "sleep" && !this.engine.reducedMotion) {
      d.zzz -= dt;
      if (d.zzz <= 0) {
        d.zzz = TIMING.ZZZ_EVERY;
        const p = a.bubbleAnchor(1);
        this.engine.props.particles.spawn(p.x + 18, p.y + 26);
      }
    } else if (d.mode === "chill" && this.rng.chance(dt * 0.05)) this.ambient(m);
  }

  exitMove(m, speed, done) {
    super.exitMove(m, speed, done);
  }
}

// ===========================================================================
export class CouchActivity extends Activity {
  enter(m) {
    travel(this.engine, m.actor, m.spot, { direct: true, speed: 72, onArrive: () => this.enterDone(m) });
  }

  onPerform(m) {
    const a = m.actor;
    a.setPose("sit");
    a.facing = m.index % 2 ? -1 : 1;
    m.data.nextLook = this.rng.range(2, 6);
    m.data.look = 0;
    let t = 0;
    a.fxHook = (actor, dt) => {
      t += dt || 1 / 30;
      if (t < 0.3) actor.fx.sink *= t / 0.3; // settle into the seat
    };
  }

  perform(m, dt) {
    const d = m.data;
    const a = m.actor;
    if (d.look > 0) {
      d.look -= dt;
      if (d.look <= 0) {
        a.lookView = null;
        a.setPose("sit");
      }
    } else if (m.t > d.nextLook) {
      d.nextLook = m.t + this.rng.range(3, 8);
      d.look = this.rng.range(1, 2.2);
      const r = this.rng.next();
      if (r < 0.4) a.lookView = this.rng.pick(["frontLeft", "frontRight"]);
      else if (r < 0.7) a.setPose("sitTalk");
      else if (this.rng.chance(0.5)) this.ambient(m);
    }
  }
}

// ===========================================================================
export class ChessActivity extends Activity {
  onPerform(m) {
    const a = m.actor;
    a.view = m.spot.view;
    a.facing = m.spot.face || 1;
    a.setPose("sitChess", { view: m.spot.view });
  }

  groupUpdate(dt) {
    const g = (this.game ||= { turn: 0, t: 0, dur: 3, moved: false });
    g.t += dt;
    const mover = this.members[g.turn % this.members.length];
    const other = this.members[(g.turn + 1) % this.members.length];
    if (!mover) return;
    const facesCamera = (m) => m.spot.view && m.spot.view.startsWith("front");
    if (!g.moved && g.t > g.dur * 0.65) {
      g.moved = true;
      if (facesCamera(mover)) mover.actor.setPose("sitMove", { facing: mover.spot.face });
      else {
        mover.actor.setPose("sitChess");
        mover.actor.fxHook = (a) => {
          a.fx.offX += 5;
          a.fx.offY -= 3;
        };
      }
      if (this.rng.chance(0.18)) this.engine.director.tryAmbient(mover.actor, "chess");
    }
    if (g.t > g.dur) {
      mover.actor.fxHook = null;
      mover.actor.setPose("sitChess");
      if (other && facesCamera(other)) other.actor.setPose("sitChess");
      g.turn++;
      g.t = 0;
      g.moved = false;
      g.dur = this.rng.range(...TIMING.CHESS_TURN);
      const thinker = this.members[(g.turn + 1) % this.members.length];
      if (thinker && facesCamera(thinker)) thinker.actor.setPose("sitThink", { facing: thinker.spot.face });
      else if (thinker) thinker.actor.lookView = this.rng.chance(0.5) ? "back" : null;
    }
  }

  onMemberLeft() {
    for (const m of this.members) {
      m.actor.fxHook = null;
      m.actor.setPose("sitChess");
    }
  }
}

// ===========================================================================
export class PingPongActivity extends Activity {
  constructor(engine, activity, assignment) {
    super(engine, activity, assignment);
    this.paddles = new Map();
    this.game = null;
  }

  onPerform(m) {
    const a = m.actor;
    a.facing = m.spot.face || 1;
    a.setPose("paddleReady");
    const paddle = this.engine.props.takePaddle();
    if (paddle) {
      paddle.attach(a);
      this.paddles.set(a, paddle);
    }
  }

  sides() {
    const L = this.members.filter((m) => (m.spot.face || 1) > 0);
    const R = this.members.filter((m) => (m.spot.face || 1) < 0);
    return { L, R };
  }

  hand(m) {
    const a = m.actor;
    return (
      a.anchorWorld("hand") ||
      a.anchorWorld(a.facing > 0 ? "handR" : "handL") || { x: a.x + 30 * a.facing, y: a.y - 110 }
    );
  }

  groupUpdate(dt) {
    const { L, R } = this.sides();
    if (!L.length || !R.length) return;
    const g = (this.game ||= { state: "between", t: 0.6, server: 0, hits: 0, rally: 4, sideHits: [0, 0], lastHitter: null });
    // swing timers
    for (const m of this.members) {
      if (m.data.swing > 0) {
        m.data.swing -= dt;
        if (m.data.swing <= 0) m.actor.setPose("paddleReady");
      }
    }
    if (g.state === "between") {
      g.t -= dt;
      if (g.t <= 0) {
        g.state = "rally";
        g.hits = 0;
        g.rally = this.rng.int(TIMING.PP_RALLY_MIN, TIMING.PP_RALLY_MAX);
        const side = g.server % 2 === 0 ? L : R;
        this.hit(side[g.sideHits[g.server % 2]++ % side.length], g);
      }
    }
  }

  hit(m, g) {
    const { L, R } = this.sides();
    const fromLeft = L.includes(m);
    const recvSide = fromLeft ? R : L;
    if (!recvSide.length) return;
    const ri = fromLeft ? 1 : 0;
    const recv = recvSide[g.sideHits[ri] % recvSide.length];
    m.data.swing = 0.3;
    m.actor.setPose("swing", { facing: m.spot.face || 1 });
    g.hits++;
    const P = OFFICE_PROPS.pingpong;
    const from = this.hand(m);
    const endX = fromLeft ? P.right.x : P.left.x;
    const bx = P.netX + (endX - P.netX) * this.rng.range(0.4, 0.75);
    const bounce = { x: bx, y: P.surfaceY + this.rng.range(-8, 12) };
    const to = this.hand(recv);
    const miss = g.hits >= g.rally;
    this.engine.props.ball.launch(from, bounce, to, TIMING.PP_FLIGHT, {
      miss,
      onArrive: () => {
        if (!this.members.includes(recv) || !this.members.includes(m)) return;
        if (miss) {
          // point to the hitter's side
          for (const w of fromLeft ? L : R) w.actor.setPose("cheer");
          for (const l of recvSide) l.actor.setPose(this.rng.chance(0.5) ? "recoil" : "defeated");
          for (const x of this.members) x.data.swing = 1.2;
          if (this.rng.chance(0.5)) this.engine.director.tryAmbient(m.actor, "pingpong");
          g.state = "between";
          g.t = TIMING.PP_BETWEEN_POINTS;
          g.server++;
        } else {
          g.sideHits[ri]++;
          this.hit(recv, g);
        }
      },
    });
  }

  releaseProps(m) {
    const p = this.paddles.get(m.actor);
    if (p) {
      p.detach();
      this.engine.props.returnPaddle(p);
      this.paddles.delete(m.actor);
    }
    this.engine.props.ball.drop();
    this.game = null;
  }

  onMemberLeft() {
    this.game = null;
    for (const m of this.members) m.actor.setPose("paddleReady");
  }

  finish() {
    super.finish();
    this.engine.props.ball.drop();
  }
}

// ===========================================================================
export const ACTIVITY_CLASSES = {
  computer: ComputerActivity,
  pullup: PullupActivity,
  bag: BagActivity,
  weights: WeightsActivity,
  beanbag: BeanbagActivity,
  couch: CouchActivity,
  chess: ChessActivity,
  pingpong1v1: PingPongActivity,
  pingpong2v2: PingPongActivity,
};
