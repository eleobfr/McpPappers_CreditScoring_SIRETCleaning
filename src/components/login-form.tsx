"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TurnstileWidget } from "@/components/turnstile-widget";

export function LoginForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetTurnstileState() {
    if (turnstileSiteKey && window.turnstile) {
      window.turnstile.reset();
    }

    setTurnstileToken("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);
    setTurnstileError(null);
    setMessage(null);
    setPreviewLink(null);

    if (turnstileSiteKey && !turnstileToken) {
      setTurnstileError("Confirmez le controle de securite avant de continuer.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          turnstileToken: turnstileSiteKey ? turnstileToken : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            redirectTo?: string;
            previewLink?: string;
            turnstileRequired?: boolean;
            fieldErrors?: Record<string, string[] | undefined>;
          }
        | null;

      if (!response.ok || payload?.status === "error") {
        setFieldError(payload?.fieldErrors?.email?.[0] ?? "Email invalide.");
        setTurnstileError(
          payload?.fieldErrors?.turnstileToken?.[0] ??
            (payload?.turnstileRequired
              ? "Le controle de securite doit etre valide."
              : null),
        );
        setMessage(payload?.message ?? null);
        resetTurnstileState();
        return;
      }

      if (payload?.redirectTo) {
        window.location.assign(payload.redirectTo);
        return;
      }

      setMessage(payload?.message ?? "Lien de connexion prepare.");
      setPreviewLink(payload?.previewLink ?? null);
      resetTurnstileState();
      router.refresh();
    });
  }

  return (
    <form className="stack-lg" onSubmit={handleSubmit}>
      <label className="field">
        <span className="field-label">Email professionnel</span>
        <input
          className="input"
          type="email"
          placeholder="camille@entreprise.fr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {fieldError ? <p className="field-error">{fieldError}</p> : null}
      </label>

      <TurnstileWidget
        siteKey={turnstileSiteKey}
        onTokenChange={(token) => setTurnstileToken(token)}
      />
      {turnstileError ? <p className="field-error">{turnstileError}</p> : null}

      {message ? (
        <div className="notice notice-info">
          <p>{message}</p>
          {previewLink ? (
            <p>
              <a className="hero-inline-link" href={previewLink}>
                Ouvrir le lien de connexion de test
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Preparation..." : "Recevoir le lien"}
      </button>
    </form>
  );
}
