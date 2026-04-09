"use client";

import { useEffect } from "react";

import { PrintButton } from "@/components/print-button";

export function PdfReportActions({
  checkId,
  autoPrint,
}: {
  checkId: string;
  autoPrint: boolean;
}) {
  useEffect(() => {
    if (!autoPrint) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="pdf-report-actions print-hidden">
      <PrintButton label="Exporter en PDF" />
      <a className="button button-secondary" href={`/verify?check=${checkId}`}>
        Retour au dossier
      </a>
    </div>
  );
}
