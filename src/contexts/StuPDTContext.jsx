import React, { useState, useEffect, useCallback } from "react";
import { StuPDTContext } from "./StuPDTContextInstance";
import { toBraille } from "../utils/braille";
import { soundFX } from "../utils/soundEngine";
import { checkBackendHealth, fetchDepartments, fetchQuotes } from "../services/apiClient";
import { syncTelemetryMetrics, fetchGlobalMetrics } from "../services/telemetryService";
import { DEPARTMENTS, STUPID_QUOTES } from "../constants";

const STORAGE_KEYS = {
  METRICS: "stupdt_telemetry_metrics",
  VIP: "stupdt_is_vip",
};

function getStoredJson(key, fallback) {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredJson(key, val) {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {
    // SessionStorage unavailable or restricted
  }
}

export function StuPDTProvider({ children }) {
  // Theme & Accessibility
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [brailleMode, setBrailleMode] = useState(false);
  const [signLanguageMode, setSignLanguageMode] = useState(false);

  // Translation helper: turns visible text to Braille when Braille Mode is ON
  const tx = useCallback((text) => (brailleMode ? toBraille(text) : text), [brailleMode]);

  // Sound Engine
  const [isMuted, setIsMuted] = useState(false);
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundFX.muted = next;
      return next;
    });
  }, []);

  // Backend Health Status: 'checking' | 'connected' | 'offline'
  const [backendStatus, setBackendStatus] = useState("checking");
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [quotes, setQuotes] = useState(STUPID_QUOTES);

  // Telemetry Metrics with Session Storage Persistence
  const defaultMetrics = {
    specialistsConsulted: 1,
    internalMeetings: 14,
    minutesWasted: 6,
    userSatisfaction: -18,
    chaosMeter: 15,
  };

  const storedMetrics = getStoredJson(STORAGE_KEYS.METRICS, null);
  const initialMetrics = { ...defaultMetrics, ...(storedMetrics || {}) };

  const [specialistsConsulted, setSpecialistsConsulted] = useState(
    Number(initialMetrics.specialistsConsulted) || 1,
  );
  const [internalMeetings, setInternalMeetings] = useState(
    Number(initialMetrics.internalMeetings) || 14,
  );
  const [minutesWasted, setMinutesWasted] = useState(Number(initialMetrics.minutesWasted) || 6);
  const [userSatisfaction, setUserSatisfaction] = useState(
    Number(initialMetrics.userSatisfaction) || -18,
  );
  const [chaosMeter, setChaosMeter] = useState(Number(initialMetrics.chaosMeter) || 15);
  const [isPremiumVIP, setIsPremiumVIP] = useState(() => getStoredJson(STORAGE_KEYS.VIP, false));

  const refreshBackendStatus = useCallback(async () => {
    setBackendStatus("checking");
    const health = await checkBackendHealth();
    if (health.online) {
      setBackendStatus("connected");
      const [remoteMetrics, remoteDepts, remoteQuotes] = await Promise.all([
        fetchGlobalMetrics(),
        fetchDepartments(),
        fetchQuotes(),
      ]);
      if (remoteDepts && Array.isArray(remoteDepts) && remoteDepts.length > 0) {
        setDepartments(remoteDepts);
      }
      if (remoteQuotes && Array.isArray(remoteQuotes) && remoteQuotes.length > 0) {
        setQuotes(remoteQuotes);
      }
      if (remoteMetrics) {
        if (typeof remoteMetrics.specialistsConsulted === "number")
          setSpecialistsConsulted(remoteMetrics.specialistsConsulted);
        if (typeof remoteMetrics.internalMeetings === "number")
          setInternalMeetings(remoteMetrics.internalMeetings);
        if (typeof remoteMetrics.minutesWasted === "number")
          setMinutesWasted(remoteMetrics.minutesWasted);
        if (typeof remoteMetrics.userSatisfaction === "number")
          setUserSatisfaction(remoteMetrics.userSatisfaction);
        if (typeof remoteMetrics.chaosMeter === "number") setChaosMeter(remoteMetrics.chaosMeter);
      }
    } else {
      setBackendStatus("offline");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    void checkBackendHealth().then(async (health) => {
      if (!isMounted) return;
      if (health.online) {
        setBackendStatus("connected");
        const [remoteMetrics, remoteDepts, remoteQuotes] = await Promise.all([
          fetchGlobalMetrics(),
          fetchDepartments(),
          fetchQuotes(),
        ]);
        if (!isMounted) return;
        if (remoteDepts && Array.isArray(remoteDepts) && remoteDepts.length > 0) {
          setDepartments(remoteDepts);
        }
        if (remoteQuotes && Array.isArray(remoteQuotes) && remoteQuotes.length > 0) {
          setQuotes(remoteQuotes);
        }
        if (remoteMetrics) {
          if (typeof remoteMetrics.specialistsConsulted === "number")
            setSpecialistsConsulted(remoteMetrics.specialistsConsulted);
          if (typeof remoteMetrics.internalMeetings === "number")
            setInternalMeetings(remoteMetrics.internalMeetings);
          if (typeof remoteMetrics.minutesWasted === "number")
            setMinutesWasted(remoteMetrics.minutesWasted);
          if (typeof remoteMetrics.userSatisfaction === "number")
            setUserSatisfaction(remoteMetrics.userSatisfaction);
          if (typeof remoteMetrics.chaosMeter === "number") setChaosMeter(remoteMetrics.chaosMeter);
        }
      } else {
        setBackendStatus("offline");
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Save metrics to storage and sync with backend if online
  useEffect(() => {
    const currentMetrics = {
      specialistsConsulted,
      internalMeetings,
      minutesWasted,
      userSatisfaction,
      chaosMeter,
    };
    setStoredJson(STORAGE_KEYS.METRICS, currentMetrics);
    if (backendStatus === "connected") {
      void syncTelemetryMetrics(currentMetrics);
    }
  }, [
    specialistsConsulted,
    internalMeetings,
    minutesWasted,
    userSatisfaction,
    chaosMeter,
    backendStatus,
  ]);

  useEffect(() => {
    setStoredJson(STORAGE_KEYS.VIP, isPremiumVIP);
  }, [isPremiumVIP]);

  // Toast Notification
  const [toastNotification, setToastNotification] = useState(null);
  const triggerToast = useCallback((msg) => {
    setToastNotification(msg);
    setTimeout(() => {
      setToastNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  }, []);

  const bumpMetrics = useCallback(
    (extraDepts = 1, extraChaos = 18, extraMins = 8) => {
      setSpecialistsConsulted((prev) => prev + extraDepts);
      setInternalMeetings((prev) => prev + 5);
      setMinutesWasted((prev) => prev + extraMins);
      setUserSatisfaction((prev) => Math.max(-999, prev - 22));
      setChaosMeter((prev) => {
        const next = Math.min(100, prev + extraChaos);
        if (next >= 100 && prev < 100) {
          soundFX.playKlaxon();
          triggerToast("100% CHAOS REACHED: NATIONAL BUREAUCRATIC EMERGENCY DECLARED!");
        }
        return next;
      });
    },
    [triggerToast],
  );

  const resetMetrics = useCallback(() => {
    setSpecialistsConsulted(1);
    setInternalMeetings(14);
    setMinutesWasted(0);
    setUserSatisfaction(-18);
    setChaosMeter(15);
    setIsPremiumVIP(false);
    sessionStorage.removeItem(STORAGE_KEYS.METRICS);
    sessionStorage.removeItem(STORAGE_KEYS.VIP);
    triggerToast("All bureaucracy metrics reset back to baseline chaos!");
  }, [triggerToast]);

  // Active Modals
  // 'org_about' | 'bureaucracy' | 'vision' | 'toolkit' | 'apology_pdf' | 'emotional' | 'loading_sim' | 'report' | 'grand_finale'
  const [activeModal, setActiveModal] = useState(null);

  // Quotes
  const [quoteIdx, setQuoteIdx] = useState(0);
  const nextQuote = useCallback(() => {
    soundFX.playChime();
    setQuoteIdx((prev) => (prev + 1) % 12);
  }, []);

  const value = {
    // Theme & a11y
    isDarkMode,
    setIsDarkMode,
    brailleMode,
    setBrailleMode,
    signLanguageMode,
    setSignLanguageMode,
    tx,

    // Audio
    isMuted,
    toggleMute,
    soundFX,

    // Backend
    backendStatus,
    refreshBackendStatus,

    // Telemetry
    specialistsConsulted,
    internalMeetings,
    minutesWasted,
    userSatisfaction,
    chaosMeter,
    bumpMetrics,
    resetMetrics,
    isPremiumVIP,
    setIsPremiumVIP,

    // Toast
    toastNotification,
    triggerToast,

    // Modals
    activeModal,
    setActiveModal,

    // Quotes
    quoteIdx,
    setQuoteIdx,
    nextQuote,
    quotes,
    departments,
  };

  return <StuPDTContext.Provider value={value}>{children}</StuPDTContext.Provider>;
}
