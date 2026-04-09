"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { overrideVerificationCheck } from "@/lib/credit-ops/check-service";
import { formDataToObject, manualOverrideSchema } from "@/lib/credit-ops/schemas";
import { type ManualOverride } from "@/lib/credit-ops/types";
import { logEvent } from "@/lib/logger";

export interface OverrideFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function saveManualOverrideAction(
  checkId: string,
  _previousState: OverrideFormState,
  formData: FormData,
): Promise<OverrideFormState> {
  const parsed = manualOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Le motif et l'action d'override sont obligatoires.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const user = await requireAuthenticatedUser();
    const override: ManualOverride = {
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    overrideVerificationCheck(user.id, checkId, override);

    revalidatePath("/verify");
    revalidatePath(`/verify?check=${checkId}`);

    return {
      status: "success",
      message: "Override manuel enregistre.",
    };
  } catch (error) {
    logEvent("error", "check.override.failed", {
      checkId,
      error,
    });

    return {
      status: "error",
      message: "Impossible d'enregistrer l'override manuel.",
    };
  }
}
