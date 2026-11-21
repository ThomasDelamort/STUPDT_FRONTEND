// ============================================================================
// THE OFFICE: director. A hybrid planner:
//  1. weighted cast scenes (15-35 s, never back-to-back, staggered departures)
//  2. solo stations re-roll inside a scene every 8-20 s
//  3. least-recently-seen coverage bias (all nine activities within ~5 min)
//  4. light per-character affinities
// plus the global override chain for a user prompt:
//  STARTLE -> GO_TO_HUDDLE -> ARGUE -> VERDICT -> DISPERSE -> (scenes resume)
// and the Code Red stretch (Grand Finale modal).
// ============================================================================
import { TIMING, bubbleLifetimeMs } from "./timing";
import { Rng } from "./rng";
import { ACTIVITY_CLASSES, travel, cancelTravel } from "./activities";
import { viewForVector } from "./actor";
import {
  OFFICE_SCENES,
  OFFICE_GROUPS,
  OFFICE_SPOTS,
  OFFICE_SOLO,
  OFFICE_ACTIVITIES,
  OFFICE_ACTIVITY_AFFINITY,
  OFFICE_HUDDLE,
  OFFICE_WANDER,
} from "../../constants/office";

/** All permutations of an array (n <= 5 here). */
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

export class Director {
  /** @param {any} engine */
  constructor(engine) {
    this.engine = engine;
    this.rng = engine.rng;
    this.mode = "idle"; // idle | huddle | verdict | disperse | codeRed
    /** @type {any} */ this.scene = null;
    this.sceneIndex = -1;
    this.sceneT = 0;
    this.sceneDur = 20;
    /** @type {any[]} */ this.activities = [];
    /** @type {Record<string, number>} */ this.lastSeen = {};
    /** @type {Map<string, number>} */ this.rerollAt = new Map();
    this.ambientCooldown = 3;
    this.huddle = null;
    this.forced = -1;
  }

  // ------------------------------------------------------------------------
  // Scenes
  // ------------------------------------------------------------------------
  init() {
    // open on a busy scene (3+ activities, short) so the first minute shows
    // plenty of variety
    const busy = OFFICE_SCENES.filter((sc) => sc.groups.length >= 3);
    const first = this.rng.weighted(busy.length ? busy : OFFICE_SCENES, (sc) => sc.weight);
    this.startScene(first, { instant: true });
    this.sceneDur = this.rng.range(13, 18);
  }

  markSeen(activity) {
    this.lastSeen[activity] = this.engine.time;
    this.engine.debugStats.seen[activity] = (this.engine.debugStats.seen[activity] || 0) + 1;
  }

  staleness(activity) {
    const seen = this.lastSeen[activity];
    if (seen === undefined) return 1.6;
    return Math.min(1.2, (this.engine.time - seen) / TIMING.COVERAGE_WINDOW);
  }

  sceneActivities(scene) {
    return scene.groups.map((g) => OFFICE_GROUPS[g].activity);
  }

  pickScene() {
    const n = this.engine.actors.length;
    const candidates = OFFICE_SCENES.filter((s, i) => {
      if (i === this.sceneIndex) return false; // never back-to-back
      const need = s.groups.reduce((sum, g) => sum + OFFICE_GROUPS[g].spots.length, 0);
      return need <= n;
    });
    const pool = candidates.length ? candidates : OFFICE_SCENES;
    // summed (not averaged) staleness: a scene that shows two unseen
    // activities beats one that shows a single unseen activity
    return this.rng.weighted(pool, (s) => {
      const acts = this.sceneActivities(s);
      const stale = acts.reduce((sum, a) => sum + this.staleness(a) ** 2, 0);
      return s.weight * (0.25 + stale * 1.5);
    });
  }

  /** Best actor -> spot assignment: affinity + proximity + a little noise. */
  assign(scene) {
    const actors = this.engine.actors;
    /** @type {{group: string, activity: string, spotId: string}[]} */
    const slots = [];
    for (const g of scene.groups) {
      const def = OFFICE_GROUPS[g];
      for (const spotId of def.spots) slots.push({ group: g, activity: def.activity, spotId });
    }
    const usable = slots.slice(0, actors.length);
    const idx = actors.map((_, i) => i);
    let best = null;
    let bestScore = -Infinity;
    const jitter = actors.map(() => usable.map(() => this.rng.range(0, 0.8)));
    for (const perm of permutations(idx).slice(0, 720)) {
      let score = 0;
      usable.forEach((slot, si) => {
        const a = actors[perm[si]];
        const aff = a.char.affinity[OFFICE_ACTIVITY_AFFINITY[slot.activity]] || 0;
        const spot = OFFICE_SPOTS[slot.spotId];
        score += aff * 1.2 - Math.hypot(a.x - spot.x, a.y - spot.y) / 500 + jitter[perm[si]][si];
      });
      if (score > bestScore) {
        bestScore = score;
        best = perm;
      }
    }
    const result = new Map();
    usable.forEach((slot, si) => result.set(actors[best[si]], slot));
    return result;
  }

  startScene(scene, { instant = false } = {}) {
    this.scene = scene;
    this.sceneIndex = OFFICE_SCENES.indexOf(scene);
    this.sceneT = 0;
    this.sceneDur = this.rng.range(TIMING.SCENE_MIN, TIMING.SCENE_MAX);
    // whole-cast scenes (couch summit, 2v2) are a set piece: keep them short
    if (scene.groups.length === 1) this.sceneDur = this.rng.range(TIMING.SCENE_MIN, 22);
    const plan = this.assign(scene);
    /** @type {Map<string, {actor: any, spotId: string}[]>} */
    const byGroup = new Map();
    for (const [actor, slot] of plan) {
      if (!byGroup.has(slot.group)) byGroup.set(slot.group, []);
      byGroup.get(slot.group).push({ actor, spotId: slot.spotId });
    }
    // release everyone who is changing station
    for (const actor of this.engine.actors) {
      const slot = plan.get(actor);
      const cur = actor.activity;
      const same =
        cur &&
        slot &&
        cur.activity === slot.activity &&
        actor.member &&
        actor.member.spotId === slot.spotId;
      if (same) {
        // stays put: carry the member over into the new scene's activity list
        continue;
      }
      // staggered stand-ups so a full couch doesn't rise as one block
      if (cur) cur.release(actor, { delay: instant ? 0 : this.rng.range(0, 1.4) });
    }
    // build new activities (reuse ones that kept all their members)
    const next = [];
    for (const [group, members] of byGroup) {
      const activity = OFFICE_GROUPS[group].activity;
      const existing = this.activities.find(
        (a) =>
          !a.finished &&
          a.activity === activity &&
          members.every((m) => a.members.some((x) => x.actor === m.actor && x.spotId === m.spotId)),
      );
      if (existing) {
        next.push(existing);
        continue;
      }
      // partial overlap with an existing group activity: release the rest
      for (const m of members) if (m.actor.activity) m.actor.activity.release(m.actor, {});
      const Cls = ACTIVITY_CLASSES[activity];
      const act = new Cls(this.engine, activity, members);
      if (instant) act.beginInPlace();
      else act.begin(true);
      next.push(act);
    }
    // idle extras (more actors than spots) wander
    for (const actor of this.engine.actors) {
      if (!plan.has(actor)) this.wander(actor);
    }
    for (const a of this.activities) if (!next.includes(a)) a.finished = true;
    this.activities = next;
    this.rerollAt.clear();
    for (const [actor, slot] of plan) {
      if (OFFICE_SOLO.includes(slot.activity)) {
        this.rerollAt.set(actor.id, this.rng.range(TIMING.SOLO_REROLL_MIN, TIMING.SOLO_REROLL_MAX));
      }
    }
    this.engine.debugStats.scene = scene.label;
  }

  /** Swap a solo actor to another free solo station (inside the scene). */
  rerollSolo(actor) {
    const cur = actor.activity;
    if (!cur || cur.members.length !== 1 || !OFFICE_SOLO.includes(cur.activity)) return;
    const used = new Set(this.activities.filter((a) => !a.finished).map((a) => a.activity));
    const free = OFFICE_SOLO.filter((a) => !used.has(a));
    if (!free.length) return;
    const pick = this.rng.weighted(
      free,
      (a) =>
        0.3 + this.staleness(a) + (actor.char.affinity[OFFICE_ACTIVITY_AFFINITY[a]] || 0) * 0.3,
    );
    const group = OFFICE_GROUPS[pick];
    cur.release(actor, {});
    const Cls = ACTIVITY_CLASSES[pick];
    const act = new Cls(this.engine, pick, [{ actor, spotId: group.spots[0] }]);
    act.begin(false);
    this.activities = this.activities.filter((a) => a !== cur);
    this.activities.push(act);
  }

  wander(actor) {
    const p = this.rng.pick(OFFICE_WANDER);
    actor.state = "wander";
    travel(this.engine, actor, p, {
      onArrive: () => {
        actor.setPose("stand", { view: null });
        actor.wanderAt = this.engine.time + this.rng.range(4, 9);
      },
    });
  }

  /** Rare, short, never-overlapping ambient bubbles (idle only). */
  tryAmbient(actor, activity) {
    if (this.mode !== "idle" || this.ambientCooldown > 0 || this.engine.bubbles.count() > 0) return;
    this.ambientCooldown = TIMING.AMBIENT_MIN_GAP + this.rng.range(0, 3);
    this.engine.bubbles.say(actor, this.engine.dialogue.ambient(activity), {
      kind: "ambient",
      ms: TIMING.AMBIENT_MS,
    });
  }

  // ------------------------------------------------------------------------
  update(dt) {
    this.ambientCooldown -= dt;
    if (this.mode === "idle") {
      this.sceneT += dt;
      if (this.forced >= 0) {
        const s = OFFICE_SCENES[this.forced];
        this.forced = -1;
        if (s) {
          this.startScene(s);
          this.sceneDur = 60; // debug-forced scenes hold for a minute
        }
      } else if (this.sceneT > this.sceneDur) this.startScene(this.pickScene());
      // solo re-rolls
      for (const [id, at] of this.rerollAt) {
        const left = at - dt;
        this.rerollAt.set(id, left);
        if (left <= 0) {
          const actor = this.engine.actors.find((a) => a.id === id);
          this.rerollAt.set(id, this.rng.range(TIMING.SOLO_REROLL_MIN, TIMING.SOLO_REROLL_MAX));
          if (actor && actor.state === "perform" && this.sceneT < this.sceneDur - 6)
            this.rerollSolo(actor);
        }
      }
      // micro-life for wanderers / waiting actors
      for (const a of this.engine.actors) {
        if (a.state === "wander" && !a.moving && a.wanderAt && this.engine.time > a.wanderAt)
          this.wander(a);
        if ((a.state === "wander" || a.state === "wait") && !a.moving) this.lookAround(a, dt);
      }
      if (this.ambientCooldown <= 0 && this.rng.chance(dt * 0.08)) {
        const performers = this.engine.actors.filter((a) => a.state === "perform" && a.activity);
        if (performers.length && this.rng.chance(TIMING.AMBIENT_CHANCE)) {
          const a = this.rng.pick(performers);
          this.tryAmbient(a, a.activity.activity);
        }
      }
    }
    for (const a of this.activities) if (!a.finished) a.update(dt);
    this.activities = this.activities.filter((a) => !a.finished);
    if (this.huddle) this.huddle.update(dt);
  }

  lookAround(a, dt) {
    a.lookTimer =
      (a.lookTimer ?? this.rng.range(TIMING.LOOKAROUND_MIN, TIMING.LOOKAROUND_MAX)) - dt;
    if (a.lookTimer <= 0) {
      a.lookTimer = this.rng.range(TIMING.LOOKAROUND_MIN, TIMING.LOOKAROUND_MAX);
      const r = this.rng.next();
      if (r < 0.45) a.lookView = this.rng.pick(["frontLeft", "frontRight", "left", "right"]);
      else if (r < 0.6) a.setPose("stretch");
      else {
        a.lookView = null;
        a.setPose("stand");
      }
    }
  }

  forceScene(i) {
    if (this.mode !== "idle") return;
    this.forced = i;
  }

  // ------------------------------------------------------------------------
  // Prompt / reply / Code Red
  // ------------------------------------------------------------------------
  /** Release every actor from stations immediately (props let go). */
  interruptAll({ urgent = true } = {}) {
    for (const a of this.engine.actors) {
      if (a.activity) a.activity.release(a, { urgent });
      else if (!a.exiting) cancelTravel(a); // let a stand-up in progress finish
      a.state = "startle";
    }
    for (const act of this.activities) act.finished = true;
    this.activities = [];
    this.rerollAt.clear();
  }

  onPrompt(prompt) {
    if (this.mode === "codeRed") {
      this.pendingPrompt = prompt;
      return;
    }
    if (this.huddle && this.mode === "huddle") {
      this.huddle.another(prompt);
      return;
    }
    this.mode = "huddle";
    this.engine.setStatus("huddle");
    this.huddle = new Huddle(this, prompt);
    this.huddle.start();
  }

  onReply(info) {
    if (this.huddle) this.huddle.reply(info);
  }

  /** @param {boolean} on */
  codeRed(on) {
    if (on) {
      if (this.mode === "codeRed") return;
      this.preRedMode = this.mode;
      this.mode = "codeRed";
      this.engine.setStatus("codeRed");
      this.engine.bubbles.clearAll();
      if (this.huddle) this.huddle.pause();
      this.interruptAll();
      this.panic = new Panic(this);
      this.panic.start();
      return;
    }
    if (this.mode !== "codeRed") return;
    if (this.panic) this.panic.stop();
    this.panic = null;
    if (this.huddle && !this.huddle.done) {
      this.mode = "huddle";
      this.engine.setStatus("huddle");
      this.huddle.resume();
      if (this.pendingPrompt) this.huddle.another(this.pendingPrompt);
    } else if (this.pendingPrompt) {
      this.mode = "idle";
      this.onPrompt(this.pendingPrompt);
    } else this.resumeScenes();
    this.pendingPrompt = null;
  }

  resumeScenes() {
    this.mode = "idle";
    this.huddle = null;
    this.engine.setStatus("idle");
    this.engine.props.tickets.clearPile();
    this.startScene(this.pickScene());
  }

  destroy() {
    this.activities = [];
    this.huddle = null;
    this.panic = null;
  }
}

// ===========================================================================
// The huddle & argument
// ===========================================================================
class Huddle {
  /** @param {Director} director @param {{id: string, text: string, dept: string}} prompt */
  constructor(director, prompt) {
    this.d = director;
    this.engine = director.engine;
    this.prompt = prompt;
    this.rng = new Rng((Date.now() ^ 0x5bd1e995) >>> 0);
    this.ticketNo = this.engine.ticketCounter = (this.engine.ticketCounter || 0) + 1;
    this.t = 0;
    this.phase = "startle";
    this.done = false;
    this.replied = false;
    this.replyDept = "";
    this.beatIndex = 0;
    this.nextBeatAt = Infinity;
    this.currentBeat = null;
    this.beatEndsAt = 0;
    this.gestureUntil = new Map();
    this.slots = new Map();
    this.arrived = new Set();
    this.paused = false;
    this.verdictAt = 0;
    this.stalls = 0;
  }

  get actors() {
    return this.engine.actors;
  }

  actor(id) {
    return this.actors.find((a) => a.id === id) || this.actors[0];
  }

  start() {
    const e = this.engine;
    e.dialogue.beginPrompt();
    this.plan = e.dialogue.buildPlan(this.prompt.text, {
      dept: this.prompt.dept,
      ticketNo: this.ticketNo,
    });
    e.props.tickets.addToPile(this.ticketNo);
    e.debugStats.arc = this.plan.title;
    e.bubbles.clearAll();
    this.d.interruptAll({ urgent: true });
    // 0-200 ms staggered startle: stop, "!" pop, crouch, tiny hop
    this.actors.forEach((a) => {
      const delay = this.rng.range(0, TIMING.STARTLE_STAGGER_MS) / 1000;
      a.startleAt = delay;
      a.startled = false;
    });
    this.phase = "startle";
    this.t = 0;
    this.firstBubbleAt = TIMING.STARTLE_MS / 1000 + TIMING.FIRST_BUBBLE_DELAY;
  }

  startleActor(a) {
    a.startled = true;
    if (!a.exiting) cancelTravel(a); // never cancel a stand-up in progress
    a.setMark("!", 1.1);
    if (!a.exiting) {
      a.setPose("startle");
      if (!this.engine.reducedMotion) {
        let t = 0;
        a.fxHook = (actor, dt) => {
          t += dt || 1 / 30;
          if (t < 0.3) actor.fx.lift += Math.sin((t / 0.3) * Math.PI) * 9;
        };
      }
    }
    this.engine.debugStats.lastStartle = this.engine.time;
  }

  assignSlots() {
    const H = OFFICE_HUDDLE;
    const slots = H.slots.slice(0, Math.max(this.actors.length, 4)).map((deg) => {
      const r = (deg * Math.PI) / 180;
      return { x: H.x + Math.cos(r) * H.rx, y: H.y + Math.sin(r) * H.ry };
    });
    // nearest slot first, no two actors share one
    const pairs = [];
    this.actors.forEach((a) =>
      slots.forEach((s, si) => pairs.push({ a, si, d: Math.hypot(a.x - s.x, a.y - s.y) })),
    );
    pairs.sort((p, q) => p.d - q.d);
    const usedA = new Set();
    const usedS = new Set();
    for (const p of pairs) {
      if (usedA.has(p.a) || usedS.has(p.si)) continue;
      usedA.add(p.a);
      usedS.add(p.si);
      this.slots.set(p.a, slots[p.si]);
    }
  }

  goToHuddle() {
    this.phase = "gather";
    this.assignSlots();
    for (const a of this.actors) this.sendToSlot(a);
  }

  sendToSlot(a) {
    const slot = this.slots.get(a);
    a.fxHook = null;
    a.state = "go_to_huddle";
    const go = () => {
      a.zOverride = null;
      a.setPose("stand");
      travel(this.engine, a, slot, {
        mode: "run",
        onArrive: () => {
          this.arrived.add(a);
          a.state = "argue";
          this.faceCentre(a);
          a.setPose("stand");
        },
      });
    };
    // standing up is driven by the sim clock: join the run once it's done
    if (a.exiting) a.afterExit = go;
    else go();
  }

  faceCentre(a) {
    const H = OFFICE_HUDDLE;
    a.facing = H.x >= a.x ? 1 : -1;
    a.view = viewForVector(H.x - a.x, H.y - a.y);
  }

  faceTo(a, b) {
    a.facing = b.x >= a.x ? 1 : -1;
    a.view = viewForVector(b.x - a.x, b.y - a.y);
  }

  update(dt) {
    if (this.paused || this.done) return;
    this.t += dt;
    const e = this.engine;

    if (this.phase === "startle") {
      for (const a of this.actors) if (!a.startled && this.t >= a.startleAt) this.startleActor(a);
      if (this.t >= TIMING.STARTLE_MS / 1000) this.goToHuddle();
    }
    // actors that finished standing up join the run
    for (const a of this.actors) {
      if (a.afterExit && !a.exiting) {
        const go = a.afterExit;
        a.afterExit = null;
        go();
      }
    }

    if (this.phase === "gather" || this.phase === "argue") {
      if (this.t >= this.firstBubbleAt && !this.alarmed) {
        this.alarmed = true;
        this.say(e.dialogue.alarmBeat(this.rng), { short: true });
        this.phase = "argue";
        this.nextBeatAt = this.t + bubbleLifetimeMs("x".repeat(12)) / 1000;
      }
    }

    if (this.phase === "argue" && this.t >= this.nextBeatAt) this.nextBeat();
    if (this.phase === "verdict" && this.t >= this.verdictAt) this.disperse();

    // revert expired gestures, keep listeners facing the speaker
    for (const a of this.actors) {
      const until = this.gestureUntil.get(a);
      if (until !== undefined && this.t >= until) {
        this.gestureUntil.delete(a);
        a.mark = a.mark === "?!" ? null : a.mark;
        if (this.arrived.has(a)) {
          this.faceCentre(a);
          a.setPose("stand");
        }
      }
      if (this.arrived.has(a) && !this.gestureUntil.has(a) && this.currentBeat && !a.moving) {
        const sp = this.actor(this.currentBeat.speaker);
        if (sp !== a) this.faceTo(a, sp);
      }
    }
  }

  /** Speak a beat: bubble + gesture + caption + blip (+ ticket throw). */
  say(beat, { short = false } = {}) {
    const e = this.engine;
    const sp = this.actor(beat.speaker);
    const ms = bubbleLifetimeMs(beat.text);
    e.bubbles.say(sp, beat.text, { heat: beat.heat, kind: beat.kind || "argue", ms });
    e.caption(sp.name, beat.text);
    e.blip(sp);
    this.currentBeat = beat;
    this.beatEndsAt = this.t + ms / 1000;
    if (!short) this.gesture(sp, beat.gesture, beat.at ? this.actor(beat.at) : null, ms / 1000);
    if (beat.ticket) {
      const to = this.actor(beat.ticket);
      const from = sp.anchorWorld("hand") || { x: sp.x, y: sp.y - 100 };
      const target = { x: to.x, y: to.y - to.headHeight * 0.55 };
      e.props.tickets.throw(from, target, this.ticketNo);
      if (this.arrived.has(to)) this.gesture(to, "recoil", sp, 0.9);
    } else if (beat.at && this.rng.chance(0.45)) {
      const target = this.actor(beat.at);
      if (this.arrived.has(target)) this.gesture(target, "recoil", sp, 0.8);
    }
  }

  gesture(a, gesture, target, seconds) {
    if (!this.arrived.has(a) || a.moving) return;
    if (target) this.faceTo(a, target);
    else this.faceCentre(a);
    if (gesture === "huff") {
      // turn their back in a huff
      const H = OFFICE_HUDDLE;
      a.view = viewForVector(a.x - H.x, a.y - H.y);
      a.setPose("huff", { view: a.view });
    } else if (gesture === "exasperated") {
      a.setPose("exasperated");
      a.setMark("?!", seconds);
    } else a.setPose(gesture === "startle" ? "startle" : gesture);
    this.gestureUntil.set(a, this.t + Math.min(seconds, 2.6));
  }

  nextBeat() {
    const e = this.engine;
    const plan = this.plan;
    // verdict once the reply is in and the arc reached its punchline
    if (
      this.replied &&
      this.beatIndex >= Math.min(TIMING.VERDICT_MIN_BEATS, plan.beats.length) &&
      this.gatheredEnough()
    ) {
      this.verdict();
      return;
    }
    let beat;
    if (this.beatIndex < plan.beats.length) {
      beat = plan.beats[this.beatIndex++];
    } else {
      if (this.replied) {
        this.verdict();
        return;
      }
      if (this.t > TIMING.REPLY_TIMEOUT) {
        this.replyDept = "the Feedback Department";
        this.replied = true;
        this.verdict();
        return;
      }
      beat = e.dialogue.stallBeat(this.rng, 2);
      this.stalls++;
    }
    this.say(beat);
    const len = bubbleLifetimeMs(beat.text);
    // short interruptions once things heat up (max 2 bubbles, <= 700 ms)
    const next = plan.beats[this.beatIndex];
    const overlap = beat.heat >= 1 && next && next.speaker !== beat.speaker && this.rng.chance(0.6);
    this.nextBeatAt =
      this.t + (len + TIMING.BEAT_GAP_MS - (overlap ? TIMING.OVERLAP_MS : 0)) / 1000;
  }

  gatheredEnough() {
    return this.arrived.size >= Math.min(this.actors.length, 3);
  }

  reply(info) {
    this.replied = true;
    this.replyDept = info.deptName || "the Feedback Department";
    this.engine.debugStats.replyAt = this.t;
  }

  /** Second prompt mid-argument: "Another one?!", the pile grows, new topic. */
  another(prompt) {
    const e = this.engine;
    if (this.phase === "verdict") {
      // already wrapping up: start a fresh huddle in place
      this.prompt = prompt;
      this.ticketNo = e.ticketCounter = (e.ticketCounter || 0) + 1;
      e.props.tickets.addToPile(this.ticketNo);
      e.dialogue.beginPrompt();
      this.plan = e.dialogue.buildPlan(prompt.text, { dept: prompt.dept, ticketNo: this.ticketNo });
      this.phase = "argue";
      this.replied = false;
      this.beatIndex = 0;
      this.say(e.dialogue.anotherBeat(this.rng, this.ticketNo));
      this.nextBeatAt = this.t + 2;
      e.setStatus("huddle");
      e.debugStats.arc = this.plan.title;
      return;
    }
    this.prompt = prompt;
    this.ticketNo = e.ticketCounter = (e.ticketCounter || 0) + 1;
    e.props.tickets.addToPile(this.ticketNo);
    e.dialogue.beginPrompt();
    this.plan = e.dialogue.buildPlan(prompt.text, { dept: prompt.dept, ticketNo: this.ticketNo });
    this.replied = false;
    this.beatIndex = 0;
    e.debugStats.arc = this.plan.title;
    if (this.phase === "startle" || this.phase === "gather") {
      this.alarmed = true;
      this.phase = this.phase === "startle" ? "startle" : "argue";
    }
    const beat = e.dialogue.anotherBeat(this.rng, this.ticketNo);
    e.bubbles.clearAll();
    this.say(beat);
    this.phase = this.phase === "startle" ? "startle" : "argue";
    this.nextBeatAt = this.t + bubbleLifetimeMs(beat.text) / 1000 + 0.15;
  }

  verdict() {
    const e = this.engine;
    this.phase = "verdict";
    const beat = e.dialogue.verdictBeat(this.rng, this.replyDept);
    if (this.actors.some((a) => a.id === "neal")) beat.speaker = "neal";
    e.bubbles.clearAll();
    this.say({ ...beat, kind: "verdict" });
    // everyone does their signature emote / cheer
    for (const a of this.actors) {
      if (a.id === beat.speaker) continue;
      if (this.arrived.has(a))
        this.gesture(a, this.rng.chance(0.6) ? "emote" : "cheer", null, TIMING.VERDICT_MS / 1000);
    }
    this.verdictAt = this.t + (TIMING.VERDICT_MS + TIMING.DISPERSE_DELAY_MS) / 1000;
  }

  disperse() {
    this.done = true;
    this.phase = "done";
    for (const a of this.actors) {
      a.mark = null;
      a.fxHook = null;
    }
    this.engine.caption(null, null);
    this.d.resumeScenes();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    // run back to the huddle slots
    this.arrived.clear();
    this.assignSlots();
    for (const a of this.actors) this.sendToSlot(a);
    if (this.phase === "startle") this.phase = "gather";
    this.nextBeatAt = this.t + 1.2;
    if (this.phase === "verdict") this.verdictAt = this.t + 2;
  }
}

// ===========================================================================
// Code Red: scatter in panic, run in circles, regroup when the modal closes
// ===========================================================================
class Panic {
  constructor(director) {
    this.d = director;
    this.engine = director.engine;
    this.rng = new Rng((Date.now() ^ 0xc0de) >>> 0);
    this.t = 0;
    this.timer = 0;
  }

  start() {
    for (const a of this.engine.actors) {
      a.setPose("recoil");
      a.setMark("!!", 1.4);
      a.state = "panic";
      a.panicAt = this.rng.range(0.4, 0.9);
      a.panicCentre = this.engine.nav.nearestWalkable({ x: a.x, y: a.y });
    }
    this.engine.panicTicker = (dt) => this.update(dt);
  }

  update(dt) {
    this.t += dt;
    this.timer -= dt;
    for (const a of this.engine.actors) {
      if (a.moving || a.exiting) continue;
      a.zOverride = null;
      a.panicAt -= dt;
      if (a.panicAt > 0) continue;
      if (this.rng.chance(0.3)) {
        a.setPose("recoil");
        a.panicAt = this.rng.range(0.4, 0.8);
        continue;
      }
      // a lap around a small circle of walkable points
      const c = a.panicCentre;
      const r = this.rng.range(40, 80);
      const ang = this.rng.range(0, Math.PI * 2);
      const pts = [];
      for (let i = 1; i <= 6; i++) {
        const t = ang + (i / 6) * Math.PI * 2;
        const p = { x: c.x + Math.cos(t) * r, y: c.y + Math.sin(t) * r * 0.5 };
        if (this.engine.nav.walkableAt(p.x, p.y)) pts.push(p);
      }
      if (pts.length) {
        const p = pts[this.rng.int(0, pts.length - 1)];
        travel(this.engine, a, p, {
          mode: "run",
          onArrive: () => (a.panicAt = this.rng.range(0.05, 0.4)),
        });
      } else a.panicAt = 0.5;
    }
    if (this.timer <= 0 && this.engine.bubbles.count() === 0) {
      this.timer = this.rng.range(1.2, 2.2);
      const a = this.rng.pick(this.engine.actors);
      this.engine.bubbles.say(a, this.engine.dialogue.panicLine(this.rng), {
        kind: "panic",
        heat: 3,
        ms: 1300,
      });
    }
  }

  stop() {
    this.engine.panicTicker = null;
    for (const a of this.engine.actors) {
      cancelTravel(a);
      a.mark = null;
      a.setPose("stand");
      a.state = "idle";
    }
    this.engine.bubbles.clearAll();
  }
}

export { OFFICE_ACTIVITIES };
