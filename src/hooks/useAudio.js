import { useStuPDT } from "../contexts/useStuPDT";

export function useAudio() {
  const { isMuted, toggleMute, soundFX } = useStuPDT();
  return { isMuted, toggleMute, soundFX };
}
