import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Languages, RotateCw, X } from "lucide-react";
import { useStuPDT } from "../../contexts/useStuPDT";
import { LANGUAGES } from "../../i18n/languages";
import {
  easeOutQuart,
  pickWinnerIndex,
  randomJitter,
  targetRotation,
  tickCount,
  wedgeSize,
} from "../../i18n/spinMath";

// ============================================================================
// WHEEL OF LANGUAGES
// The user never picks a language. Opening this modal spins the wheel; whatever
// wedge ends up under the pointer is applied to the whole UI automatically.
// The winner is chosen BEFORE the animation starts and the final rotation is
// derived from it, so what you see is always what you get.
// ============================================================================

const WHEEL_COUNT = LANGUAGES.length;
const WHEEL_RADIUS = 150;
const SPIN_MS = 4600;
const REDUCED_MOTION_SPIN_MS = 400;
const AUTO_START_MS = 350;
const AUTO_CLOSE_MS = 2600;
const MIN_TICK_SOUND_GAP_MS = 32;

function polar(radius, deg) {
  const rad = (deg * Math.PI) / 180;
  return [radius * Math.sin(rad), -radius * Math.cos(rad)];
}

// Wedge `i` spans wheel-angles [i*w, (i+1)*w), clockwise from 12 o'clock.
const WEDGES = LANGUAGES.map((language, index) => {
  const w = wedgeSize(WHEEL_COUNT);
  const [x1, y1] = polar(WHEEL_RADIUS, index * w);
  const [x2, y2] = polar(WHEEL_RADIUS, (index + 1) * w);
  return {
    language,
    path: `M0 0 L${x1.toFixed(3)} ${y1.toFixed(3)} A${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`,
    labelRotation: index * w + w / 2 - 90,
  };
});

const WheelFace = memo(function WheelFace({ wheelRef, winnerId, edgeColor }) {
  return (
    <svg viewBox="-160 -160 320 320" className="w-full h-full block" aria-hidden="true">
      <circle r="156" fill={edgeColor} />
      {/* Rotated imperatively every animation frame (see spin()) - no React re-render per frame. */}
      <g ref={wheelRef}>
        {WEDGES.map(({ language, path, labelRotation }) => (
          <g
            key={language.id}
            style={{
              opacity: winnerId && winnerId !== language.id ? 0.35 : 1,
              transition: "opacity 300ms",
            }}
          >
            <path d={path} fill={language.color} stroke={edgeColor} strokeWidth="2" />
            <text
              transform={`rotate(${labelRotation})`}
              x={WHEEL_RADIUS - 12}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="12.5"
              fontWeight="900"
              fill={language.ink}
              lang={language.htmlLang}
            >
              {language.nativeName}
            </text>
          </g>
        ))}
        <circle r="27" fill="#FFE600" stroke={edgeColor} strokeWidth="4" />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="24"
          fontWeight="900"
          fill="#08080A"
        >
          ?
        </text>
      </g>
    </svg>
  );
});

function LanguageWheelDialog() {
  const { setActiveModal, setLanguage, language, isDarkMode, soundFX, triggerToast, tx } =
    useStuPDT();

  // "idle" (just opened) | "spinning" | "landed"
  const [phase, setPhase] = useState("idle");
  const [winner, setWinner] = useState(null);
  const [sameLanguage, setSameLanguage] = useState(false);

  const dialogRef = useRef(null);
  const wheelRef = useRef(null);
  const pointerRef = useRef(null);
  const rotationRef = useRef(0);
  const rafRef = useRef(0);
  const closeTimerRef = useRef(0);
  // Set while a spin is running: { lang, startLangId }. Doubles as the
  // "already spinning" guard and as the not-yet-applied result.
  const pendingRef = useRef(null);

  const busy = phase !== "landed";

  const applyResult = useCallback(
    (lang, startLangId) => {
      setLanguage(lang.id);
      if (lang.id === startLangId) {
        triggerToast(
          "WHEEL OF LANGUAGES: Landed on your current language. Bureaucracy has re-approved your existing choice.",
        );
      } else {
        triggerToast(
          "WHEEL OF LANGUAGES: Language reassigned. Complaints may now be filed in your new language.",
        );
      }
    },
    [setLanguage, triggerToast],
  );

  const flapPointer = useCallback(() => {
    const el = pointerRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "rotate(-16deg)";
    requestAnimationFrame(() => {
      el.style.transition = "transform 80ms ease-out";
      el.style.transform = "rotate(0deg)";
    });
  }, []);

  const finishSpin = useCallback(
    (lang, startLangId) => {
      pendingRef.current = null;
      const same = lang.id === startLangId;
      applyResult(lang, startLangId);
      setSameLanguage(same);
      setWinner(lang);
      setPhase("landed");
      if (same) soundFX.playErrorBuzz();
      else soundFX.playChime();
      closeTimerRef.current = window.setTimeout(() => setActiveModal(null), AUTO_CLOSE_MS);
    },
    [applyResult, setActiveModal, soundFX],
  );

  const spin = useCallback(() => {
    if (pendingRef.current) return; // never start two spins at once
    window.clearTimeout(closeTimerRef.current);

    const reduced = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const index = pickWinnerIndex(WHEEL_COUNT);
    const lang = LANGUAGES[index];
    const from = rotationRef.current;
    const turns = reduced ? 1 : 5 + Math.floor(Math.random() * 2);
    const to = targetRotation(from, index, WHEEL_COUNT, turns, randomJitter(WHEEL_COUNT));
    const duration = reduced ? REDUCED_MOTION_SPIN_MS : SPIN_MS;
    const startLangId = language;

    pendingRef.current = { lang, startLangId };
    setPhase("spinning");
    setWinner(null);

    const startedAt = performance.now();
    let lastTick = tickCount(from, WHEEL_COUNT);
    let lastTickSound = 0;

    const frame = (now) => {
      const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
      const rotation = from + (to - from) * easeOutQuart(t);
      rotationRef.current = rotation;
      wheelRef.current?.setAttribute("transform", `rotate(${rotation})`);

      if (!reduced) {
        const ticks = tickCount(rotation, WHEEL_COUNT);
        if (ticks !== lastTick) {
          lastTick = ticks;
          flapPointer();
          if (now - lastTickSound > MIN_TICK_SOUND_GAP_MS) {
            lastTickSound = now;
            soundFX.playTone(900 + Math.random() * 260, "square", 0.025, 0.02);
          }
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        const settled = ((to % 360) + 360) % 360;
        rotationRef.current = settled;
        wheelRef.current?.setAttribute("transform", `rotate(${settled})`);
        finishSpin(lang, startLangId);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [language, finishSpin, flapPointer, soundFX]);

  // Auto-start shortly after the modal paints (this is the whole gimmick: one
  // click on the navbar and the wheel is already turning).
  useEffect(() => {
    dialogRef.current?.focus();
    const id = window.setTimeout(spin, AUTO_START_MS);
    return () => window.clearTimeout(id);
    // Intentionally mount-only: the closure from the first render is the right one.
  }, []);

  // Unmount (e.g. Escape mid-spin): stop animating but still apply the result
  // that was already chosen - a spin is never left half-finished.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(closeTimerRef.current);
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        applyResult(pending.lang, pending.startLangId);
      }
    },
    [applyResult],
  );

  const edgeColor = isDarkMode ? "#08080A" : "#071638";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-wheel-title"
        tabIndex={-1}
        className={`max-w-sm w-full rounded-3xl p-5 space-y-4 border-2 shadow-2xl outline-none ${
          isDarkMode
            ? "bg-[#111116] border-[#0EC7F5] text-white"
            : "bg-white border-[#071638] text-[#071638]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-[#0EC7F5]" />
            <h3 id="language-wheel-title" className="text-base font-black tracking-wide">
              {tx("WHEEL OF LANGUAGES")}
            </h3>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            disabled={busy}
            aria-label={tx("Close")}
            className="p-1 rounded-lg opacity-70 hover:opacity-100 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The wheel + fixed pointer at 12 o'clock */}
        <div className="relative mx-auto aspect-square w-[min(78vw,320px)]">
          <div
            ref={pointerRef}
            className="absolute left-1/2 -top-2 z-10 -ml-3.5 pointer-events-none"
            style={{ transformOrigin: "50% 20%" }}
          >
            <svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">
              <path
                d="M14 35 L2 8 Q14 -2 26 8 Z"
                fill="#F52820"
                stroke={edgeColor}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="14" cy="10" r="3" fill="#FFE600" />
            </svg>
          </div>
          <WheelFace wheelRef={wheelRef} winnerId={winner?.id} edgeColor={edgeColor} />
        </div>

        <div aria-live="polite" className="min-h-[84px] flex flex-col items-center justify-center text-center">
          {phase === "landed" && winner ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                {tx("LANDED ON")}
              </p>
              <p className="text-2xl font-black flex items-center gap-2" lang={winner.htmlLang}>
                <span>{winner.nativeName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#FFE600] text-[#08080A] font-black">
                  {winner.code}
                </span>
              </p>
              <p className="text-xs opacity-80 font-medium mt-1">
                {sameLanguage
                  ? tx("Same language again! The wheel changed absolutely nothing.")
                  : tx("Interface switched automatically. Complaints may be filed in the new language.")}
              </p>
            </>
          ) : (
            <p className="text-xs opacity-80 font-semibold">
              {tx("Your language is being assigned by lottery. No appeals.")}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={spin}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-[#FFE600] text-[#08080A] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />
            <span>{busy ? tx("Spinning...") : tx("Spin Again")}</span>
          </button>
          <button
            onClick={() => setActiveModal(null)}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-slate-700 text-white font-black text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tx("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LanguageWheelModal() {
  const { activeModal } = useStuPDT();
  // The dialog only exists while open, so every open starts a fresh spin and an
  // unmount cleanly cancels/commits (see LanguageWheelDialog).
  if (activeModal !== "language_wheel") return null;
  return <LanguageWheelDialog />;
}
