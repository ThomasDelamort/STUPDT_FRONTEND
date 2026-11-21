import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useStuPDT } from "../../contexts/useStuPDT";
import { ASSURANCE_START, ASSURANCE_STEPS } from "../../constants/assurance";

// The dialog owns the step state and only exists while the modal is open, so it
// unmounts on close (button, Escape key, anything) and always reopens at the start.
function AssuranceDialog() {
  const { setActiveModal, isDarkMode, soundFX, triggerToast, tx } = useStuPDT();
  const [stepId, setStepId] = useState(ASSURANCE_START);
  const step = ASSURANCE_STEPS[stepId];

  const answer = (choice) => {
    if (choice === "yes") {
      soundFX.playChime();
    } else {
      soundFX.playErrorBuzz();
    }

    const next = step[choice];
    if (typeof next === "string") {
      setStepId(next);
      return;
    }
    setActiveModal(null);
    triggerToast(next.toast);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      {/* key restarts the pop animation so every question "pops up" again */}
      <div
        key={stepId}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="assurance-message"
        className={`assurance-pop max-w-md w-full rounded-3xl p-6 text-center space-y-4 border-2 shadow-2xl ${
          isDarkMode
            ? "bg-[#111116] border-[#3888F2] text-white"
            : "bg-white border-[#071638] text-[#071638]"
        }`}
      >
        <ShieldCheck className="w-10 h-10 text-[#3888F2] mx-auto" />
        <h3 id="assurance-message" className="text-lg font-black">
          {tx(step.text)}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => answer("yes")}
            className="flex-1 py-2.5 rounded-xl bg-[#1FE03F] hover:bg-[#19c435] text-[#08080A] font-black text-sm cursor-pointer"
          >
            {tx("Yes")}
          </button>
          <button
            onClick={() => answer("no")}
            className="flex-1 py-2.5 rounded-xl bg-[#F52820] hover:bg-red-700 text-white font-black text-sm cursor-pointer"
          >
            {tx("No")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssuranceModal() {
  const { activeModal } = useStuPDT();

  if (activeModal !== "assurance") return null;

  return <AssuranceDialog />;
}
