import {
  ActionBadge,
  ConfidenceBadge,
  EntityStatusBadge,
  RiskBadge,
  SourceBadge,
} from "@/components/badges";
import { getReasonLabel } from "@/lib/credit-ops/reason-codes";
import { type VerificationCheckRecord } from "@/lib/credit-ops/types";
import {
  formatCurrency,
  formatDateTime,
  formatIdentifier,
} from "@/lib/utils";

export function CheckDecisionCard({ check }: { check: VerificationCheckRecord }) {
  const finalAction = check.override?.action ?? check.recommendedAction;

  return (
    <section className="decision-spotlight">
      <div className="decision-main stack-lg">
        <div className="decision-heading">
          <div className="stack-sm">
            <p className="eyebrow">Décision recommandée</p>
            <h2 className="decision-title">{finalAction}</h2>
            <p className="decision-copy">{check.humanExplanation}</p>
          </div>

          <div className="badge-row">
            <ActionBadge value={finalAction} />
            <RiskBadge value={check.riskLevel} />
            <ConfidenceBadge score={check.matchConfidence} />
          </div>
        </div>

        <div className="decision-meta">
          <SourceBadge mode={check.providerMode} providerName={check.providerName} />
          <EntityStatusBadge
            label="Société"
            status={check.selectedCompany.companyStatus}
          />
          <EntityStatusBadge
            label="Établissement"
            status={check.selectedCompany.establishmentStatus}
          />
        </div>

        {check.manualReviewRequired ? (
          <div className="decision-alert decision-alert-warning">
            Cette vérification nécessite une revue manuelle avant validation finale.
          </div>
        ) : (
          <div className="decision-alert decision-alert-success">
            Décision suffisamment cadrée pour être exploitée rapidement par la
            finance et l&apos;ADV.
          </div>
        )}

        <div className="signal-stack">
          {check.reasonCodes.slice(0, 3).map((reasonCode) => (
            <article className="signal-item signal-neutral" key={reasonCode}>
              <div className="signal-marker" />
              <div className="stack-sm">
                <strong>{getReasonLabel(reasonCode)}</strong>
                <p>Reason code exposé dans la trace de décision pour audit et partage.</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="decision-side stack-lg">
        <div className="score-grid">
          <article className="score-card">
            <span className="score-label">Entité recommandée</span>
            <strong>{check.selectedCompany.legalName}</strong>
            <span className="score-meta">
              {check.selectedCompany.isHeadOffice ? "Siège à facturer" : "Établissement à facturer"}
            </span>
          </article>
          <article className="score-card">
            <span className="score-label">SIREN / SIRET retenu</span>
            <strong>{formatIdentifier(check.selectedCompany.siret)}</strong>
            <span className="score-meta">{formatIdentifier(check.selectedCompany.siren)}</span>
          </article>
          <article className="score-card">
            <span className="score-label">Limite suggérée</span>
            <strong>{formatCurrency(check.suggestedCreditLimit)}</strong>
            <span className="score-meta">{check.suggestedPaymentTerms}</span>
          </article>
          <article className="score-card">
            <span className="score-label">Analyse horodatée</span>
            <strong>{formatDateTime(check.createdAt)}</strong>
            <span className="score-meta">Trace partagée et exportable</span>
          </article>
        </div>

        <section className="data-panel stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Entrée analysée</p>
            <h3>Données du dossier</h3>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Raison sociale</dt>
              <dd>{check.input.companyName}</dd>
            </div>
            <div>
              <dt>Montant demandé</dt>
              <dd>{formatCurrency(check.input.requestedAmount)}</dd>
            </div>
            <div>
              <dt>Adresse récupérée automatiquement</dt>
              <dd>
                {check.selectedCompany.addressLine || "Non renseignée"}
                {check.selectedCompany.postalCode || check.selectedCompany.city
                  ? `, ${[check.selectedCompany.postalCode, check.selectedCompany.city]
                      .filter(Boolean)
                      .join(" ")}`
                  : ""}
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </section>
  );
}
