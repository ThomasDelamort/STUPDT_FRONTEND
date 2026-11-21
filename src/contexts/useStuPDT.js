import { useContext } from "react";
import { StuPDTContext } from "./StuPDTContextInstance";

/**
 * Hook to access StuPDT context.
 * @returns {any}
 */
export function useStuPDT() {
  const context = useContext(StuPDTContext);
  if (!context) {
    throw new Error("useStuPDT must be used within a StuPDTProvider");
  }
  return context;
}
