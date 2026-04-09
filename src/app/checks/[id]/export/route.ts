import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getVerificationCheckForUser } from "@/lib/credit-ops/check-service";

function csvEscape(value: unknown) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const check = getVerificationCheckForUser(user.id, id);

  if (!check) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rows = [
    ["id", check.id],
    ["created_at", check.createdAt],
    ["company_name", check.input.companyName],
    ["selected_legal_name", check.selectedCompany.legalName],
    ["selected_siren", check.selectedCompany.siren],
    ["selected_siret", check.selectedCompany.siret],
    ["match_confidence", check.matchConfidence],
    ["risk_level", check.riskLevel],
    ["recommended_action", check.recommendedAction],
    ["override_action", check.override?.action ?? ""],
    ["override_reason", check.override?.reason ?? ""],
    ["suggested_credit_limit", check.suggestedCreditLimit],
    ["suggested_payment_terms", check.suggestedPaymentTerms],
    ["reason_codes", check.reasonCodes.join(" | ")],
    ["human_explanation", check.humanExplanation],
  ]
    .map(([key, value]) => `${csvEscape(key)},${csvEscape(value)}`)
    .join("\n");

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="check-${check.id}.csv"`,
    },
  });
}
