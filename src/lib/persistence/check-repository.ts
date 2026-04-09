import { getDatabase } from "@/lib/db";
import {
  type ManualOverride,
  type VerificationCheckRecord,
} from "@/lib/credit-ops/types";

interface CheckRow {
  id: string;
  user_id: string | null;
  input_json: string;
  selected_company_json: string;
  match_confidence: number;
  risk_level: string;
  recommended_action: string;
  suggested_credit_limit: number;
  suggested_payment_terms: string;
  reason_codes_json: string;
  decision_trace_json: string;
  human_explanation: string;
  manual_review_required: number;
  warnings_json: string;
  provider_name: string;
  provider_mode: string;
  override_json: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: CheckRow): VerificationCheckRecord {
  const parsedDecisionTrace = JSON.parse(row.decision_trace_json);

  return {
    id: row.id,
    input: JSON.parse(row.input_json),
    selectedCompany: JSON.parse(row.selected_company_json),
    matchConfidence: row.match_confidence,
    riskLevel: row.risk_level as VerificationCheckRecord["riskLevel"],
    recommendedAction:
      row.recommended_action as VerificationCheckRecord["recommendedAction"],
    suggestedCreditLimit: row.suggested_credit_limit,
    suggestedPaymentTerms: row.suggested_payment_terms,
    reasonCodes: JSON.parse(row.reason_codes_json),
    decisionTrace: {
      ...parsedDecisionTrace,
      providerTransport:
        parsedDecisionTrace.providerTransport ??
        (row.provider_mode === "live" ? "mcp-streamable-http" : "mock"),
      providerExchange: parsedDecisionTrace.providerExchange ?? [],
    },
    humanExplanation: row.human_explanation,
    manualReviewRequired: Boolean(row.manual_review_required),
    warnings: JSON.parse(row.warnings_json),
    providerName: row.provider_name,
    providerMode: row.provider_mode as VerificationCheckRecord["providerMode"],
    override: row.override_json
      ? (JSON.parse(row.override_json) as ManualOverride)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isNonMockCheck(check: VerificationCheckRecord) {
  return check.selectedCompany.source !== "mock";
}

export function insertCheck(check: VerificationCheckRecord, userId: string) {
  const database = getDatabase();
  const statement = database.prepare(`
    INSERT INTO verification_checks (
      id,
      user_id,
      input_json,
      selected_company_json,
      match_confidence,
      risk_level,
      recommended_action,
      suggested_credit_limit,
      suggested_payment_terms,
      reason_codes_json,
      decision_trace_json,
      human_explanation,
      manual_review_required,
      warnings_json,
      provider_name,
      provider_mode,
      override_json,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @user_id,
      @input_json,
      @selected_company_json,
      @match_confidence,
      @risk_level,
      @recommended_action,
      @suggested_credit_limit,
      @suggested_payment_terms,
      @reason_codes_json,
      @decision_trace_json,
      @human_explanation,
      @manual_review_required,
      @warnings_json,
      @provider_name,
      @provider_mode,
      @override_json,
      @created_at,
      @updated_at
    )
  `);

  statement.run({
    id: check.id,
    user_id: userId,
    input_json: JSON.stringify(check.input),
    selected_company_json: JSON.stringify(check.selectedCompany),
    match_confidence: check.matchConfidence,
    risk_level: check.riskLevel,
    recommended_action: check.recommendedAction,
    suggested_credit_limit: check.suggestedCreditLimit,
    suggested_payment_terms: check.suggestedPaymentTerms,
    reason_codes_json: JSON.stringify(check.reasonCodes),
    decision_trace_json: JSON.stringify(check.decisionTrace),
    human_explanation: check.humanExplanation,
    manual_review_required: check.manualReviewRequired ? 1 : 0,
    warnings_json: JSON.stringify(check.warnings),
    provider_name: check.providerName,
    provider_mode: check.providerMode,
    override_json: check.override ? JSON.stringify(check.override) : null,
    created_at: check.createdAt,
    updated_at: check.updatedAt,
  });

  return check;
}

export function listChecks(limit = 25) {
  const database = getDatabase();
  const statement = database.prepare(`
    SELECT *
    FROM verification_checks
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return statement
    .all(limit)
    .map((row: unknown) => mapRow(row as CheckRow))
    .filter(isNonMockCheck);
}

export function listChecksByUser(userId: string, limit = 25) {
  const database = getDatabase();
  const statement = database.prepare(`
    SELECT *
    FROM verification_checks
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return statement
    .all(userId, limit)
    .map((row: unknown) => mapRow(row as CheckRow))
    .filter(isNonMockCheck);
}

export function getCheckById(id: string) {
  const database = getDatabase();
  const statement = database.prepare(`
    SELECT *
    FROM verification_checks
    WHERE id = ?
  `);

  const row = statement.get(id) as CheckRow | undefined;
  return row ? mapRow(row) : null;
}

export function getCheckByIdForUser(id: string, userId: string) {
  const database = getDatabase();
  const statement = database.prepare(`
    SELECT *
    FROM verification_checks
    WHERE id = ?
      AND user_id = ?
  `);

  const row = statement.get(id, userId) as CheckRow | undefined;
  if (!row) {
    return null;
  }

  const mapped = mapRow(row);
  return isNonMockCheck(mapped) ? mapped : null;
}

export function saveManualOverride(id: string, userId: string, override: ManualOverride) {
  const database = getDatabase();
  const statement = database.prepare(`
    UPDATE verification_checks
    SET override_json = ?,
        updated_at = ?
    WHERE id = ?
      AND user_id = ?
  `);

  const updatedAt = new Date().toISOString();
  statement.run(JSON.stringify(override), updatedAt, id, userId);

  return getCheckByIdForUser(id, userId);
}

export function countChecks() {
  const database = getDatabase();
  const statement = database.prepare(
    "SELECT COUNT(*) as total FROM verification_checks",
  );

  const row = statement.get() as { total: number };
  return row.total;
}

export function countChecksByUser(userId: string) {
  const database = getDatabase();
  const statement = database.prepare(
    "SELECT COUNT(*) as total FROM verification_checks WHERE user_id = ?",
  );

  const row = statement.get(userId) as { total: number };
  return row.total;
}

export function getMetadata(key: string) {
  const database = getDatabase();
  const statement = database.prepare(
    "SELECT value FROM app_metadata WHERE key = ?",
  );

  const row = statement.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMetadata(key: string, value: string) {
  const database = getDatabase();
  const statement = database.prepare(`
    INSERT INTO app_metadata (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  statement.run({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}
