"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return <p className="field-error">{errors[0]}</p>;
}

export function CheckForm({
  onAnalyzeStart,
}: {
  onAnalyzeStart?: () => void;
}) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onAnalyzeStart?.();
        const formData = new FormData(event.currentTarget);
        setFieldErrors({});
        setMessage(null);

        startTransition(async () => {
          const response = await fetch("/api/checks/analyze", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(Object.fromEntries(formData.entries())),
          });

          const payload = (await response.json().catch(() => null)) as
            | {
                status?: string;
                message?: string;
                redirectTo?: string;
                fieldErrors?: Record<string, string[] | undefined>;
              }
            | null;

          if (!response.ok || payload?.status === "error") {
            setFieldErrors(payload?.fieldErrors ?? {});
            setMessage(payload?.message ?? "L'analyse n'a pas pu être finalisée.");
            return;
          }

          if (payload?.redirectTo) {
            router.push(payload.redirectTo);
            router.refresh();
          }
        });
      }}
      className="stack-lg form-shell"
    >
      <section className="form-section stack-md">
        <div className="form-section-head">
          <div className="stack-sm">
            <p className="form-section-kicker">Saisie minimale</p>
            <h3>Raison sociale, SIREN/SIRET, montant</h3>
          </div>
          <p className="form-section-copy">
            L&apos;adresse et l&apos;établissement sont récupérés automatiquement via la source
            sélectionnée.
          </p>
        </div>

        <div className="form-grid">
          <label className="field">
            <span className="field-label">Raison sociale</span>
            <span className="field-hint">Champ principal de rapprochement</span>
            <input
              className="input"
              type="text"
              name="companyName"
              placeholder="Ex. Atlas Fournitures France"
              required
            />
            <FieldError errors={fieldErrors.companyName} />
          </label>

          <label className="field">
            <span className="field-label">SIREN ou SIRET</span>
            <span className="field-hint">Accélère fortement la confiance du matching</span>
            <input
              className="input"
              type="text"
              name="sirenOrSiret"
              placeholder="Optionnel mais très utile"
            />
            <FieldError errors={fieldErrors.sirenOrSiret} />
          </label>

          <label className="field">
            <span className="field-label">Montant demandé</span>
            <span className="field-hint">Montant à couvrir avant facturation</span>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              name="requestedAmount"
              placeholder="15000"
              required
            />
            <FieldError errors={fieldErrors.requestedAmount} />
          </label>
        </div>
      </section>

      {message ? (
        <div className="notice notice-danger">{message}</div>
      ) : null}

      <div className="form-footer">
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Analyse en cours..." : "Analyser"}
        </button>
      </div>
    </form>
  );
}
