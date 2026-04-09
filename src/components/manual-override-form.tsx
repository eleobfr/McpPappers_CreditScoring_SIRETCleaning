"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  type OverrideFormState,
  saveManualOverrideAction,
} from "@/app/verify/actions";
import { RECOMMENDED_ACTIONS, type ManualOverride } from "@/lib/credit-ops/types";

const INITIAL_STATE: OverrideFormState = {
  status: "idle",
};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="field-error">{errors[0]}</p>;
}

export function ManualOverrideForm({
  checkId,
  currentOverride,
  suggestedAction,
}: {
  checkId: string;
  currentOverride?: ManualOverride | null;
  suggestedAction: string;
}) {
  const router = useRouter();
  const action = saveManualOverrideAction.bind(null, checkId);
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="stack-md">
      <div className="form-grid compact-grid">
        <label className="field">
          <span className="field-label">Action d&apos;override</span>
          <select
            className="input"
            name="action"
            defaultValue={currentOverride?.action ?? suggestedAction}
          >
            {RECOMMENDED_ACTIONS.map((actionOption) => (
              <option key={actionOption} value={actionOption}>
                {actionOption}
              </option>
            ))}
          </select>
          <FieldError errors={state.fieldErrors?.action} />
        </label>

        <label className="field field-span-2">
          <span className="field-label">Motif</span>
          <textarea
            className="textarea"
            name="reason"
            rows={4}
            defaultValue={currentOverride?.reason}
            placeholder="Ex. validation DAF après prise de garantie ou relation stratégique."
          />
          <FieldError errors={state.fieldErrors?.reason} />
        </label>
      </div>

      {state.message ? (
        <div
          className={`notice ${
            state.status === "success" ? "notice-success" : "notice-danger"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="button-row">
        <button className="button button-secondary" type="submit" disabled={isPending}>
          {isPending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
