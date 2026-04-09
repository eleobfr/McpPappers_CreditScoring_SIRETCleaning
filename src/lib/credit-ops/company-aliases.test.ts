import { describe, expect, it } from "vitest";

import { resolveKnownCompanyAlias } from "@/lib/credit-ops/company-aliases";

describe("company aliases", () => {
  it("expands EDF to Electricite de France", () => {
    const result = resolveKnownCompanyAlias("edf");

    expect(result.wasExpanded).toBe(true);
    expect(result.searchName).toBe("Electricite de France");
  });

  it("keeps unknown company names unchanged", () => {
    const result = resolveKnownCompanyAlias("Atlas Fournitures France");

    expect(result.wasExpanded).toBe(false);
    expect(result.searchName).toBe("Atlas Fournitures France");
  });
});
