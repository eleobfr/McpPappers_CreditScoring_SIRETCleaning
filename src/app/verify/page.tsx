import type { Metadata } from "next";

import { AnalyzeWorkspacePanel } from "@/components/analyze-workspace-panel";
import { SourceBadge } from "@/components/badges";
import { CheckDecisionCard } from "@/components/check-decision-card";
import { HistoryTable } from "@/components/history-table";
import { PdfExportCard } from "@/components/pdf-export-card";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import {
  getVerificationCheckForUser,
  listVerificationChecksForUser,
} from "@/lib/credit-ops/check-service";
import { hasPappersMcpConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verifier un client avant facturation | Credit Ops",
  description:
    "Analyse B2B avant facturation : matching entreprise, risque, limite de credit suggeree et journal MCP Pappers.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ check?: string; focus?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const recentChecks = listVerificationChecksForUser(user.id, 20);
  const pappersConfigured = hasPappersMcpConfigured();
  const params = await searchParams;
  const selectedCheckId = params.check;
  const shouldFocusJournal = params.focus === "journal";
  const selectedCheck = selectedCheckId
    ? getVerificationCheckForUser(user.id, selectedCheckId)
    : null;

  return (
    <div className="container content-canvas stack-xl">
      <section className="workspace-hero page-intro">
        <div className="page-header">
          <div className="stack-sm">
            <p className="eyebrow">Session</p>
            <h1 className="page-title">Verifier un client avant facturation</h1>
            <p className="section-subtitle">
              {user.fullName} · {user.email}
            </p>
          </div>
          <SourceBadge
            mode={pappersConfigured ? "live" : "unconfigured"}
            providerName={pappersConfigured ? "PappersProvider" : undefined}
          />
        </div>
      </section>

      <AnalyzeWorkspacePanel
        selectedCheckId={selectedCheck?.id}
        initialEntries={selectedCheck?.decisionTrace.providerExchange ?? []}
        shouldFocusJournal={shouldFocusJournal}
      />

      {selectedCheck ? (
        <>
          <CheckDecisionCard check={selectedCheck} />
          <PdfExportCard checkId={selectedCheck.id} />
        </>
      ) : null}

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Historique personnel</p>
            <h2>Verifications du compte connecte</h2>
          </div>
        </div>
        <HistoryTable
          checks={recentChecks}
          emptyDescription="Les analyses de ce compte apparaitront ici apres soumission."
          linkHrefBuilder={(check) => `/verify?check=${check.id}`}
          selectedCheckId={selectedCheck?.id}
        />
      </section>
    </div>
  );
}
