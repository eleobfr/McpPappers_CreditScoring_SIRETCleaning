"use server";

import { requireAuthenticatedUser, saveFeedbackDraft } from "@/lib/auth/session";

export interface FeedbackFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function saveFeedbackAction(
  _previousState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const user = await requireAuthenticatedUser();

  if (user.isAdmin) {
    return {
      status: "error",
      message: "Le feedback flottant est réservé aux sessions non-admin.",
    };
  }

  const feedback = String(formData.get("feedback") ?? "").trim();
  await saveFeedbackDraft(user.id, feedback);

  return {
    status: "success",
    message: feedback
      ? "Feedback enregistré. Il sera envoyé à l'admin à la fin de votre session."
      : "Feedback vidé.",
  };
}
