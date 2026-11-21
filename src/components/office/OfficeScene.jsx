import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Building2, ArrowDown, Coffee, Siren, MessagesSquare, Bug } from "lucide-react";
import { useStuPDT } from "../../contexts/useStuPDT";
import { useOfficeEngine, usePrefersReducedMotion } from "../../hooks/useOfficeEngine";
import { OFFICE_IMAGE_URL } from "../../utils/office/engine";
import { OFFICE_COPY, OFFICE_OCCLUDERS, OFFICE_WORLD } from "../../constants/office";
import { OfficeDebugWorld, OfficeDebugPanel } from "./OfficeDebug";

const polygon = (poly) => `polygon(${poly.map(([x, y]) => `${x}px ${y}px`).join(",")})`;

/** `?office-debug` in the URL (any build), or the backtick key in dev. */
function initialDebug() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("office-debug");
}

const FAKE_PROMPTS = [
  "I have an exam tomorrow. Can you help me study?",
  "How do I fix my Wi-Fi?",
  "What time is it?",
  "Can someone please just answer my question?",
  "Why is my printer judging me?",
  "Is it normal for the coffee machine to say no?",
];

/**
 * THE OFFICE: a live, sprite-animated break room under the chat. Four staff
 * idle around the office; every user prompt makes them stop, huddle and
 * argue about it until the real reply lands.
 */
export function OfficeScene({ messages, isTransferring, transferTarget, activeDepartmentObj }) {
  const { isDarkMode, tx, soundFX, activeModal } = useStuPDT();
  const cardRef = useRef(/** @type {HTMLElement | null} */ (null));
  const sceneRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const worldRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const overlayRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const reducedMotion = usePrefersReducedMotion();
  const [debug, setDebug] = useState(initialDebug);
  const [snapshot, setSnapshot] = useState(null);

  const { engineRef, ready, status, caption, error, visibleRatio, withEngine } = useOfficeEngine({
    sceneRef,
    worldRef,
    rootRef,
    overlayRef,
    tx,
    sound: soundFX,
    reducedMotion,
    debug,
    onDebug: debug ? setSnapshot : undefined,
  });

  // ---- prompt / reply detection (derived; useChat is untouched) ------------
  // Ids present at mount are history (sessionStorage rehydration), not prompts.
  const [seen] = useState(() => new Set((messages || []).map((m) => m && m.id)));
  const pendingRef = useRef(false);
  const deptRef = useRef("");
  const [hint, setHint] = useState(false);
  const visibleRatioRef = useRef(0);

  // keep the latest context in refs (declared before the message effect,
  // so it's current when that effect runs in the same commit)
  useEffect(() => {
    const target = isTransferring && transferTarget ? transferTarget : activeDepartmentObj;
    deptRef.current = (target && target.name) || (activeDepartmentObj && activeDepartmentObj.name) || "";
  }, [isTransferring, transferTarget, activeDepartmentObj]);
  useEffect(() => {
    visibleRatioRef.current = visibleRatio;
  }, [visibleRatio]);

  useEffect(() => {
    if (!Array.isArray(messages)) return;
    for (const m of messages) {
      if (!m || seen.has(m.id)) continue;
      seen.add(m.id);
      if (m.sender === "user" && typeof m.text === "string") {
        pendingRef.current = true;
        const prompt = { id: String(m.id), text: m.text, dept: deptRef.current };
        withEngine((e) => e.prompt(prompt));
        setHint(visibleRatioRef.current < 0.4);
      } else if (m.sender === "ai" && pendingRef.current && !String(m.id).startsWith("vision-")) {
        // AI-only messages (e.g. the vision scan) are not prompts, and only
        // count as a reply when a prompt is waiting for one
        pendingRef.current = false;
        const info = { deptName: m.deptName || deptRef.current };
        withEngine((e) => e.reply(info));
      }
    }
  }, [messages, seen, withEngine]);

  // Code Red: the Grand Finale modal
  const finaleOpen = useRef(false);
  useEffect(() => {
    const open = activeModal === "grand_finale";
    if (open === finaleOpen.current) return;
    finaleOpen.current = open;
    // Escape closes the finale without dispatching a department transfer.
    const dismissed = !open && !isTransferring && pendingRef.current;
    if (dismissed) pendingRef.current = false;
    withEngine((e) => e.codeRed(open, dismissed));
  }, [activeModal, isTransferring, withEngine]);

  // offscreen hint: shown only while the huddle runs and the office is < 40% visible
  const showHint = hint && visibleRatio < 0.4 && status !== "idle";

  const scrollToOffice = useCallback(() => {
    cardRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    setHint(false);
  }, [reducedMotion]);

  // ---- debug hotkeys (only while debug is on; backtick toggles in dev) ----
  useEffect(() => {
    const onKey = (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "`" && import.meta.env.DEV) {
        setDebug((d) => !d);
        return;
      }
      if (!debug) return;
      const engine = engineRef.current;
      if (!engine) return;
      if (/^[1-9]$/.test(e.key)) engine.forceScene(Number(e.key) - 1);
      else if (e.key === "h" || e.key === "H") {
        const text = FAKE_PROMPTS[Math.floor(Math.random() * FAKE_PROMPTS.length)];
        engine.prompt({ id: `fake-${Date.now()}`, text, dept: deptRef.current || "StuPDT Assistant #001" });
      } else if (e.key === "r" || e.key === "R") engine.reply({ deptName: deptRef.current || "Form AI #004" });
      else if (e.key === "c" || e.key === "C") engine.codeRed(engine.director.mode !== "codeRed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debug, engineRef]);

  // ---- chrome -------------------------------------------------------------
  const chip = useMemo(() => {
    if (status === "codeRed")
      return {
        label: OFFICE_COPY.statusCodeRed,
        short: OFFICE_COPY.statusCodeRed,
        Icon: Siren,
        cls: "bg-[#F52820] text-white border-[#F52820]",
      };
    if (status === "huddle")
      return {
        label: OFFICE_COPY.statusHuddle,
        short: OFFICE_COPY.statusHuddleShort,
        Icon: MessagesSquare,
        cls: isDarkMode
          ? "bg-[#FF6B1A]/15 text-[#FF6B1A] border-[#FF6B1A]/50"
          : "bg-[#FF6B1A] text-[#071638] border-[#071638]",
      };
    return {
      label: OFFICE_COPY.statusIdle,
      short: OFFICE_COPY.statusIdle,
      Icon: Coffee,
      cls: isDarkMode
        ? "bg-[#1FE03F]/15 text-[#1FE03F] border-[#1FE03F]/40"
        : "bg-[#1FE03F] text-[#071638] border-[#071638]",
    };
  }, [status, isDarkMode]);

  const captionText = caption ? `${caption.name.toUpperCase()}: ${caption.text}` : OFFICE_COPY.captionIdle;

  return (
    <section
      ref={cardRef}
      aria-labelledby="office-title"
      className={`rounded-2xl overflow-hidden ${
        isDarkMode
          ? "bg-[#111116] border border-[#2A2A35]"
          : "bg-white border-2 border-[#071638] shadow-[4px_4px_0px_#071638]"
      }`}
    >
      {/* Header strip */}
      <div
        className={`px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
          isDarkMode ? "border-[#2A2A35]" : "border-[#071638] bg-[#071638] text-white"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className={`w-4 h-4 shrink-0 ${isDarkMode ? "text-[#0EC7F5]" : "text-[#FFE600]"}`} />
          <h2 id="office-title" className="text-xs font-black uppercase tracking-wider shrink-0">
            {tx(OFFICE_COPY.title)}
          </h2>
          <span className={`hidden sm:inline text-[11px] font-semibold truncate ${isDarkMode ? "text-slate-400" : "text-white/80"}`}>
            {tx(`— ${OFFICE_COPY.subtitle}`)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => setDebug((d) => !d)}
              title="Toggle office debug overlay (`)"
              aria-pressed={debug}
              className={`p-1 rounded-md cursor-pointer transition ${
                debug
                  ? "bg-[#FFE600] text-[#071638]"
                  : isDarkMode
                    ? "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                    : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${chip.cls}`}
          >
            <chip.Icon className="w-3 h-3" />
            <span className="sm:hidden">{tx(chip.short)}</span>
            <span className="hidden sm:inline">{tx(chip.label)}</span>
          </span>
        </div>
      </div>

      {/* The scene: fixed 1672:941 aspect, world scaled with one transform */}
      <div
        ref={sceneRef}
        role="img"
        aria-label={tx(OFFICE_COPY.ariaLabel)}
        className="relative w-full overflow-hidden bg-[#0b0910] select-none"
        style={{ aspectRatio: `${OFFICE_WORLD.w} / ${OFFICE_WORLD.h}`, isolation: "isolate" }}
      >
        <div
          ref={worldRef}
          className="office-world"
          style={{ opacity: ready ? 1 : 0, transition: "opacity 450ms ease-out" }}
        >
          <img
            src={OFFICE_IMAGE_URL}
            alt=""
            width={OFFICE_WORLD.w}
            height={OFFICE_WORLD.h}
            draggable={false}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 0 }}
          />
          {OFFICE_OCCLUDERS.map((o) => (
            <div
              key={o.id}
              className="office-occluder"
              style={{
                backgroundImage: `url("${OFFICE_IMAGE_URL}")`,
                clipPath: polygon(o.poly),
                zIndex: o.sortY * 2 + 1,
              }}
            />
          ))}
          <div ref={rootRef} className="office-layer" />
          {debug && <OfficeDebugWorld snapshot={snapshot} />}
        </div>

        <div ref={overlayRef} className="office-overlay" />

        {status === "codeRed" && <div className="office-vignette" aria-hidden="true" />}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                error ? "bg-[#F52820] text-white" : "bg-black/60 text-[#0EC7F5] animate-pulse"
              }`}
            >
              {tx(error ? "Office closed for maintenance (assets failed to load)" : OFFICE_COPY.loading)}
            </span>
          </div>
        )}

      </div>

      {/* Caption strip: the readable version of the latest line */}
      <p
        aria-live="polite"
        className={`px-3.5 py-2 text-[11px] sm:text-xs font-semibold leading-snug min-h-[2.25rem] flex items-center border-t ${
          isDarkMode ? "border-[#2A2A35] text-slate-300 bg-[#0C0C10]" : "border-[#071638] text-[#071638] bg-[#F4F9FF]"
        }`}
      >
        <span className={caption ? "" : "italic opacity-75"}>{tx(captionText)}</span>
      </p>

      {debug && ready && <OfficeDebugPanel snapshot={snapshot} />}

      {/* Offscreen hint: never auto-scrolls, just offers */}
      {showHint && (
        <button
          type="button"
          onClick={scrollToOffice}
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-full text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xl ${
            isDarkMode
              ? "bg-[#181820] text-[#FF6B1A] border border-[#FF6B1A]"
              : "bg-[#FFE600] text-[#071638] border-2 border-[#071638]"
          }`}
        >
          <span>{tx(OFFICE_COPY.offscreenHint)}</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      )}
    </section>
  );
}
