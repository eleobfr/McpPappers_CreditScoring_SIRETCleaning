import { describe, expect, it } from "vitest";

import { buildRankedCandidates } from "@/lib/credit-ops/matching";
import {
  type CompanyProfile,
  type VerificationInput,
} from "@/lib/credit-ops/types";

const company: CompanyProfile = {
  siren: "530927612",
  legalName: "Atlas Fournitures France",
  tradeName: "Atlas Fournitures",
  legalForm: "SAS",
  status: "active",
  headOfficeSiret: "53092761200019",
  procedureCollective: false,
  legalWarnings: [],
  annualRevenue: 8_400_000,
  capital: 500_000,
  employeeRange: "50-99 salariés",
  source: "mock",
  establishments: [
    {
      siret: "53092761200019",
      label: "Atlas Fournitures France - Siège Paris",
      isHeadOffice: true,
      status: "active",
      addressLine: "42 boulevard Haussmann",
      postalCode: "75009",
      city: "Paris",
    },
    {
      siret: "53092761200027",
      label: "Atlas Fournitures France - Hub Lyon",
      isHeadOffice: false,
      status: "active",
      addressLine: "18 avenue des Frères Lumière",
      postalCode: "69008",
      city: "Lyon",
    },
  ],
};

describe("matching", () => {
  it("prefers an exact SIRET match", () => {
    const input: VerificationInput = {
      companyName: "Atlas Fournitures France",
      sirenOrSiret: "53092761200027",
      requestedAmount: 10_000,
      requestedPaymentTermDays: 30,
      city: "Lyon",
      postalCode: "69008",
    };

    const candidates = buildRankedCandidates(input, [company]);

    expect(candidates[0]?.establishment.siret).toBe("53092761200027");
    expect(candidates[0]?.matchSignals.map((signal) => signal.code)).toContain(
      "MATCH_SIRET_EXACT",
    );
  });

  it("uses postal code and city as positive match signals", () => {
    const input: VerificationInput = {
      companyName: "Atlas Fournitures France",
      requestedAmount: 10_000,
      requestedPaymentTermDays: 30,
      city: "Paris",
      postalCode: "75009",
    };

    const candidates = buildRankedCandidates(input, [company]);
    const codes = candidates[0]?.matchSignals.map((signal) => signal.code) ?? [];

    expect(codes).toContain("MATCH_POSTAL_CODE");
    expect(codes).toContain("MATCH_CITY");
  });
});
