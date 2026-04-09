import { describe, expect, it } from "vitest";

import { runDecisionEngine } from "@/lib/credit-ops/decision-engine";
import { buildMatchCandidate } from "@/lib/credit-ops/matching";
import {
  type CompanyProfile,
  type VerificationInput,
} from "@/lib/credit-ops/types";

const baseEstablishment = {
  siret: "53092761200019",
  label: "Atlas Fournitures France - Siège Paris",
  isHeadOffice: true,
  status: "active" as const,
  addressLine: "42 boulevard Haussmann",
  postalCode: "75009",
  city: "Paris",
};

const baseCompany: CompanyProfile = {
  siren: "530927612",
  legalName: "Atlas Fournitures France",
  tradeName: "Atlas Fournitures",
  legalForm: "SAS",
  status: "active",
  headOfficeSiret: baseEstablishment.siret,
  procedureCollective: false,
  legalWarnings: [],
  annualRevenue: 8_400_000,
  capital: 500_000,
  employeeRange: "50-99 salariés",
  source: "mock",
  establishments: [baseEstablishment],
};

function buildInput(overrides: Partial<VerificationInput> = {}): VerificationInput {
  return {
    companyName: "Atlas Fournitures France",
    sirenOrSiret: "53092761200019",
    address: "42 boulevard Haussmann",
    postalCode: "75009",
    city: "Paris",
    requestedAmount: 18_000,
    requestedPaymentTermDays: 45,
    commercialEntity: "Siège Paris",
    internalNotes: "Client stratégique.",
    ...overrides,
  };
}

function evaluateDecision({
  inputOverrides,
  companyOverrides,
  establishmentOverrides,
  providerWarnings = [],
}: {
  inputOverrides?: Partial<VerificationInput>;
  companyOverrides?: Partial<CompanyProfile>;
  establishmentOverrides?: Partial<CompanyProfile["establishments"][number]>;
  providerWarnings?: string[];
} = {}) {
  const establishment = {
    ...baseEstablishment,
    ...establishmentOverrides,
  };

  const company: CompanyProfile = {
    ...baseCompany,
    ...companyOverrides,
    establishments: [establishment],
  };

  const input = buildInput(inputOverrides);
  const candidate = buildMatchCandidate(input, company, establishment);

  return runDecisionEngine({
    request: input,
    candidate,
    providerName: "PappersProvider",
    providerMode: "live",
    providerTransport: "mcp-streamable-http",
    providerWarnings,
    providerExchange: [],
  });
}

describe("decision engine", () => {
  it("returns standard terms for strong match and low risk", () => {
    const decision = evaluateDecision({
      providerWarnings: [],
    });

    expect(decision.recommendedAction).toBe("Conditions standard");
    expect(decision.riskLevel).toBe("low");
    expect(decision.reasonCodes).toContain("LOW_RISK_STANDARD_TERMS");
  });

  it("requires manual review when match confidence is low", () => {
    const decision = evaluateDecision({
      inputOverrides: {
        companyName: "Client introuvable xyz",
        sirenOrSiret: undefined,
        address: undefined,
        postalCode: undefined,
        city: undefined,
        commercialEntity: undefined,
      },
      providerWarnings: [],
    });

    expect(decision.matchConfidence).toBeLessThan(55);
    expect(decision.recommendedAction).toBe("Revue manuelle");
    expect(decision.reasonCodes).toContain("MATCH_LOW_CONFIDENCE");
    expect(decision.manualReviewRequired).toBe(true);
  });

  it("refuses inactive or radiated companies", () => {
    const decision = evaluateDecision({
      companyOverrides: {
        status: "radiated",
        legalWarnings: ["Radiation RCS signalée"],
      },
      establishmentOverrides: {
        status: "inactive",
      },
      providerWarnings: [],
    });

    expect(decision.recommendedAction).toBe("Refus");
    expect(decision.suggestedCreditLimit).toBe(0);
    expect(decision.reasonCodes).toContain("COMPANY_INACTIVE");
  });

  it("returns a prudent deposit request for procedure collective with small amount", () => {
    const decision = evaluateDecision({
      companyOverrides: {
        procedureCollective: true,
        legalWarnings: ["Publication BODACC de procédure collective en cours"],
        annualRevenue: 2_200_000,
        capital: 70_000,
      },
      inputOverrides: {
        requestedAmount: 1_500,
      },
      providerWarnings: [],
    });

    expect(decision.recommendedAction).toBe("Acompte demandé");
    expect(decision.reasonCodes).toContain("PROCEDURE_COLLECTIVE");
  });

  it("refuses procedure collective when requested amount exceeds prudent limit", () => {
    const decision = evaluateDecision({
      companyOverrides: {
        procedureCollective: true,
        legalWarnings: ["Publication BODACC de procédure collective en cours"],
        annualRevenue: 2_200_000,
        capital: 70_000,
      },
      inputOverrides: {
        requestedAmount: 7_500,
      },
      providerWarnings: [],
    });

    expect(decision.recommendedAction).toBe("Refus");
  });

  it("recommends a ceiling when amount exceeds suggested limit on low risk", () => {
    const decision = evaluateDecision({
      inputOverrides: {
        requestedAmount: 95_000,
      },
      providerWarnings: [],
    });

    expect(decision.recommendedAction).toBe("Plafond recommandé");
    expect(decision.reasonCodes).toContain("REQUESTED_AMOUNT_EXCEEDS_LIMIT");
  });

  it("shortens payment terms when risk is medium", () => {
    const decision = evaluateDecision({
      companyOverrides: {
        legalWarnings: ["Dépôt des comptes incomplet"],
        annualRevenue: 940_000,
        capital: 20_000,
      },
      inputOverrides: {
        requestedAmount: 6_000,
        requestedPaymentTermDays: 60,
      },
      providerWarnings: [],
    });

    expect(decision.riskLevel).toBe("medium");
    expect(decision.recommendedAction).toBe("Conditions standard");
    expect(decision.suggestedPaymentTerms).toBe("30 jours fin de mois");
  });

  it("forces manual review when establishment is inactive even if company is active", () => {
    const decision = evaluateDecision({
      establishmentOverrides: {
        status: "inactive",
      },
      providerWarnings: [],
    });

    expect(decision.recommendedAction).toBe("Revue manuelle");
    expect(decision.reasonCodes).toContain("ESTABLISHMENT_INACTIVE");
  });
});
