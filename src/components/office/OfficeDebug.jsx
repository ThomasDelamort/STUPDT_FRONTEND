import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  OFFICE_NAV,
  OFFICE_OCCLUDERS,
  OFFICE_SPOTS,
  OFFICE_HUDDLE,
  OFFICE_WANDER,
  OFFICE_WORLD,
  OFFICE_ACTIVITIES,
  OFFICE_ACTIVITY_LABELS,
  OFFICE_SCENES,
  OFFICE_POSES,
} from "../../constants/office";

const pts = (poly) => poly.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * World-space QA overlay: walk polygon, obstacles, occluders (+ sortY),
 * station anchors / approach points, huddle ellipse, planned paths,
 * sprite pivots and current states. Shown with ?office-debug (or ` in dev).
 */
export function OfficeDebugWorld({ snapshot }) {
  const actors = snapshot?.actors || [];
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={OFFICE_WORLD.w}
      height={OFFICE_WORLD.h}
      viewBox={`0 0 ${OFFICE_WORLD.w} ${OFFICE_WORLD.h}`}
      style={{ zIndex: 3000 }}
    >
      <polygon points={pts(OFFICE_NAV.walk)} fill="rgba(31,224,63,0.08)" stroke="#1FE03F" strokeWidth="2" />
      {OFFICE_NAV.obstacles.map((o) => (
        <polygon key={o.id} points={pts(o.poly)} fill="rgba(245,40,32,0.18)" stroke="#F52820" strokeWidth="1.5" />
      ))}
      {OFFICE_OCCLUDERS.map((o) => (
        <g key={o.id}>
          <polygon points={pts(o.poly)} fill="none" stroke="#0EC7F5" strokeWidth="2" strokeDasharray="6 4" />
          <line x1={o.poly[0][0]} x2={o.poly[0][0] + 60} y1={o.sortY} y2={o.sortY} stroke="#0EC7F5" strokeWidth="1" />
          <text x={o.poly[0][0] + 4} y={o.poly[0][1] + 14} fill="#0EC7F5" fontSize="13" fontWeight="700">
            {o.id} ({o.sortY})
          </text>
        </g>
      ))}
      {Object.entries(OFFICE_SPOTS).map(([id, s]) => (
        <g key={id}>
          {s.approach && (
            <line x1={s.x} y1={s.y} x2={s.approach.x} y2={s.approach.y} stroke="#FFE600" strokeDasharray="3 3" />
          )}
          {s.approach && <rect x={s.approach.x - 4} y={s.approach.y - 4} width="8" height="8" fill="#FFE600" />}
          <circle cx={s.x} cy={s.y} r="6" fill="none" stroke="#FFE600" strokeWidth="2.5" />
          <text x={s.x + 8} y={s.y - 6} fill="#FFE600" fontSize="12" fontWeight="700">
            {id}
          </text>
        </g>
      ))}
      <ellipse
        cx={OFFICE_HUDDLE.x}
        cy={OFFICE_HUDDLE.y}
        rx={OFFICE_HUDDLE.rx}
        ry={OFFICE_HUDDLE.ry}
        fill="none"
        stroke="#FF6B1A"
        strokeWidth="2"
        strokeDasharray="8 5"
      />
      {OFFICE_WANDER.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#c084fc" />
      ))}
      {actors.map((a) => (
        <g key={a.id}>
          {a.path.length > 0 && (
            <polyline
              points={[[a.x, a.y], ...a.path].map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />
          )}
          <line x1={a.x - 10} x2={a.x + 10} y1={a.y} y2={a.y} stroke="#F52820" strokeWidth="2.5" />
          <line x1={a.x} x2={a.x} y1={a.y - 10} y2={a.y + 10} stroke="#F52820" strokeWidth="2.5" />
          <text x={a.x + 10} y={a.y + 22} fill="#fff" fontSize="13" fontWeight="800" stroke="#000" strokeWidth="3" paintOrder="stroke">
            {`${a.id} · ${a.state} · ${a.pose} · ${a.frame}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Stats + hotkeys + the in-place animation player. */
export function OfficeDebugPanel({ snapshot }) {
  const [player, setPlayer] = useState(false);
  const s = snapshot || {};
  return (
    <div
      className="office-debug-panel absolute top-1 right-1 z-20 w-[230px] max-h-[96%] overflow-auto rounded-lg bg-black/80 text-[10px] leading-tight text-slate-200 p-2 font-mono pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between font-bold text-[#FFE600]">
        <span>OFFICE DEBUG</span>
        <span>
          {s.fps ?? "-"} fps · {(s.jsMs ?? 0).toFixed(2)} ms
        </span>
      </div>
      <div>mode: {s.mode} · teleports: {s.teleports ?? 0}</div>
      <div className="truncate">scene: {s.scene}</div>
      <div className="truncate">arc: {s.arc || "-"}</div>
      <div className="mt-1 grid grid-cols-1">
        {OFFICE_ACTIVITIES.map((a) => (
          <span key={a} className={s.seen && s.seen[a] ? "text-[#1FE03F]" : "text-slate-500"}>
            {s.seen && s.seen[a] ? "✓" : "·"} {OFFICE_ACTIVITY_LABELS[a]} {s.seen && s.seen[a] ? `×${s.seen[a]}` : ""}
          </span>
        ))}
      </div>
      <div className="mt-1 text-slate-400">
        1-9 scene ({OFFICE_SCENES.length}) · H prompt · R reply · C code red · ` toggle
      </div>
      <button
        type="button"
        className="mt-1 w-full rounded bg-[#0EC7F5] text-black font-bold py-0.5 cursor-pointer"
        onClick={() => setPlayer((p) => !p)}
      >
        {player ? "close" : "open"} in-place player
      </button>
      {player && <InPlacePlayer atlases={s.atlases || []} />}
    </div>
  );
}

/**
 * Loops any animation / view / pose of any loaded character in place, with
 * the pivot crosshair and feet baseline: feet must not wobble by more than
 * 1 sheet-px and the size must stay constant across rows.
 */
function InPlacePlayer({ atlases }) {
  const [ci, setCi] = useState(0);
  const [clip, setClip] = useState("walk");
  const [fps, setFps] = useState(10);
  const [mirror, setMirror] = useState(false);
  const [compare, setCompare] = useState(true);
  const boxRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const ghostRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const labelRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const atlas = atlases[ci];

  const clips = useMemo(() => {
    if (!atlas) return {};
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const [k, v] of Object.entries(atlas.animations)) out[`anim:${k}`] = v.frames;
    for (const [k, v] of Object.entries(atlas.views)) out[`view:${k}`] = [v];
    for (const [k, p] of Object.entries(OFFICE_POSES)) {
      if (p.frames) out[`pose:${k}`] = p.frames.filter((f) => atlas.has(f));
    }
    out["all frames"] = Object.keys(atlas.frames);
    return out;
  }, [atlas]);

  const key = clips[`anim:${clip}`] ? `anim:${clip}` : clip;
  const frames = useMemo(() => clips[key] || clips["anim:idle"] || [], [clips, key]);
  const SCALE = 1.5;

  useEffect(() => {
    if (!atlas || !boxRef.current) return;
    let raf = 0;
    const start = performance.now();
    const draw = (now) => {
      const n = Math.floor(((now - start) / 1000) * fps) % Math.max(1, frames.length);
      const f = atlas.frame(frames[n]);
      const el = boxRef.current;
      if (el) {
        el.style.backgroundPosition = `-${f.x * SCALE}px -${f.y * SCALE}px`;
        el.style.transform = mirror ? "scaleX(-1)" : "none";
      }
      if (labelRef.current) labelRef.current.textContent = `${frames[n]} (${n + 1}/${frames.length})`;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [atlas, frames, fps, mirror]);

  if (!atlas) return null;
  const cell = atlas.cell;
  const bgSize = `${atlas.size[0] * SCALE}px ${atlas.size[1] * SCALE}px`;
  const idle = atlas.frame("idle_0");
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        <select className="flex-1 bg-slate-800 rounded" value={ci} onChange={(e) => setCi(Number(e.target.value))}>
          {atlases.map((a, i) => (
            <option key={a.name} value={i}>
              {a.name}
            </option>
          ))}
        </select>
        <select className="flex-1 bg-slate-800 rounded" value={key} onChange={(e) => setClip(e.target.value)}>
          {Object.keys(clips).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          fps
          <input type="range" min="1" max="20" value={fps} onChange={(e) => setFps(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
          flip
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          idle
        </label>
      </div>
      <div
        className="relative mx-auto"
        style={{
          width: cell.w * SCALE,
          height: cell.h * SCALE,
          background: "repeating-conic-gradient(#2a2a35 0% 25%, #1b1b22 0% 50%) 0 0 / 12px 12px",
        }}
      >
        {compare && (
          <div
            ref={ghostRef}
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("${atlas.url}")`,
              backgroundSize: bgSize,
              backgroundPosition: `-${idle.x * SCALE}px -${idle.y * SCALE}px`,
              backgroundRepeat: "no-repeat",
              filter: "grayscale(1)",
            }}
          />
        )}
        <div
          ref={boxRef}
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${atlas.url}")`,
            backgroundSize: bgSize,
            backgroundRepeat: "no-repeat",
            transformOrigin: `${cell.pivot[0] * SCALE}px ${cell.pivot[1] * SCALE}px`,
          }}
        />
        {/* feet baseline + pivot crosshair */}
        <div className="absolute left-0 right-0 h-px bg-[#1FE03F]" style={{ top: cell.pivot[1] * SCALE }} />
        <div
          className="absolute h-px w-6 bg-[#F52820]"
          style={{ top: cell.pivot[1] * SCALE, left: cell.pivot[0] * SCALE - 12 }}
        />
        <div
          className="absolute w-px h-6 bg-[#F52820]"
          style={{ left: cell.pivot[0] * SCALE, top: cell.pivot[1] * SCALE - 12 }}
        />
        {/* idle head-top reference: sizes must match across rows */}
        <div
          className="absolute left-0 right-0 h-px bg-[#0EC7F5]/70"
          style={{ top: (cell.pivot[1] - atlas.standHeight) * SCALE }}
        />
      </div>
      <div className="text-center">
        <span ref={labelRef} />
      </div>
    </div>
  );
}
