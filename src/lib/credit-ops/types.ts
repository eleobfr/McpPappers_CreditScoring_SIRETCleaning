export const RECOMMENDED_ACTIONS = [
  "Conditions standard",
  "Plafond recommandé",
  "Acompte demandé",
  "Revue manuelle",
  "Refus",
] as const;

export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type ProviderMode = "demo" | "live";
export type DataSource = "mock" | "pappers";
export type CompanyStatus = "active" | "inactive" | "ceased" | "radiated";
export type EstablishmentStatus = "active" | "inactive";

export interface VerificationInput {
  companyName: string;
  sirenOrSiret?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  requestedAmount: number;
  requestedPaymentTermDays: number;
  commercialEntity?: string;
  internalNotes?: string;
}

export interface ManualOverride {
  action: RecommendedAction;
  reason: string;
  createdAt: string;
}

export interface CompanyEstablishment {
  siret: string;
  label: string;
  isHeadOffice: boolean;
  status: EstablishmentStatus;
  addressLine?: string;
  postalCode?: string;
  city?: string;
}

export interface CompanyProfile {
  siren: string;
  legalName: string;
  tradeName?: string;
  legalForm?: string;
  status: CompanyStatus;
  headOfficeSiret?: string;
  procedureCollective: boolean;
  legalWarnings: string[];
  annualRevenue?: number;
  capital?: number;
  employeeRange?: string;
  establishments: CompanyEstablishment[];
  source: DataSource;
  sourceUrl?: string;
  updatedAt?: string;
  raw?: unknown;
}

export interface MatchSignal {
  code: string;
  label: string;
  score: number;
  kind: "positive" | "warning" | "negative";
}

export interface CompanyMatchCandidate {
  company: CompanyProfile;
  establishment: CompanyEstablishment;
  matchConfidence: number;
  matchSignals: MatchSignal[];
  rankingScore: number;
}

export interface SelectedCompanySummary {
  legalName: string;
  tradeName?: string;
  legalForm?: string;
  siren: string;
  siret: string;
  companyStatus: CompanyStatus;
  establishmentStatus: EstablishmentStatus;
  procedureCollective: boolean;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  isHeadOffice: boolean;
  source: DataSource;
  sourceUrl?: string;
}

export interface TriggeredRule {
  code: string;
  title: string;
  detail: string;
  outcome: string;
}

export interface ProviderExchangeEntry {
  id: string;
  transport: "mcp-streamable-http" | "orchestration";
  toolName: string;
  status: "success" | "error" | "info";
  startedAt: string;
  completedAt?: string;
  summary: string;
  requestPayload: unknown;
  responsePayload?: unknown;
  note?: string;
}

export interface DecisionTrace {
  candidateSummary: SelectedCompanySummary;
  providerName: string;
  providerMode: ProviderMode;
  providerTransport: string;
  baseCreditLimit: number;
  adjustedCreditLimit: number;
  riskScore: number;
  matchSignals: MatchSignal[];
  triggeredRules: TriggeredRule[];
  providerWarnings: string[];
  providerExchange: ProviderExchangeEntry[];
}

export interface DecisionEngineResult {
  recommendedAction: RecommendedAction;
  riskLevel: RiskLevel;
  matchConfidence: number;
  suggestedCreditLimit: number;
  suggestedPaymentTerms: string;
  reasonCodes: string[];
  humanExplanation: string;
  manualReviewRequired: boolean;
  warnings: string[];
  decisionTrace: DecisionTrace;
}

export interface VerificationCheckRecord extends DecisionEngineResult {
  id: string;
  input: VerificationInput;
  selectedCompany: SelectedCompanySummary;
  providerName: string;
  providerMode: ProviderMode;
  createdAt: string;
  updatedAt: string;
  override?: ManualOverride | null;
}

export interface CompanyLookupResult {
  providerName: string;
  providerMode: ProviderMode;
  providerTransport: string;
  warnings: string[];
  providerExchange: ProviderExchangeEntry[];
  companies: CompanyProfile[];
}

export interface CompanyDataProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  searchCompanies(input: VerificationInput): Promise<CompanyLookupResult>;
}
