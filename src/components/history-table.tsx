import Link from "next/link";

import {
  ActionBadge,
  ConfidenceBadge,
  RiskBadge,
  SourceBadge,
} from "@/components/badges";
import { type VerificationCheckRecord } from "@/lib/credit-ops/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export function HistoryTable({
  checks,
  emptyTitle = "Aucune vérification enregistrée",
  emptyDescription = "Lance une première analyse pour alimenter l'historique.",
  linkHrefBuilder,
  selectedCheckId,
}: {
  checks: VerificationCheckRecord[];
  emptyTitle?: string;
  emptyDescription?: string;
  linkHrefBuilder?: (check: VerificationCheckRecord) => string;
  selectedCheckId?: string;
}) {
  if (!checks.length) {
    return (
      <div className="empty-state">
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Dossier</th>
            <th>Décision</th>
            <th>Risque</th>
            <th>Confiance</th>
            <th>Exposition</th>
            <th>Source</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr
              className={selectedCheckId === check.id ? "is-selected" : ""}
              key={check.id}
            >
              <td>
                <div className="table-primary">
                  <Link
                    className="table-link"
                    href={linkHrefBuilder ? linkHrefBuilder(check) : `/checks/${check.id}`}
                  >
                    {check.input.companyName}
                  </Link>
                  <div className="table-meta">
                    <span>{check.selectedCompany.legalName}</span>
                    <span>{check.selectedCompany.siret}</span>
                  </div>
                </div>
                {check.override ? (
                  <div className="table-inline-note">Override manuel enregistré</div>
                ) : null}
              </td>
              <td>
                <ActionBadge value={check.override?.action ?? check.recommendedAction} />
              </td>
              <td>
                <RiskBadge value={check.riskLevel} />
              </td>
              <td>
                <ConfidenceBadge score={check.matchConfidence} />
              </td>
              <td>
                <div className="table-amount">
                  <strong>{formatCurrency(check.input.requestedAmount)}</strong>
                  <span>Limite {formatCurrency(check.suggestedCreditLimit)}</span>
                </div>
              </td>
              <td>
                <SourceBadge mode={check.providerMode} providerName={check.providerName} />
              </td>
              <td>
                <div className="table-date">
                  <strong>{formatDateTime(check.createdAt)}</strong>
                  <span>{check.manualReviewRequired ? "Revue requise" : "Décision exploitable"}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
