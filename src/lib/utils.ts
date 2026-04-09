import {
  type RecommendedAction,
  type RiskLevel,
} from "@/lib/credit-ops/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export function formatRiskLevel(value: RiskLevel) {
  switch (value) {
    case "low":
      return "Faible";
    case "medium":
      return "Moyen";
    case "high":
      return "Élevé";
    default:
      return value;
  }
}

export function formatRecommendedAction(value: RecommendedAction) {
  return value;
}

export function formatConfidenceLabel(score: number) {
  if (score >= 80) {
    return "Forte";
  }

  if (score >= 55) {
    return "Modérée";
  }

  return "Faible";
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function roundCurrencyStep(value: number, step = 500) {
  return Math.max(0, Math.round(value / step) * step);
}

export function compactText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

export function formatIdentifier(value?: string) {
  if (!value) {
    return "Non renseigné";
  }

  if (value.length === 14) {
    return `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(
      6,
      9,
    )} ${value.slice(9)}`;
  }

  if (value.length === 9) {
    return `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}`;
  }

  return value;
}

export function digitsOnly(value?: string) {
  return value?.replace(/\D/g, "") || "";
}
