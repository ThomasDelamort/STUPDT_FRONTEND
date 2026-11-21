import React, { useState } from "react";
import { FileText, Download } from "lucide-react";
import { APOLOGY_PDF_PAGES } from "../../constants";
import { useStuPDT } from "../../contexts/useStuPDT";

export function ApologyPdfModal() {
  const { activeModal, setActiveModal, isDarkMode, tx, soundFX, triggerToast } = useStuPDT();
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [citizenName, setCitizenName] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  if (activeModal !== "apology_pdf") return null;

  const handleDownloadOfficialPdf = async () => {
    soundFX.playRubberStamp();
    setIsDownloading(true);

    try {
      const nameParam = encodeURIComponent(citizenName.trim() || "Valued Unresolved Citizen");
      const url = `/api/apology/download?name=${nameParam}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `StuPDT_Official_Apology_Certificate_Form_AP999.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      triggerToast("Official 3-Page Government Apology Certificate Downloaded!");
    } catch {
      triggerToast("Failed to download PDF. Server hamsters exhausted.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`max-w-lg w-full rounded-3xl p-6 space-y-4 border-2 shadow-2xl ${
          isDarkMode
            ? "bg-[#111116] border-[#0EC7F5] text-white"
            : "bg-white border-[#071638] text-[#071638]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-700/40 pb-3">
          <h3 className="text-base font-black flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#0EC7F5]" />
            <span>{tx("Official 47-Clause Apology Certificate")}</span>
          </h3>
          <button
            onClick={() => setActiveModal(null)}
            className="px-3 py-1 rounded-xl bg-[#F52820] text-white text-xs font-black cursor-pointer"
          >
            {tx("Close")}
          </button>
        </div>

        {/* Certificate Customization Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase tracking-wider opacity-75 block">
            {tx("Personalize Certificate Recipient (Optional):")}
          </label>
          <input
            type="text"
            value={citizenName}
            onChange={(e) => setCitizenName(e.target.value)}
            placeholder={tx("e.g. Bruce Wayne or Valued Unresolved Citizen")}
            className={`w-full px-3.5 py-2 rounded-xl text-xs font-bold border focus:outline-none focus:border-[#0EC7F5] ${
              isDarkMode
                ? "bg-[#181820] border-[#2A2A35] text-white"
                : "bg-[#F4F9FF] border-[#071638] text-[#071638]"
            }`}
          />
        </div>

        <div
          className={`rounded-2xl p-4 space-y-2 border ${
            isDarkMode ? "bg-[#181820] border-[#2A2A35]" : "bg-[#F4F9FF] border-[#071638]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-[#0EC7F5]">
              {tx(APOLOGY_PDF_PAGES[pdfPageIndex].title)}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F52820]/20 text-[#F52820] border border-[#F52820]/40">
              {tx("Form AP-999")}
            </span>
          </div>
          <div className="text-[11px] opacity-65 italic">
            {tx(APOLOGY_PDF_PAGES[pdfPageIndex].subtitle)}
          </div>
          <p className="text-sm whitespace-pre-line pt-1 leading-relaxed">
            {tx(APOLOGY_PDF_PAGES[pdfPageIndex].body)}
          </p>
          <div className="text-[10px] opacity-60 pt-2 border-t border-slate-700/40">
            {tx(APOLOGY_PDF_PAGES[pdfPageIndex].footnote)}
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-700/40">
          <div className="flex gap-2">
            <button
              onClick={() => setPdfPageIndex((p) => Math.max(0, p - 1))}
              disabled={pdfPageIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-700 text-white disabled:opacity-40 text-xs font-black cursor-pointer"
            >
              {tx("← Prev")}
            </button>
            <button
              onClick={() => setPdfPageIndex((p) => Math.min(APOLOGY_PDF_PAGES.length - 1, p + 1))}
              disabled={pdfPageIndex === APOLOGY_PDF_PAGES.length - 1}
              className="px-3 py-1.5 rounded-xl bg-[#0EC7F5] text-[#08080A] disabled:opacity-40 text-xs font-black cursor-pointer"
            >
              {tx("Next →")}
            </button>
          </div>

          <span className="text-xs font-black opacity-75">
            {tx(`Clause ${pdfPageIndex + 1} of ${APOLOGY_PDF_PAGES.length}`)}
          </span>

          <button
            onClick={handleDownloadOfficialPdf}
            disabled={isDownloading}
            className="px-3.5 py-2 rounded-xl bg-[#1FE03F] hover:bg-[#19c435] text-[#08080A] text-xs font-black cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Download full 3-page government apology certificate PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDownloading ? tx("Stamping PDF...") : tx("Download Official PDF")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
