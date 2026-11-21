// ============================================================================
// THE OFFICE: speech bubbles. Unscaled overlay (screen px) positioned from
// world coords x scale, so text stays legible on a 390 px phone. Text is
// passed through tx() (Braille mode) and written with textContent only.
// The full line is laid out up-front (the unrevealed tail is transparent)
// so the typewriter never makes the bubble grow or jump.
// ============================================================================
import { TIMING, bubbleLifetimeMs } from "./timing";

export class Bubbles {
  /** @param {any} engine @param {HTMLElement} overlay */
  constructor(engine, overlay) {
    this.engine = engine;
    this.overlay = overlay;
    /** @type {Map<string, any>} actorId -> bubble */
    this.byActor = new Map();
  }

  /**
   * @param {any} actor
   * @param {string} text raw line (tx() applied here)
   * @param {{ heat?: number, ms?: number, kind?: 'argue' | 'ambient' | 'verdict' | 'rep' | 'panic' }} [opts]
   */
  say(actor, text, opts = {}) {
    const engine = this.engine;
    let b = this.byActor.get(actor.id);
    if (!b) {
      const el = document.createElement("div");
      el.className = "office-bubble";
      const inner = document.createElement("div");
      inner.className = "office-bubble__inner";
      const name = document.createElement("span");
      name.className = "office-bubble__name";
      const on = document.createElement("span");
      on.className = "office-bubble__on";
      const off = document.createElement("span");
      off.className = "office-bubble__off";
      inner.append(name, on, off);
      el.appendChild(inner);
      this.overlay.appendChild(el);
      b = { el, inner, name, on, off, cache: {}, actor };
      this.byActor.set(actor.id, b);
    }
    const kind = opts.kind || "argue";
    const reduced = engine.reducedMotion;
    b.source = text;
    b.t = 0;
    b.life = (opts.ms ?? bubbleLifetimeMs(text)) / 1000;
    b.kind = kind;
    b.alive = true;
    b.el.dataset.kind = kind;
    b.el.dataset.heat = String(Math.max(0, Math.min(TIMING.HEAT_STEPS, opts.heat || 0)));
    b.el.classList.toggle("office-bubble--still", reduced);
    b.name.style.color = actor.char.accent;
    this.updateText(b);
    engine.caption(actor.name, text);
    b.el.style.opacity = "1";
    b.el.classList.remove("office-bubble--pop");
    // restart the pop-in animation
    void b.el.offsetWidth;
    b.el.classList.add("office-bubble--pop");
    return b;
  }

  updateText(b) {
    const { tx, reducedMotion } = this.engine;
    b.text = tx(b.source);
    b.revealed = reducedMotion || b.kind === "rep" ? b.text.length : Math.min(b.text.length, Math.floor(b.t * TIMING.TYPE_CPS));
    b.name.textContent = b.kind === "argue" || b.kind === "verdict" ? `${tx(b.actor.name.toUpperCase())}: ` : "";
    b.on.textContent = b.text.slice(0, b.revealed);
    b.off.textContent = b.text.slice(b.revealed);
    b.width = b.el.offsetWidth;
    b.height = b.el.offsetHeight;
  }

  refreshText() {
    for (const b of this.byActor.values()) if (b.alive) this.updateText(b);
  }

  clear(actor) {
    const b = this.byActor.get(actor.id);
    if (b) {
      b.alive = false;
      b.el.style.opacity = "0";
    }
  }

  clearAll() {
    for (const b of this.byActor.values()) {
      b.alive = false;
      b.el.style.opacity = "0";
    }
  }

  count(kind = null) {
    let n = 0;
    for (const b of this.byActor.values()) if (b.alive && (!kind || b.kind === kind)) n++;
    return n;
  }

  step(dt) {
    for (const b of this.byActor.values()) {
      if (!b.alive) continue;
      b.t += dt;
      if (b.revealed < b.text.length) {
        const n = Math.min(b.text.length, Math.floor(b.t * TIMING.TYPE_CPS));
        if (n !== b.revealed) {
          b.revealed = n;
          b.on.textContent = b.text.slice(0, n);
          b.off.textContent = b.text.slice(n);
        }
      }
      if (b.t >= b.life) {
        b.alive = false;
        b.el.style.opacity = "0";
      }
    }
  }

  /** @param {number} alpha interpolation @param {number} s world->screen scale @param {number} sceneW */
  render(alpha, s, sceneW) {
    for (const b of this.byActor.values()) {
      if (!b.alive) continue;
      const p = b.actor.bubbleAnchor(alpha);
      const half = (b.width || 120) / 2;
      const x = Math.max(half + 4, Math.min(sceneW - half - 4, p.x * s));
      const y = Math.max(b.height + 4, p.y * s);
      const tail = Math.max(-half + 12, Math.min(half - 12, p.x * s - x));
      const t = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
      if (b.cache.t !== t) {
        b.el.style.transform = t;
        b.cache.t = t;
      }
      const tl = `${tail.toFixed(0)}px`;
      if (b.cache.tail !== tl) {
        b.el.style.setProperty("--tail", tl);
        b.cache.tail = tl;
      }
    }
  }

  destroy() {
    for (const b of this.byActor.values()) b.el.remove();
    this.byActor.clear();
  }
}
