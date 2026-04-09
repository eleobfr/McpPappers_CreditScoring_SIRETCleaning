export const REASON_CODE_LABELS: Record<string, string> = {
  MATCH_SIRET_EXACT: "SIRET fourni identique à l'établissement retenu",
  MATCH_SIREN_EXACT: "SIREN fourni identique à l'entité légale retenue",
  MATCH_NAME_STRONG: "Raison sociale très proche",
  MATCH_NAME_PARTIAL: "Raison sociale partiellement concordante",
  MATCH_ADDRESS_STRONG: "Adresse cohérente avec l'établissement retenu",
  MATCH_POSTAL_CODE: "Code postal cohérent",
  MATCH_CITY: "Ville cohérente",
  MATCH_COMMERCIAL_ENTITY: "Entité commerciale cohérente",
  MATCH_LOW_CONFIDENCE: "Confiance de matching insuffisante",
  COMPANY_INACTIVE: "Société inactive, radiée ou cessée",
  ESTABLISHMENT_INACTIVE: "Établissement identifié comme inactif",
  PROCEDURE_COLLECTIVE: "Procédure collective ou signal juridique majeur",
  LEGAL_WARNING: "Avertissements juridiques détectés",
  REQUESTED_AMOUNT_EXCEEDS_LIMIT:
    "Montant demandé supérieur à la limite suggérée",
  RISK_MEDIUM_SHORT_TERMS: "Risque moyen géré par conditions raccourcies",
  RISK_HIGH_PRUDENT_ACTION: "Risque élevé nécessitant une décision prudente",
  LOW_RISK_STANDARD_TERMS: "Risque faible et matching robuste",
  DEMO_MODE_ACTIVE: "Mode démo actif",
  PAPPERS_FALLBACK: "Fallback mock après indisponibilité provider live",
};

export function getReasonLabel(code: string) {
  return REASON_CODE_LABELS[code] ?? code;
}
