import {
  type CompanyMatchCandidate,
  type DecisionEngineResult,
  type ProviderExchangeEntry,
  type RecommendedAction,
  type RiskLevel,
  type TriggeredRule,
  type VerificationInput,
} from "@/lib/credit-ops/types";
import { roundCurrencyStep } from "@/lib/utils";

interface DecisionEngineInput {
  request: VerificationInput;
  candidate: CompanyMatchCandidate;
  providerName: string;
  providerMode: "demo" | "live";
  providerTransport: string;
  providerWarnings: string[];
  providerExchange: ProviderExchangeEntry[];
}

function addRule(
  rules: TriggeredRule[],
  code: string,
  title: string,
  detail: string,
  outcome: string,
) {
  rules.push({
    code,
    title,
    detail,
    outcome,
  });
}

function estimateBaseCreditLimit(candidate: CompanyMatchCandidate) {
  const company = candidate.company;

  if (company.annualRevenue) {
    if (company.annualRevenue >= 20_000_000) {
      return 150_000;
    }

    if (company.annualRevenue >= 5_000_000) {
      return 60_000;
    }

    if (company.annualRevenue >= 1_000_000) {
      return 25_000;
    }

    if (company.annualRevenue >= 250_000) {
      return 10_000;
    }
  }

  if (company.capital) {
    if (company.capital >= 100_000) {
      return 20_000;
    }

    if (company.capital >= 20_000) {
      return 12_000;
    }

    if (company.capital >= 5_000) {
      return 7_500;
    }
  }

  const employeeRange = company.employeeRange?.toLowerCase() ?? "";
  if (
    employeeRange.includes("100") ||
    employeeRange.includes("250") ||
    employeeRange.includes("500")
  ) {
    return 20_000;
  }

  if (employeeRange.includes("50") || employeeRange.includes("20")) {
    return 12_500;
  }

  if (employeeRange.includes("10")) {
    return 8_000;
  }

  return 5_000;
}

function computeRiskScore(
  request: VerificationInput,
  candidate: CompanyMatchCandidate,
  providerWarnings: string[],
) {
  let riskScore = 10;
  const { company, establishment, matchConfidence } = candidate;

  if (company.status !== "active") {
    riskScore += 120;
  }

  if (company.procedureCollective) {
    riskScore += 70;
  }

  if (company.legalWarnings.length > 0) {
    riskScore += 20;
  }

  if (establishment.status !== "active") {
    riskScore += 35;
  }

  if (matchConfidence < 55) {
    riskScore += 20;
  }

  if (request.requestedPaymentTermDays > 45) {
    riskScore += 10;
  }

  if (providerWarnings.length > 0) {
    riskScore += 5;
  }

  return riskScore;
}

function riskLevelFromScore(riskScore: number): RiskLevel {
  if (riskScore >= 70) {
    return "high";
  }

  if (riskScore >= 30) {
    return "medium";
  }

  return "low";
}

function buildPaymentTerms(
  action: RecommendedAction,
  request: VerificationInput,
  riskLevel: RiskLevel,
) {
  if (action === "Refus") {
    return "Aucun délai recommandé";
  }

  if (action === "Revue manuelle") {
    return "À confirmer après revue crédit";
  }

  if (action === "Acompte demandé") {
    return "Acompte 50%, solde à 30 jours";
  }

  if (riskLevel === "medium") {
    return request.requestedPaymentTermDays <= 30
      ? `${request.requestedPaymentTermDays} jours`
      : "30 jours fin de mois";
  }

  return request.requestedPaymentTermDays <= 45
    ? `${request.requestedPaymentTermDays} jours`
    : "45 jours fin de mois";
}

function buildSuggestedCreditLimit(
  candidate: CompanyMatchCandidate,
  riskLevel: RiskLevel,
  baseCreditLimit: number,
) {
  const { company, establishment, matchConfidence } = candidate;

  if (company.status !== "active") {
    return 0;
  }

  let multiplier = 1;
  if (riskLevel === "medium") {
    multiplier = 0.65;
  }

  if (riskLevel === "high") {
    multiplier = 0.35;
  }

  if (company.procedureCollective) {
    multiplier *= 0.25;
  }

  if (establishment.status !== "active") {
    multiplier *= 0.4;
  }

  if (matchConfidence < 55) {
    multiplier *= 0.75;
  }

  return roundCurrencyStep(baseCreditLimit * multiplier);
}

export function runDecisionEngine({
  request,
  candidate,
  providerName,
  providerMode,
  providerTransport,
  providerWarnings,
  providerExchange,
}: DecisionEngineInput): DecisionEngineResult {
  const rules: TriggeredRule[] = [];
  const reasonCodes = new Set(
    candidate.matchSignals.map((signal) => signal.code),
  );

  if (providerMode === "demo") {
    reasonCodes.add("DEMO_MODE_ACTIVE");
  }

  if (providerWarnings.some((warning) => warning.includes("fallback"))) {
    reasonCodes.add("PAPPERS_FALLBACK");
  }

  const baseCreditLimit = estimateBaseCreditLimit(candidate);
  const riskScore = computeRiskScore(request, candidate, providerWarnings);
  const riskLevel = riskLevelFromScore(riskScore);
  const suggestedCreditLimit = buildSuggestedCreditLimit(
    candidate,
    riskLevel,
    baseCreditLimit,
  );
  const { company, establishment, matchConfidence } = candidate;

  let recommendedAction: RecommendedAction = "Conditions standard";
  let manualReviewRequired = false;

  if (company.status !== "active") {
    recommendedAction = "Refus";
    reasonCodes.add("COMPANY_INACTIVE");
    addRule(
      rules,
      "COMPANY_INACTIVE",
      "Société inactive",
      "La société retenue est inactive, radiée ou cessée.",
      "Refus immédiat",
    );
  } else if (company.procedureCollective) {
    reasonCodes.add("PROCEDURE_COLLECTIVE");
    if (suggestedCreditLimit > 0 && request.requestedAmount <= suggestedCreditLimit) {
      recommendedAction = "Acompte demandé";
      manualReviewRequired = true;
      addRule(
        rules,
        "PROCEDURE_COLLECTIVE",
        "Procédure collective",
        "Une procédure collective a été détectée.",
        "Décision prudente avec acompte et revue manuelle",
      );
    } else {
      recommendedAction = "Refus";
      addRule(
        rules,
        "PROCEDURE_COLLECTIVE",
        "Procédure collective",
        "Une procédure collective a été détectée et le montant demandé dépasse le niveau prudent.",
        "Refus",
      );
    }
  } else if (matchConfidence < 55) {
    recommendedAction = "Revue manuelle";
    manualReviewRequired = true;
    reasonCodes.add("MATCH_LOW_CONFIDENCE");
    addRule(
      rules,
      "MATCH_LOW_CONFIDENCE",
      "Matching faible",
      "La confiance de matching est trop faible pour automatiser la décision.",
      "Revue manuelle",
    );
  } else if (establishment.status !== "active") {
    recommendedAction = "Revue manuelle";
    manualReviewRequired = true;
    reasonCodes.add("ESTABLISHMENT_INACTIVE");
    addRule(
      rules,
      "ESTABLISHMENT_INACTIVE",
      "Établissement inactif",
      "L'établissement retenu n'est pas actif.",
      "Revue manuelle",
    );
  } else if (riskLevel === "high") {
    recommendedAction =
      request.requestedAmount <= suggestedCreditLimit
        ? "Acompte demandé"
        : "Revue manuelle";
    manualReviewRequired = true;
    reasonCodes.add("RISK_HIGH_PRUDENT_ACTION");
    addRule(
      rules,
      "RISK_HIGH_PRUDENT_ACTION",
      "Risque élevé",
      "Le niveau de risque impose une décision prudente.",
      recommendedAction,
    );
  } else if (
    suggestedCreditLimit > 0 &&
    request.requestedAmount > suggestedCreditLimit
  ) {
    recommendedAction = riskLevel === "low" ? "Plafond recommandé" : "Acompte demandé";
    reasonCodes.add("REQUESTED_AMOUNT_EXCEEDS_LIMIT");
    addRule(
      rules,
      "REQUESTED_AMOUNT_EXCEEDS_LIMIT",
      "Montant supérieur à la limite",
      "Le montant demandé dépasse la limite de crédit suggérée.",
      recommendedAction,
    );
  } else if (riskLevel === "medium") {
    recommendedAction = "Conditions standard";
    reasonCodes.add("RISK_MEDIUM_SHORT_TERMS");
    addRule(
      rules,
      "RISK_MEDIUM_SHORT_TERMS",
      "Risque moyen",
      "Le dossier reste acceptable avec des conditions raccourcies.",
      "Conditions standard avec délai ajusté",
    );
  } else {
    recommendedAction = "Conditions standard";
    reasonCodes.add("LOW_RISK_STANDARD_TERMS");
    addRule(
      rules,
      "LOW_RISK_STANDARD_TERMS",
      "Risque faible",
      "Le match est robuste et aucun signal majeur n'impose une restriction supplémentaire.",
      "Conditions standard",
    );
  }

  if (company.legalWarnings.length > 0) {
    reasonCodes.add("LEGAL_WARNING");
    addRule(
      rules,
      "LEGAL_WARNING",
      "Avertissements juridiques",
      company.legalWarnings.join(" | "),
      "Pris en compte dans le niveau de risque",
    );
  }

  const suggestedPaymentTerms = buildPaymentTerms(
    recommendedAction,
    request,
    riskLevel,
  );

  const humanExplanation = [
    `${company.legalName} (${establishment.siret}) est l'établissement recommandé avec ${matchConfidence}% de confiance.`,
    `Le risque est évalué comme ${riskLevel === "low" ? "faible" : riskLevel === "medium" ? "moyen" : "élevé"}.`,
    `Action recommandée : ${recommendedAction.toLowerCase()}.`,
    suggestedCreditLimit > 0
      ? `Limite de crédit suggérée : ${suggestedCreditLimit.toLocaleString("fr-FR")} EUR.`
      : "Aucune limite de crédit n'est recommandée.",
    `Conditions de paiement suggérées : ${suggestedPaymentTerms}.`,
  ].join(" ");

  const selectedCompany = {
    legalName: company.legalName,
    tradeName: company.tradeName,
    legalForm: company.legalForm,
    siren: company.siren,
    siret: establishment.siret,
    companyStatus: company.status,
    establishmentStatus: establishment.status,
    procedureCollective: company.procedureCollective,
    addressLine: establishment.addressLine,
    postalCode: establishment.postalCode,
    city: establishment.city,
    isHeadOffice: establishment.isHeadOffice,
    source: company.source,
    sourceUrl: company.sourceUrl,
  };

  return {
    recommendedAction,
    riskLevel,
    matchConfidence,
    suggestedCreditLimit,
    suggestedPaymentTerms,
    reasonCodes: [...reasonCodes],
    humanExplanation,
    manualReviewRequired,
    warnings: providerWarnings,
    decisionTrace: {
      candidateSummary: selectedCompany,
      providerName,
      providerMode,
      providerTransport,
      baseCreditLimit,
      adjustedCreditLimit: suggestedCreditLimit,
      riskScore,
      matchSignals: candidate.matchSignals,
      triggeredRules: rules,
      providerWarnings,
      providerExchange,
    },
  };
}
