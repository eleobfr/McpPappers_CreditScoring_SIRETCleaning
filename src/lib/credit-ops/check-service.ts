import { randomUUID } from "node:crypto";

import { runDecisionEngine } from "@/lib/credit-ops/decision-engine";
import { buildRankedCandidates } from "@/lib/credit-ops/matching";
import { createCompanyDataProvider } from "@/lib/credit-ops/providers/factory";
import { PappersProvider } from "@/lib/credit-ops/providers/pappers-provider";
import {
  type ManualOverride,
  type ProviderExchangeEntry,
  type VerificationCheckRecord,
  type VerificationInput,
} from "@/lib/credit-ops/types";
import { logEvent } from "@/lib/logger";
import {
  insertCheck,
  listChecksByUser,
  saveManualOverride,
  getCheckByIdForUser,
} from "@/lib/persistence/check-repository";

function requireEnoughIdentity(input: VerificationInput) {
  const identifier = input.sirenOrSiret?.replace(/\D/g, "") ?? "";
  if (identifier.length === 9 || identifier.length === 14) {
    return;
  }

  const normalizedName = input.companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const compactName = normalizedName.replace(/[^a-zA-Z0-9]/g, "");
  if (compactName.length <= 4) {
    throw new Error(
      "Saisie trop courte ou ambiguë. Pour un sigle comme « EDF », indiquez le SIREN/SIRET ou la raison sociale complète.",
    );
  }
}

function buildOrchestrationEntries(
  input: VerificationInput,
  candidates: ReturnType<typeof buildRankedCandidates>,
  selectedCandidate: ReturnType<typeof buildRankedCandidates>[number],
) {
  const timestamp = new Date().toISOString();

  const entries: ProviderExchangeEntry[] = [
    {
      id: randomUUID(),
      transport: "orchestration",
      toolName: "matching-candidates",
      status: "success",
      startedAt: timestamp,
      completedAt: timestamp,
      summary: `${candidates.length} candidat(s) ont été évalués après enrichissement MCP.`,
      requestPayload: {
        companyName: input.companyName,
        sirenOrSiret: input.sirenOrSiret,
      },
      responsePayload: candidates.slice(0, 5).map((candidate) => ({
        legalName: candidate.company.legalName,
        siren: candidate.company.siren,
        siret: candidate.establishment.siret,
        matchConfidence: candidate.matchConfidence,
        rankingScore: candidate.rankingScore,
      })),
    },
    {
      id: randomUUID(),
      transport: "orchestration",
      toolName: "matching-selected",
      status: "success",
      startedAt: timestamp,
      completedAt: timestamp,
      summary: "Le meilleur établissement a été retenu pour alimenter le moteur de décision.",
      requestPayload: {
        candidatesCount: candidates.length,
      },
      responsePayload: {
        legalName: selectedCandidate.company.legalName,
        siren: selectedCandidate.company.siren,
        siret: selectedCandidate.establishment.siret,
        matchConfidence: selectedCandidate.matchConfidence,
      },
    },
  ];

  return entries;
}

export async function createVerificationCheck(
  userId: string,
  input: VerificationInput,
): Promise<VerificationCheckRecord> {
  requireEnoughIdentity(input);

  const primaryProvider = createCompanyDataProvider();
  let lookupResult;

  try {
    lookupResult = await primaryProvider.searchCompanies(input);
    logEvent("info", "provider.lookup.completed", {
      companyName: input.companyName,
      providerName: lookupResult.providerName,
      companiesCount: lookupResult.companies.length,
      companies: lookupResult.companies.slice(0, 5).map((company) => ({
        legalName: company.legalName,
        siren: company.siren,
        establishmentsCount: company.establishments.length,
      })),
      providerExchange: lookupResult.providerExchange,
    });
  } catch (error) {
    if (!(primaryProvider instanceof PappersProvider)) {
      throw error;
    }

    logEvent("warn", "provider.pappers.fallback", {
      error,
      companyName: input.companyName,
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Le provider Pappers MCP est indisponible.";

    throw new Error(
      `Pappers MCP est momentanément indisponible. Aucun résultat n'a été substitué. Détail: ${errorMessage}`,
    );
  }

  const candidates = buildRankedCandidates(input, lookupResult.companies);
  logEvent("info", "provider.candidates.ranked", {
    companyName: input.companyName,
    companiesCount: lookupResult.companies.length,
    candidatesCount: candidates.length,
    candidates: candidates.slice(0, 5).map((candidate) => ({
      legalName: candidate.company.legalName,
      siren: candidate.company.siren,
      siret: candidate.establishment.siret,
      matchConfidence: candidate.matchConfidence,
      rankingScore: candidate.rankingScore,
    })),
  });
  if (!candidates.length) {
    throw new Error(
      "Aucune entreprise n'a pu être rapprochée avec les informations fournies.",
    );
  }

  const candidate = candidates[0];
  const orchestrationEntries = buildOrchestrationEntries(input, candidates, candidate);
  const decision = runDecisionEngine({
    request: input,
    candidate,
    providerName: lookupResult.providerName,
    providerMode: lookupResult.providerMode,
    providerTransport: lookupResult.providerTransport,
    providerWarnings: lookupResult.warnings,
    providerExchange: [...lookupResult.providerExchange, ...orchestrationEntries],
  });

  const now = new Date().toISOString();
  const record: VerificationCheckRecord = {
    id: randomUUID(),
    input,
    selectedCompany: decision.decisionTrace.candidateSummary,
    providerName: lookupResult.providerName,
    providerMode: lookupResult.providerMode,
    createdAt: now,
    updatedAt: now,
    override: null,
    ...decision,
  };

  insertCheck(record, userId);

  logEvent("info", "check.created", {
    id: record.id,
    providerName: record.providerName,
    providerMode: record.providerMode,
    recommendedAction: record.recommendedAction,
    riskLevel: record.riskLevel,
    matchConfidence: record.matchConfidence,
  });

  return record;
}

export function listVerificationChecksForUser(userId: string, limit = 25) {
  return listChecksByUser(userId, limit);
}

export function getVerificationCheckForUser(userId: string, id: string) {
  return getCheckByIdForUser(id, userId);
}

export function overrideVerificationCheck(
  userId: string,
  id: string,
  override: ManualOverride,
) {
  logEvent("info", "check.override.saved", {
    id,
    action: override.action,
  });

  return saveManualOverride(id, userId, override);
}
