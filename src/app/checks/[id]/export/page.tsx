import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ActionBadge,
  ConfidenceBadge,
  RiskBadge,
  SourceBadge,
} from "@/components/badges";
import { PdfReportActions } from "@/components/pdf-report-actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getVerificationCheckForUser } from "@/lib/credit-ops/check-service";
import { getReasonLabel } from "@/lib/credit-ops/reason-codes";
import {
  formatConfidenceLabel,
  formatCurrency,
  formatDateTime,
  formatIdentifier,
  formatRiskLevel,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rapport de décision crédit | Credit Ops",
  description:
    "Rapport premium imprimable pour décision crédit, exploitation finance et partage client.",
};

export default async function CreditDecisionReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    notFound();
  }

  const { id } = await params;
  const query = await searchParams;
  const check = getVerificationCheckForUser(user.id, id);

  if (!check) {
    notFound();
  }

  const finalAction = check.override?.action ?? check.recommendedAction;
  const finalReason = check.override?.reason;
  const autoPrint = query.print === "1";
  const riskToneClass =
    check.riskLevel === "high"
      ? "is-danger"
      : check.riskLevel === "medium"
        ? "is-warning"
        : "is-success";
  const confidenceToneClass =
    check.matchConfidence >= 80
      ? "is-success"
      : check.matchConfidence >= 55
        ? "is-warning"
        : "is-danger";

  return (
    <div className="pdf-report-shell">
      <div className="pdf-report-page">
        <PdfReportActions autoPrint={autoPrint} checkId={check.id} />

        <section className="pdf-cover">
          <div className="pdf-cover-top">
            <div>
              <p className="eyebrow">Rapport de décision crédit</p>
              <h1>{check.selectedCompany.legalName}</h1>
              <p className="pdf-cover-subtitle">
                Vérification client avant facturation · dossier généré le{" "}
                {formatDateTime(check.createdAt)}
              </p>
            </div>
            <SourceBadge mode={check.providerMode} providerName={check.providerName} />
          </div>

          <div className="pdf-cover-highlight">
            <div className="stack-sm">
              <span className="pdf-kicker">Décision recommandée</span>
              <h2>{finalAction}</h2>
              <p>{check.humanExplanation}</p>
            </div>

            <div className="badge-row">
              <ActionBadge value={finalAction} />
              <RiskBadge value={check.riskLevel} />
              <ConfidenceBadge score={check.matchConfidence} />
            </div>
          </div>

          <div className="pdf-cover-metrics">
            <article className="pdf-metric-card">
              <span className="pdf-metric-label">Limite suggérée</span>
              <strong>{formatCurrency(check.suggestedCreditLimit)}</strong>
              <span>{check.suggestedPaymentTerms}</span>
            </article>
            <article className="pdf-metric-card">
              <span className="pdf-metric-label">SIREN / SIRET retenu</span>
              <strong>{formatIdentifier(check.selectedCompany.siret)}</strong>
              <span>{formatIdentifier(check.selectedCompany.siren)}</span>
            </article>
            <article className="pdf-metric-card">
              <span className="pdf-metric-label">Confiance du matching</span>
              <strong>{check.matchConfidence}%</strong>
              <span>{formatConfidenceLabel(check.matchConfidence)}</span>
            </article>
          </div>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">1. Synthèse exécutive</p>
              <h2>Lecture rapide pour décision immédiate</h2>
            </div>
          </div>

          <div className="pdf-summary-grid">
            <article className="pdf-summary-card">
              <span className="pdf-summary-label">Action</span>
              <strong>{finalAction}</strong>
              <p>{check.manualReviewRequired ? "Validation manuelle recommandée." : "Décision exploitable rapidement."}</p>
            </article>
            <article className="pdf-summary-card">
              <span className="pdf-summary-label">Risque</span>
              <strong>{formatRiskLevel(check.riskLevel)}</strong>
              <div className={`pdf-meter ${riskToneClass}`}>
                <span style={{ width: check.riskLevel === "high" ? "100%" : check.riskLevel === "medium" ? "66%" : "34%" }} />
              </div>
            </article>
            <article className="pdf-summary-card">
              <span className="pdf-summary-label">Matching</span>
              <strong>{check.matchConfidence}%</strong>
              <div className={`pdf-meter ${confidenceToneClass}`}>
                <span style={{ width: `${check.matchConfidence}%` }} />
              </div>
            </article>
          </div>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">2. Identification entreprise</p>
              <h2>Entité recommandée à facturer</h2>
            </div>
          </div>

          <div className="pdf-info-grid">
            <article className="pdf-info-card">
              <h3>Entreprise retenue</h3>
              <dl className="pdf-definition-list">
                <div>
                  <dt>Raison sociale</dt>
                  <dd>{check.selectedCompany.legalName}</dd>
                </div>
                <div>
                  <dt>SIREN</dt>
                  <dd>{formatIdentifier(check.selectedCompany.siren)}</dd>
                </div>
                <div>
                  <dt>SIRET</dt>
                  <dd>{formatIdentifier(check.selectedCompany.siret)}</dd>
                </div>
                <div>
                  <dt>Adresse</dt>
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
            </article>

            <article className="pdf-info-card">
              <h3>Entrée du dossier</h3>
              <dl className="pdf-definition-list">
                <div>
                  <dt>Raison sociale saisie</dt>
                  <dd>{check.input.companyName}</dd>
                </div>
                <div>
                  <dt>SIREN / SIRET fourni</dt>
                  <dd>{check.input.sirenOrSiret || "Non fourni"}</dd>
                </div>
                <div>
                  <dt>Montant demandé</dt>
                  <dd>{formatCurrency(check.input.requestedAmount)}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">3. Analyse de risque</p>
              <h2>Signaux déclencheurs et avertissements</h2>
            </div>
          </div>

          <div className="pdf-columns">
            <article className="pdf-info-card">
              <h3>Signaux majeurs</h3>
              <div className="pdf-signal-list">
                {check.reasonCodes.map((reasonCode) => (
                  <div className="pdf-signal-item" key={reasonCode}>
                    <span className="pdf-signal-dot" />
                    <div className="stack-sm">
                      <strong>{getReasonLabel(reasonCode)}</strong>
                      <p>Rule code exposé dans la trace de décision.</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="pdf-info-card">
              <h3>Avertissements</h3>
              {check.warnings.length ? (
                <ul className="plain-list">
                  {check.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted-text">Aucun avertissement complémentaire remonté.</p>
              )}
            </article>
          </div>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">4. Analyse crédit</p>
              <h2>Exposition, capacité recommandée et conditions</h2>
            </div>
          </div>

          <div className="pdf-summary-grid">
            <article className="pdf-summary-card">
              <span className="pdf-summary-label">Montant demandé</span>
              <strong>{formatCurrency(check.input.requestedAmount)}</strong>
              <p>Montant analysé dans le dossier de vérification.</p>
            </article>
            <article className="pdf-summary-card">
              <span className="pdf-summary-label">Limite suggérée</span>
              <strong>{formatCurrency(check.suggestedCreditLimit)}</strong>
              <p>Plafond calculé par le moteur de décision.</p>
            </article>
            <article className="pdf-summary-card">
              <span className="pdf-summary-label">Conditions</span>
              <strong>{check.suggestedPaymentTerms}</strong>
              <p>Conditions de paiement recommandées pour l&apos;exploitation.</p>
            </article>
          </div>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">5. Recommandation opérationnelle</p>
              <h2>Consigne pour finance, ADV et credit management</h2>
            </div>
          </div>

          <article className="pdf-recommendation-card">
            <div className="stack-sm">
              <span className="pdf-kicker">Action à exécuter</span>
              <h3>{finalAction}</h3>
            </div>
            <p>{check.humanExplanation}</p>
            {finalReason ? (
              <div className="pdf-override-note">
                <strong>Override manuel enregistré :</strong> {finalReason}
              </div>
            ) : null}
          </article>
        </section>

        <section className="pdf-section">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">6. Trace de décision</p>
              <h2>Règles déclenchées et échanges provider</h2>
            </div>
          </div>

          <div className="pdf-columns">
            <article className="pdf-info-card">
              <h3>Règles métier</h3>
              <div className="pdf-rule-list">
                {check.decisionTrace.triggeredRules.map((rule) => (
                  <div className="pdf-rule-item" key={rule.code}>
                    <strong>{rule.title}</strong>
                    <p>{rule.detail}</p>
                    <span>{rule.outcome}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="pdf-info-card">
              <h3>Journal MCP</h3>
              <div className="pdf-trace-list">
                {check.decisionTrace.providerExchange.map((entry) => (
                  <div className="pdf-trace-item" key={entry.id}>
                    <strong>{entry.toolName}</strong>
                    <p>{entry.summary}</p>
                    <span>
                      {entry.status} · {formatDateTime(entry.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="pdf-section pdf-mentions">
          <div className="pdf-section-heading">
            <div>
              <p className="eyebrow">7. Mentions</p>
              <h2>Cadre d&apos;usage</h2>
            </div>
          </div>

          <div className="pdf-mentions-card">
            <p>
              Rapport généré par Credit Ops à partir d&apos;un contrôle daté du{" "}
              {formatDateTime(check.createdAt)}. Ce document constitue un outil d&apos;aide
              à la décision destiné aux équipes finance, ADV et credit management.
            </p>
            <p>
              Source de données : {check.providerName} en mode {check.providerMode}. La
              décision finale reste sous la responsabilité de l&apos;entreprise utilisatrice.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
