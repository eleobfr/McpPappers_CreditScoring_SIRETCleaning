import {
  type CompanyEstablishment,
  type CompanyMatchCandidate,
  type CompanyProfile,
  type MatchSignal,
  type VerificationInput,
} from "@/lib/credit-ops/types";
import { resolveKnownCompanyAlias } from "@/lib/credit-ops/company-aliases";
import { clamp, compactText, digitsOnly } from "@/lib/utils";

const STOP_WORDS = new Set([
  "sa",
  "sas",
  "sasu",
  "sarl",
  "eurl",
  "societe",
  "groupe",
  "group",
  "les",
  "des",
  "de",
  "du",
  "et",
  "la",
  "le",
]);

function normalizeText(value?: string) {
  return compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value?: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.length < 2 || right.length < 2) {
    return left === right ? 1 : 0;
  }

  const pairs = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }

  let matches = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      matches += 1;
    }
  }

  return (2 * matches) / (left.length + right.length - 2);
}

function tokenOverlapScore(left: string[], right: string[]) {
  if (!left.length || !right.length) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;

  leftSet.forEach((token) => {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftSet.size, rightSet.size);
}

function getNameVariants(company: CompanyProfile, establishment: CompanyEstablishment) {
  return [company.legalName, company.tradeName, establishment.label].filter(
    (value): value is string => Boolean(value),
  );
}

function getBestNameMatchScore(inputName: string, variants: string[]) {
  const resolvedInputName = resolveKnownCompanyAlias(inputName).searchName;
  const normalizedInput = normalizeText(resolvedInputName);
  const inputTokens = tokenize(resolvedInputName);

  return variants.reduce((best, variant) => {
    const normalizedVariant = normalizeText(variant);
    const variantTokens = tokenize(variant);
    const score = Math.max(
      diceCoefficient(normalizedInput, normalizedVariant),
      tokenOverlapScore(inputTokens, variantTokens),
    );

    return Math.max(best, score);
  }, 0);
}

function pushSignal(signals: MatchSignal[], signal: MatchSignal) {
  signals.push(signal);
}

export function buildMatchCandidate(
  input: VerificationInput,
  company: CompanyProfile,
  establishment: CompanyEstablishment,
): CompanyMatchCandidate {
  const signals: MatchSignal[] = [];
  let score = 0;
  const identifier = digitsOnly(input.sirenOrSiret);

  if (identifier.length === 14 && identifier === establishment.siret) {
    score += 55;
    pushSignal(signals, {
      code: "MATCH_SIRET_EXACT",
      label: "SIRET exact fourni par l'utilisateur",
      score: 55,
      kind: "positive",
    });
  } else if (identifier.length === 9 && identifier === company.siren) {
    score += 40;
    pushSignal(signals, {
      code: "MATCH_SIREN_EXACT",
      label: "SIREN exact fourni par l'utilisateur",
      score: 40,
      kind: "positive",
    });
  }

  const nameScore = getBestNameMatchScore(
    input.companyName,
    getNameVariants(company, establishment),
  );

  if (nameScore >= 0.9) {
    score += 30;
    pushSignal(signals, {
      code: "MATCH_NAME_STRONG",
      label: "Très forte proximité de raison sociale",
      score: 30,
      kind: "positive",
    });
  } else if (nameScore >= 0.65) {
    score += 18;
    pushSignal(signals, {
      code: "MATCH_NAME_PARTIAL",
      label: "Proximité partielle de raison sociale",
      score: 18,
      kind: "positive",
    });
  } else if (nameScore >= 0.45) {
    score += 8;
    pushSignal(signals, {
      code: "MATCH_NAME_PARTIAL",
      label: "Correspondance faible de raison sociale",
      score: 8,
      kind: "warning",
    });
  }

  const establishmentAddress = normalizeText(establishment.addressLine);
  if (input.address) {
    const inputAddress = normalizeText(input.address);
    const addressSimilarity = Math.max(
      diceCoefficient(inputAddress, establishmentAddress),
      tokenOverlapScore(tokenize(input.address), tokenize(establishment.addressLine)),
    );

    if (addressSimilarity >= 0.7) {
      score += 10;
      pushSignal(signals, {
        code: "MATCH_ADDRESS_STRONG",
        label: "Adresse cohérente avec l'établissement",
        score: 10,
        kind: "positive",
      });
    } else if (addressSimilarity >= 0.45) {
      score += 5;
      pushSignal(signals, {
        code: "MATCH_ADDRESS_STRONG",
        label: "Adresse partiellement cohérente",
        score: 5,
        kind: "warning",
      });
    }
  }

  if (
    input.postalCode &&
    establishment.postalCode &&
    normalizeText(input.postalCode) === normalizeText(establishment.postalCode)
  ) {
    score += 8;
    pushSignal(signals, {
      code: "MATCH_POSTAL_CODE",
      label: "Code postal cohérent",
      score: 8,
      kind: "positive",
    });
  }

  if (
    input.city &&
    establishment.city &&
    normalizeText(input.city) === normalizeText(establishment.city)
  ) {
    score += 6;
    pushSignal(signals, {
      code: "MATCH_CITY",
      label: "Ville cohérente",
      score: 6,
      kind: "positive",
    });
  }

  if (input.commercialEntity) {
    const entityScore = getBestNameMatchScore(input.commercialEntity, [
      establishment.label,
      company.tradeName ?? "",
    ]);

    if (entityScore >= 0.65) {
      score += 4;
      pushSignal(signals, {
        code: "MATCH_COMMERCIAL_ENTITY",
        label: "Entité commerciale proche du site retenu",
        score: 4,
        kind: "positive",
      });
    }
  }

  if (company.status !== "active") {
    score -= 20;
    pushSignal(signals, {
      code: "COMPANY_INACTIVE",
      label: "Société non active",
      score: -20,
      kind: "negative",
    });
  }

  if (establishment.status !== "active") {
    score -= 10;
    pushSignal(signals, {
      code: "ESTABLISHMENT_INACTIVE",
      label: "Établissement non actif",
      score: -10,
      kind: "negative",
    });
  }

  const matchConfidence = clamp(Math.round(score), 0, 100);
  const rankingScore =
    matchConfidence +
    (company.status === "active" ? 5 : -15) +
    (establishment.status === "active" ? 5 : -10) +
    (company.procedureCollective ? -20 : 0);

  return {
    company,
    establishment,
    matchConfidence,
    matchSignals: signals,
    rankingScore,
  };
}

export function buildRankedCandidates(
  input: VerificationInput,
  companies: CompanyProfile[],
) {
  return companies
    .flatMap((company) =>
      company.establishments.map((establishment) =>
        buildMatchCandidate(input, company, establishment),
      ),
    )
    .sort((left, right) => {
      if (right.rankingScore !== left.rankingScore) {
        return right.rankingScore - left.rankingScore;
      }

      return right.matchConfidence - left.matchConfidence;
    });
}
