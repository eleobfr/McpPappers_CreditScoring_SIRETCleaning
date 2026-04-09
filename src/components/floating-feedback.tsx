"use client";

import { useActionState, useState } from "react";

import {
  saveFeedbackAction,
  type FeedbackFormState,
} from "@/app/feedback/actions";

const INITIAL_STATE: FeedbackFormState = {
  status: "idle",
};

export function FloatingFeedback({
  initialFeedback,
}: {
  initialFeedback: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    saveFeedbackAction,
    INITIAL_STATE,
  );

  return (
    <div className="feedback-float print-hidden">
      <button
        className="feedback-toggle"
        type="button"
        onClick={() => setIsOpen((value) => !value)}
      >
        Feedback
      </button>

      {isOpen ? (
        <form action={formAction} className="feedback-card stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Feedback</p>
            <h3>Un point à remonter ?</h3>
            <p className="muted-text">
              Ce message sera envoyé à l&apos;admin à la fin de votre session.
            </p>
          </div>

          <textarea
            className="textarea feedback-textarea"
            name="feedback"
            defaultValue={initialFeedback}
            placeholder="Vos remarques, bugs ou idées..."
          />

          {state.message ? (
            <div
              className={
                state.status === "success"
                  ? "notice notice-info"
                  : "notice notice-danger"
              }
            >
              {state.message}
            </div>
          ) : null}

          <button className="button" type="submit" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
