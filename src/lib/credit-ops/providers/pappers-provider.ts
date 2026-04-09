import { randomUUID } from "node:crypto";

import {
  type CompanyDataProvider,
  type CompanyLookupResult,
  type CompanyProfile,
  type ProviderExchangeEntry,
  type VerificationInput,
} from "@/lib/credit-ops/types";
import { resolveKnownCompanyAlias } from "@/lib/credit-ops/company-aliases";
import { appEnv } from "@/lib/env";
import { compactText, digitsOnly } from "@/lib/utils";

interface MpcTextContentBlock {
  type: string;
  text?: string;
}

interface MpcToolCallResponse {
  jsonrpc: string;
  id?: string | number | null;
  error?: {
    code: number;
    message: string;
  };
  result?: {
    content?: MpcTextContentBlock[];
  };
}

interface SirenisateurResult {
  possibilities?: Array<{
    company_number?: string;
    company_name?: string;
    company_postal_code?: string;
    company_city?: string;
  }>;
}

interface PappersMcpEstablishmentResponse {
  siret?: string;
  adresse_ligne_1?: string;
  code_postal?: string;
  ville?: string;
  etablissement_cesse?: boolean;
  date_cessation?: string | null;
  siege?: boolean;
  enseigne?: string | null;
  nom_commercial?: string | null;
}

interface PappersMcpCompanyResponse {
  siren?: string;
  nom_entreprise?: string;
  denomination?: string;
  nom_commercial?: string;
  forme_juridique?: string;
  capital?: number | string;
  effectif?: string;
  tranche_effectif?: string;
  date_cessation?: string | null;
  date_radiation_rcs?: string | null;
  statut_rcs?: string;
  statut_consolide?: string;
  siege?: PappersMcpEstablishmentResponse;
  etablissements?: PappersMcpEstablishmentResponse[];
  procedure_collective_existe?: boolean;
  procedure_collective_en_cours?: boolean;
  procedures_collectives?: Array<unknown>;
  sanctions?: Array<unknown>;
}

interface PappersMcpToolDomainError {
  error?: boolean;
  message?: string;
  invalid_values?: string[];
  valid_values?: string[];
}

const FULL_INFORMATION_FIELDS = [
  "siren",
  "nom_entreprise",
  "denomination",
  "forme_juridique",
  "capital",
  "effectif",
  "tranche_effectif",
  "date_cessation",
  "date_radiation_rcs",
  "statut_rcs",
  "statut_consolide",
  "siege",
  "etablissements",
  "procedure_collective_existe",
  "procedure_collective_en_cours",
  "procedures_collectives",
  "sanctions",
] as const;

const LIGHT_INFORMATION_FIELDS = [
  "siren",
  "nom_entreprise",
  "denomination",
  "forme_juridique",
  "capital",
  "effectif",
  "tranche_effectif",
  "date_cessation",
  "date_radiation_rcs",
  "statut_rcs",
  "statut_consolide",
  "siege",
  "procedure_collective_existe",
  "procedure_collective_en_cours",
  "procedures_collectives",
  "sanctions",
] as const;

function isToolDomainError(value: unknown): value is PappersMcpToolDomainError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    (value as { error?: unknown }).error === true
  );
}

function truncateString(value: string, maxLength = 900) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

function sanitizePayload(
  value: unknown,
  depth = 0,
): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, 6).map((item) => sanitizePayload(item, depth + 1));
    if (value.length > 6) {
      items.push(`… ${value.length - 6} élément(s) supplémentaires`);
    }
    return items;
  }

  if (typeof value === "object") {
    if (depth >= 4) {
      return "[objet tronqué]";
    }

    return Object.fromEntries(
      Object.entries(value).slice(0, 20).map(([key, itemValue]) => [
        key,
        sanitizePayload(itemValue, depth + 1),
      ]),
    );
  }

  return String(value);
}

function toOptionalNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function inferCompanyStatus(response: PappersMcpCompanyResponse): CompanyProfile["status"] {
  if (response.date_radiation_rcs) {
    return "radiated";
  }

  if (response.date_cessation) {
    return "ceased";
  }

  const normalizedStatus = compactText(
    response.statut_consolide || response.statut_rcs,
  ).toLowerCase();

  if (normalizedStatus.includes("radie")) {
    return "radiated";
  }

  if (normalizedStatus.includes("cesse")) {
    return "ceased";
  }

  if (normalizedStatus.includes("inactif")) {
    return "inactive";
  }

  return "active";
}

function mapEstablishment(
  establishment: PappersMcpEstablishmentResponse | undefined,
  isHeadOfficeFallback = false,
) {
  if (!establishment?.siret) {
    return null;
  }

  return {
    siret: establishment.siret,
    label:
      compactText(establishment.nom_commercial) ||
      compactText(establishment.enseigne) ||
      (establishment.siege || isHeadOfficeFallback ? "Siège" : "Établissement"),
    isHeadOffice: establishment.siege ?? isHeadOfficeFallback,
    status:
      establishment.etablissement_cesse || Boolean(establishment.date_cessation)
        ? ("inactive" as const)
        : ("active" as const),
    addressLine: compactText(establishment.adresse_ligne_1),
    postalCode: compactText(establishment.code_postal),
    city: compactText(establishment.ville),
  };
}

function mapCompany(response: PappersMcpCompanyResponse): CompanyProfile | null {
  if (!response.siren) {
    return null;
  }

  const headOffice = mapEstablishment(response.siege, true);
  const otherEstablishments = (response.etablissements ?? [])
    .map((item) => mapEstablishment(item))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const establishments = [
    ...(headOffice ? [headOffice] : []),
    ...otherEstablishments.filter((item) => item.siret !== headOffice?.siret),
  ];

  const legalWarnings: string[] = [];
  if (response.procedure_collective_existe || response.procedure_collective_en_cours) {
    legalWarnings.push("Signal de procédure collective remonté par Pappers MCP");
  }

  if (Array.isArray(response.sanctions) && response.sanctions.length > 0) {
    legalWarnings.push("Sanctions ou alertes réglementaires signalées");
  }

  return {
    siren: response.siren,
    legalName:
      compactText(response.nom_entreprise) ||
      compactText(response.denomination) ||
      response.siren,
    tradeName:
      compactText(response.siege?.nom_commercial) ||
      compactText(response.etablissements?.find((item) => item.nom_commercial)?.nom_commercial),
    legalForm: compactText(response.forme_juridique),
    status: inferCompanyStatus(response),
    headOfficeSiret: response.siege?.siret,
    procedureCollective:
      Boolean(response.procedure_collective_en_cours) ||
      Boolean(response.procedure_collective_existe) ||
      Boolean(response.procedures_collectives?.length),
    legalWarnings,
    capital: toOptionalNumber(response.capital),
    employeeRange:
      compactText(response.tranche_effectif) || compactText(response.effectif),
    establishments: establishments.length
      ? establishments
      : [
          {
            siret: `${response.siren}00000`,
            label: "Établissement principal",
            isHeadOffice: true,
            status: "active",
          },
        ],
    source: "pappers",
    sourceUrl: `https://www.pappers.fr/entreprise/${response.siren}`,
    raw: response,
  };
}

function normalizeJsonText(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

export class PappersProvider implements CompanyDataProvider {
  readonly name = "PappersProvider";
  readonly mode = "live" as const;

  private readonly mcpUrl = appEnv.pappersMcpUrl;
  private readonly exchangeLog: ProviderExchangeEntry[] = [];

  getExchangeLog() {
    return [...this.exchangeLog];
  }

  private logStep({
    toolName,
    status,
    summary,
    requestPayload,
    responsePayload,
    note,
  }: {
    toolName: string;
    status: ProviderExchangeEntry["status"];
    summary: string;
    requestPayload: unknown;
    responsePayload?: unknown;
    note?: string;
  }) {
    const timestamp = new Date().toISOString();

    this.exchangeLog.push({
      id: randomUUID(),
      transport: "orchestration",
      toolName,
      status,
      startedAt: timestamp,
      completedAt: timestamp,
      summary,
      requestPayload: sanitizePayload(requestPayload),
      responsePayload: sanitizePayload(responsePayload),
      note,
    });
  }

  private async callTool<T>(toolName: string, args: Record<string, unknown>) {
    if (!this.mcpUrl) {
      throw new Error("Pappers MCP URL missing.");
    }

    const startedAt = new Date().toISOString();
    const exchangeEntry: ProviderExchangeEntry = {
      id: randomUUID(),
      transport: "mcp-streamable-http",
      toolName,
      status: "info",
      startedAt,
      summary: `Appel MCP Pappers vers l'outil ${toolName}.`,
      requestPayload: sanitizePayload({
        tool: toolName,
        arguments: args,
      }),
    };

    try {
      const response = await fetch(this.mcpUrl, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: randomUUID(),
          method: "tools/call",
          params: {
            name: toolName,
            arguments: args,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        exchangeEntry.status = "error";
        exchangeEntry.completedAt = new Date().toISOString();
        exchangeEntry.summary = `Erreur HTTP MCP (${response.status}) sur ${toolName}.`;
        exchangeEntry.responsePayload = {
          status: response.status,
          statusText: response.statusText,
        };
        this.exchangeLog.push(exchangeEntry);
        throw new Error(`Pappers MCP error (${response.status}) on ${toolName}`);
      }

      const payload = (await response.json()) as MpcToolCallResponse;
      if (payload.error) {
        exchangeEntry.status = "error";
        exchangeEntry.completedAt = new Date().toISOString();
        exchangeEntry.summary = `Erreur MCP Pappers sur ${toolName}.`;
        exchangeEntry.responsePayload = sanitizePayload(payload.error);
        this.exchangeLog.push(exchangeEntry);
        throw new Error(
          `Pappers MCP tool error (${toolName}): ${payload.error.message}`,
        );
      }

      const textContent = payload.result?.content
        ?.map((item) => item.text)
        .filter((value): value is string => Boolean(value))
        .join("\n");

      if (!textContent) {
        exchangeEntry.status = "error";
        exchangeEntry.completedAt = new Date().toISOString();
        exchangeEntry.summary = `Réponse MCP vide sur ${toolName}.`;
        exchangeEntry.responsePayload = sanitizePayload(payload.result);
        this.exchangeLog.push(exchangeEntry);
        throw new Error(`Pappers MCP returned no content for ${toolName}.`);
      }

      const parsedPayload = JSON.parse(normalizeJsonText(textContent)) as T;
      if (isToolDomainError(parsedPayload)) {
        exchangeEntry.status = "error";
        exchangeEntry.completedAt = new Date().toISOString();
        exchangeEntry.summary = `Erreur métier MCP sur ${toolName}.`;
        exchangeEntry.responsePayload = sanitizePayload(parsedPayload);
        this.exchangeLog.push(exchangeEntry);
        throw new Error(
          `Pappers MCP domain error (${toolName}): ${parsedPayload.message ?? "Unknown error"}`,
        );
      }

      exchangeEntry.status = "success";
      exchangeEntry.completedAt = new Date().toISOString();
      exchangeEntry.summary = `Réponse MCP reçue pour ${toolName}.`;
      exchangeEntry.responsePayload = sanitizePayload(parsedPayload);
      this.exchangeLog.push(exchangeEntry);

      return parsedPayload;
    } catch (error) {
      if (!exchangeEntry.completedAt) {
        exchangeEntry.status = "error";
        exchangeEntry.completedAt = new Date().toISOString();
        exchangeEntry.summary = `Échec de l'appel MCP sur ${toolName}.`;
        exchangeEntry.responsePayload = {
          error: error instanceof Error ? error.message : String(error),
        };
        this.exchangeLog.push(exchangeEntry);
      }

      throw error;
    }
  }

  private async resolveSirens(input: VerificationInput) {
    const identifier = digitsOnly(input.sirenOrSiret);
    const aliasResolution = resolveKnownCompanyAlias(input.companyName);

    if (identifier.length === 9) {
      this.logStep({
        toolName: "resolve-siren-from-input",
        status: "success",
        summary: "SIREN fourni directement par l'utilisateur.",
        requestPayload: { sirenOrSiret: input.sirenOrSiret },
        responsePayload: { sirens: [identifier] },
      });
      return [identifier];
    }

    if (identifier.length === 14) {
      this.logStep({
        toolName: "resolve-siren-from-siret",
        status: "success",
        summary: "SIRET fourni directement ; extraction automatique du SIREN.",
        requestPayload: { sirenOrSiret: input.sirenOrSiret },
        responsePayload: { sirens: [identifier.slice(0, 9)] },
      });
      return [identifier.slice(0, 9)];
    }

    if (aliasResolution.wasExpanded) {
      this.logStep({
        toolName: "alias-expansion",
        status: "info",
        summary: `Le nom saisi a été enrichi avant appel MCP : ${input.companyName} → ${aliasResolution.searchName}.`,
        requestPayload: {
          originalName: input.companyName,
        },
        responsePayload: {
          searchName: aliasResolution.searchName,
        },
      });
    }

    this.logStep({
      toolName: "sirenisateur-input",
      status: "info",
      summary: "Recherche d'un SIREN via l'outil MCP sirenisateur.",
      requestPayload: {
        companyName: aliasResolution.searchName,
        postalCode: input.postalCode,
        city: input.city,
      },
    });

    const sirenisation = await this.callTool<SirenisateurResult>("sirenisateur", {
      country_code: "FR",
      company_name: aliasResolution.searchName,
      company_postal_code: input.postalCode || undefined,
      company_city: input.city || undefined,
      return_fields: [
        "company_number",
        "company_name",
        "company_postal_code",
        "company_city",
      ],
    });

    const sirens = (sirenisation.possibilities ?? [])
      .map((item) => digitsOnly(item.company_number))
      .filter((value) => value.length === 9)
      .slice(0, 3);

    this.logStep({
      toolName: "sirenisateur-output",
      status: sirens.length ? "success" : "error",
      summary: sirens.length
        ? `${sirens.length} SIREN(s) remonté(s) par sirenisateur.`
        : "Aucun SIREN remonté par sirenisateur.",
      requestPayload: { companyName: aliasResolution.searchName },
      responsePayload: {
        sirens,
        possibilities: sirenisation.possibilities ?? [],
      },
    });

    return sirens;
  }

  private async getCompanyInformation(siren: string) {
    try {
      return await this.callTool<PappersMcpCompanyResponse>(
        "informations-entreprise",
        {
          siren,
          return_fields: [...FULL_INFORMATION_FIELDS],
        },
      );
    } catch (error) {
      const fallbackResponse = await this.callTool<PappersMcpCompanyResponse>(
        "informations-entreprise",
        {
          siren,
          return_fields: [...LIGHT_INFORMATION_FIELDS],
        },
      );

      return {
        ...fallbackResponse,
        _mcpFallbackWarning:
          error instanceof Error
            ? error.message
            : "Pappers MCP fallbacked to light fields.",
      } as PappersMcpCompanyResponse & { _mcpFallbackWarning: string };
    }
  }

  async searchCompanies(input: VerificationInput): Promise<CompanyLookupResult> {
    this.exchangeLog.length = 0;
    this.logStep({
      toolName: "analysis-start",
      status: "info",
      summary: "Démarrage du flux MCP Pappers pour cette analyse.",
      requestPayload: {
        companyName: input.companyName,
        sirenOrSiret: input.sirenOrSiret,
        requestedAmount: input.requestedAmount,
      },
    });

    const sirens = await this.resolveSirens(input);
    if (!sirens.length) {
      return {
        providerName: this.name,
        providerMode: this.mode,
        providerTransport: "mcp-streamable-http",
        warnings: [
          "Pappers MCP n'a pas pu rapprocher l'entreprise à partir des informations fournies.",
        ],
        providerExchange: [...this.exchangeLog],
        companies: [],
      };
    }

    const warnings: string[] = [
      "Source live via MCP Pappers (transport streamable-http).",
    ];

    this.logStep({
      toolName: "company-fetch-plan",
      status: "info",
      summary: `${sirens.length} fiche(s) entreprise vont être enrichies via informations-entreprise.`,
      requestPayload: { sirens },
    });

    const companies = await Promise.all(
      sirens.map(async (siren) => {
        const companyResponse = await this.getCompanyInformation(siren);

        if (
          typeof companyResponse === "object" &&
          companyResponse &&
          "_mcpFallbackWarning" in companyResponse &&
          typeof companyResponse._mcpFallbackWarning === "string"
        ) {
          warnings.push(
            `Réponse MCP allégée pour ${siren} : ${companyResponse._mcpFallbackWarning}`,
          );
        }

        return mapCompany(companyResponse);
      }),
    );

    this.logStep({
      toolName: "company-fetch-result",
      status: "success",
      summary: `${companies.filter(Boolean).length} fiche(s) entreprise récupérée(s) depuis MCP.`,
      requestPayload: { sirens },
      responsePayload: companies.filter(Boolean).map((company) => ({
        legalName: company?.legalName,
        siren: company?.siren,
        establishmentsCount: company?.establishments.length,
      })),
    });

    return {
      providerName: this.name,
      providerMode: this.mode,
      providerTransport: "mcp-streamable-http",
      warnings,
      providerExchange: [...this.exchangeLog],
      companies: companies.filter(
        (company): company is NonNullable<typeof company> => Boolean(company),
      ),
    };
  }
}
