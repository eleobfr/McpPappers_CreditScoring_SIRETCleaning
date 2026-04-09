"use client";

import { useState } from "react";

import { CheckForm } from "@/components/check-form";
import { ProviderExchangePanel } from "@/components/provider-exchange-panel";
import { type ProviderExchangeEntry } from "@/lib/credit-ops/types";

export function AnalyzeWorkspacePanel({
  selectedCheckId,
  initialEntries,
}: {
  selectedCheckId?: string;
  initialEntries: ProviderExchangeEntry[];
}) {
  const currentAnalysisKey = selectedCheckId ?? "__no-selected-check__";
  const [clearedAnalysisKey, setClearedAnalysisKey] = useState<string | null>(null);
  const entries =
    clearedAnalysisKey === currentAnalysisKey ? [] : initialEntries;

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
