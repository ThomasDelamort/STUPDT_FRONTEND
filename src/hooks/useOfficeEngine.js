import { useEffect, useRef, useState, useCallback } from "react";
import { OfficeEngine, loadOfficeAssets } from "../utils/office/engine";
import { OFFICE_ROSTER, OFFICE_WORLD } from "../constants/office";

/** prefers-reduced-motion, live. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Owns THE OFFICE engine: preload/decode assets, create the engine once,
 * keep its scale in sync with the card width, pause drawing while the card
 * is offscreen or the tab is hidden, and tear everything down on unmount
 * (StrictMode-safe: the second mount gets a fresh engine, the first is
 * fully destroyed).
 *
 * @param {{
 *   sceneRef: React.RefObject<HTMLDivElement | null>,
 *   worldRef: React.RefObject<HTMLDivElement | null>,
 *   rootRef: React.RefObject<HTMLDivElement | null>,
 *   overlayRef: React.RefObject<HTMLDivElement | null>,
 *   tx: (s: string) => string,
 *   sound: any,
 *   reducedMotion: boolean,
 *   debug: boolean,
 *   onDebug?: (snap: any) => void,
 * }} opts
 */
export function useOfficeEngine({
  sceneRef,
  worldRef,
  rootRef,
  overlayRef,
  tx,
  sound,
  reducedMotion,
  debug,
  onDebug,
}) {
  /** @type {React.MutableRefObject<OfficeEngine | null>} */
  const engineRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("idle");
  const [caption, setCaption] = useState(/** @type {{name: string, text: string} | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [visibleRatio, setVisibleRatio] = useState(0);

  // live values read by the engine without re-creating it
  const txRef = useRef(tx);
  const debugCbRef = useRef(onDebug);
  const scaleRef = useRef({ s: 0.5, w: OFFICE_WORLD.w * 0.5 });
  const visibleRef = useRef({ ratio: 0, tab: true });
  /** queued events that arrived before the assets finished decoding */
  const queueRef = useRef(/** @type {((e: OfficeEngine) => void)[]} */ ([]));
  const initialRef = useRef({ reducedMotion, debug, sound });

  useEffect(() => {
    txRef.current = tx;
  }, [tx]);
  useEffect(() => {
    debugCbRef.current = onDebug;
  }, [onDebug]);

  // ---- create / destroy -----------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    /** @type {OfficeEngine | null} */
    let engine = null;
    const characters = OFFICE_ROSTER.filter((c) => c.enabled);
    loadOfficeAssets(characters)
      .then(({ atlases }) => {
        if (cancelled || !rootRef.current || !overlayRef.current) return;
        const init = initialRef.current;
        engine = new OfficeEngine({
          root: rootRef.current,
          overlay: overlayRef.current,
          characters,
          atlases,
          tx: (s) => txRef.current(s),
          sound: init.sound,
          reducedMotion: init.reducedMotion,
          debug: init.debug,
          onStatus: setStatus,
          onCaption: setCaption,
          onDebug: (snap) => debugCbRef.current?.(snap),
        });
        engineRef.current = engine;
        // QA handle for automated checks (debug sessions only)
        if (init.debug) /** @type {any} */ (window).__office = engine;
        engine.setScale(scaleRef.current.s, scaleRef.current.w);
        engine.start();
        const v = visibleRef.current;
        engine.setVisible(v.ratio > 0 && v.tab);
        for (const fn of queueRef.current.splice(0)) fn(engine);
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message || err));
      });
    return () => {
      cancelled = true;
      if (engine) engine.destroy();
      const w = /** @type {any} */ (window);
      if (w.__office === engine) delete w.__office;
      engineRef.current = null;
    };
  }, [rootRef, overlayRef]);

  // ---- live settings ------------------------------------------------------
  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion, ready]);
  useEffect(() => {
    engineRef.current?.setDebug(debug);
  }, [debug, ready]);

  // ---- scale: one transform on the world, from the card width --------------
  useEffect(() => {
    const scene = sceneRef.current;
    const world = worldRef.current;
    if (!scene || !world) return;
    const apply = () => {
      const w = scene.clientWidth;
      if (!w) return;
      const s = w / OFFICE_WORLD.w;
      scaleRef.current = { s, w };
      world.style.transform = `scale(${s})`;
      engineRef.current?.setScale(s, w);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(scene);
    apply();
    return () => ro.disconnect();
  }, [sceneRef, worldRef]);

  // ---- visibility: offscreen card or hidden tab pauses drawing -------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const push = () => {
      const v = visibleRef.current;
      engineRef.current?.setVisible(v.ratio > 0 && v.tab);
    };
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        visibleRef.current.ratio = e.isIntersecting ? e.intersectionRatio : 0;
        setVisibleRatio(visibleRef.current.ratio);
        push();
      },
      { threshold: [0, 0.05, 0.2, 0.4, 0.6, 0.8, 1] },
    );
    io.observe(scene);
    const onVis = () => {
      visibleRef.current.tab = document.visibilityState !== "hidden";
      push();
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sceneRef]);

  /** Run an engine call now, or as soon as the engine exists. */
  const withEngine = useCallback((fn) => {
    const e = engineRef.current;
    if (e) fn(e);
    else queueRef.current.push(fn);
  }, []);

  return { engineRef, ready, status, caption, error, visibleRatio, withEngine };
}
