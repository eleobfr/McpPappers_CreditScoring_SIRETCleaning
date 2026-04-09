import { compactText } from "@/lib/utils";

const KNOWN_COMPANY_ALIASES: Record<string, string> = {
  edf: "Electricite de France",
};

function normalizeAliasKey(value: string) {
  return compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function resolveKnownCompanyAlias(companyName: string) {
  const normalizedKey = normalizeAliasKey(companyName);
  const expandedName = KNOWN_COMPANY_ALIASES[normalizedKey];

  return {
    normalizedKey,
    expandedName,
    wasExpanded: Boolean(expandedName),
    searchName: expandedName ?? companyName,
  };
}
