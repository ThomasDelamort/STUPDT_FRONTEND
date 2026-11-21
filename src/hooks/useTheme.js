import { useStuPDT } from "../contexts/useStuPDT";

export function useTheme() {
  const {
    isDarkMode,
    setIsDarkMode,
    brailleMode,
    setBrailleMode,
    signLanguageMode,
    setSignLanguageMode,
    tx,
  } = useStuPDT();

  return {
    isDarkMode,
    setIsDarkMode,
    brailleMode,
    setBrailleMode,
    signLanguageMode,
    setSignLanguageMode,
    tx,
  };
}
