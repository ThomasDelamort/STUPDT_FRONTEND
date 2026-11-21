import { useStuPDT } from "../contexts/useStuPDT";

export function useToast() {
  const { toastNotification, triggerToast } = useStuPDT();
  return { toastNotification, triggerToast };
}
