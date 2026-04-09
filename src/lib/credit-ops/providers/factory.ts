import { hasPappersMcpConfigured } from "@/lib/env";
import { PappersProvider } from "@/lib/credit-ops/providers/pappers-provider";
import { type CompanyDataProvider } from "@/lib/credit-ops/types";

export function createCompanyDataProvider(): CompanyDataProvider {
  if (!hasPappersMcpConfigured()) {
    throw new Error(
      "Pappers MCP n'est pas configuré. Définissez PAPPERS_MCP_URL pour lancer une analyse.",
    );
  }

  return new PappersProvider();
}
