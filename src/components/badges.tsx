import {
  type CompanyStatus,
  type EstablishmentStatus,
  type ProviderMode,
  type RecommendedAction,
  type RiskLevel,
} from "@/lib/credit-ops/types";
import { formatConfidenceLabel, formatRiskLevel } from "@/lib/utils";

function toneForAction(action: RecommendedAction) {
  switch (action) {
    case "Conditions standard":
      return "success";
    case "Plafond recommandé":
      return "warning";
    case "Acompte demandé":
      return "warning";
    case "Revue manuelle":
      return "neutral";
    case "Refus":
      return "danger";
    default:
      return "neutral";
  }
}

function toneForRisk(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "low":
      return "success";
    case "medium":
      return "warning";
    case "high":
      return "danger";
    default:
      return "neutral";
  }
}

function toneForConfidence(score: number) {
  if (score >= 80) {
    return "success";
  }

  if (score >= 55) {
    return "warning";
  }

  return "danger";
}

function toneForProviderMode(mode: ProviderMode) {
  return mode === "live" ? "info" : "neutral";
}

function toneForEntityStatus(status: CompanyStatus | EstablishmentStatus) {
  return status === "active" ? "success" : "danger";
}

export function Badge({
  tone,
  className,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral" | "info";
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${tone} ${className ?? ""}`.trim()}>{children}</span>;
}

export function RiskBadge({ value }: { value: RiskLevel }) {
  return <Badge tone={toneForRisk(value)}>{formatRiskLevel(value)}</Badge>;
}

export function ActionBadge({ value }: { value: RecommendedAction }) {
  return <Badge tone={toneForAction(value)}>{value}</Badge>;
}

export function ConfidenceBadge({ score }: { score: number }) {
  return (
    <Badge tone={toneForConfidence(score)}>
      {score}% • confiance {formatConfidenceLabel(score).toLowerCase()}
    </Badge>
  );
}

export function SourceBadge({
  mode,
  providerName,
}: {
  mode: ProviderMode | "unconfigured";
  providerName?: string;
}) {
  const liveLabel =
    providerName === "PappersProvider"
      ? "Source live · MCP Pappers"
      : `Live${providerName ? ` · ${providerName}` : ""}`;
  const label = mode === "live" ? liveLabel : "Source non configurée";

  return <Badge tone={mode === "live" ? toneForProviderMode(mode) : "neutral"}>{label}</Badge>;
}

export function EntityStatusBadge({
  label,
  status,
}: {
  label: string;
  status: CompanyStatus | EstablishmentStatus;
}) {
  const statusLabel = status === "active" ? "actif" : "inactif";

  return (
    <Badge className="badge-compact" tone={toneForEntityStatus(status)}>
      {label} · {statusLabel}
    </Badge>
  );
}
