import { useStuPDT } from "../contexts/useStuPDT";

export function useMetrics() {
  const {
    specialistsConsulted,
    internalMeetings,
    minutesWasted,
    userSatisfaction,
    chaosMeter,
    bumpMetrics,
    isPremiumVIP,
    setIsPremiumVIP,
  } = useStuPDT();

  return {
    specialistsConsulted,
    internalMeetings,
    minutesWasted,
    userSatisfaction,
    chaosMeter,
    bumpMetrics,
    isPremiumVIP,
    setIsPremiumVIP,
  };
}
