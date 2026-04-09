"use client";

import { useEffect, useState } from "react";

import { CheckForm } from "@/components/check-form";
import { ProviderExchangePanel } from "@/components/provider-exchange-panel";
import { type ProviderExchangeEntry } from "@/lib/credit-ops/types";

export function AnalyzeWorkspacePanel({
  selectedCheckId,
  initialEntries,
  shouldFocusJournal = false,
}: {
  selectedCheckId?: string;
  initialEntries: ProviderExchangeEntry[];
  shouldFocusJournal?: boolean;
}) {
  const currentAnalysisKey = selectedCheckId ?? "__no-selected-check__";
  const [clearedAnalysisKey, setClearedAnalysisKey] = useState<string | null>(null);
  const entries =
    clearedAnalysisKey === currentAnalysisKey ? [] : initialEntries;

  useEffect(() => {
    if (!shouldFocusJournal || !selectedCheckId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const journal = document.getElementById("journal-technique");
      if (!journal) {
        return;
      }

      journal.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      if (journal instanceof HTMLElement) {
        journal.focus({ preventScroll: true });
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("focus");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [selectedCheckId, shouldFocusJournal]);

  return (
    <section className="workspace-form stack-lg">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dossier client</p>
          <h2>Formulaire de vérification</h2>
        </div>
      </div>
      <CheckForm onAnalyzeStart={() => setClearedAnalysisKey(currentAnalysisKey)} />
      <ProviderExchangePanel
        providerName="PappersProvider"
        providerTransport="mcp-streamable-http"
        entries={entries}
      />
    </section>
  );
}
