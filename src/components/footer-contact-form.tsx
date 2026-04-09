"use client";

import { useState, useTransition } from "react";

import { TurnstileWidget } from "@/components/turnstile-widget";

export function FooterContactForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "danger">("success");
  const [isPending, startTransition] = useTransition();

  function resetTurnstileState() {
    if (turnstileSiteKey && window.turnstile) {
      window.turnstile.reset();
    }

    setTurnstileToken("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFeedbackMessage(null);

    if (turnstileSiteKey && !turnstileToken) {
      setFieldErrors({
        turnstileToken: ["Validez le contrôle de sécurité avant l'envoi."],
      });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          company,
          message,
          website,
          turnstileToken: turnstileSiteKey ? turnstileToken : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            fieldErrors?: Record<string, string[] | undefined>;
          }
        | null;

      if (!response.ok || payload?.status === "error") {
        setFieldErrors(payload?.fieldErrors ?? {});
        setFeedbackTone("danger");
        setFeedbackMessage(
          payload?.message ?? "Votre message n'a pas pu être transmis.",
        );
        resetTurnstileState();
        return;
      }

      setFieldErrors({});
      setFeedbackTone("success");
      setFeedbackMessage(
        payload?.message ?? "Votre message a bien été transmis.",
      );
      setFullName("");
      setEmail("");
      setCompany("");
      setMessage("");
      setWebsite("");
      resetTurnstileState();
    });
  }

  return (
    <form className="footer-contact-form" onSubmit={handleSubmit}>
      <div className="footer-contact-grid">
        <label className="field">
          <span className="field-label footer-field-label">Nom complet</span>
          <input
            className="input footer-input"
            name="fullName"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Votre nom"
            type="text"
            value={fullName}
          />
          {fieldErrors.fullName ? <p className="field-error">{fieldErrors.fullName[0]}</p> : null}
        </label>

        <label className="field">
          <span className="field-label footer-field-label">Email professionnel</span>
          <input
            className="input footer-input"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@entreprise.fr"
            type="email"
            value={email}
          />
          {fieldErrors.email ? <p className="field-error">{fieldErrors.email[0]}</p> : null}
        </label>

        <label className="field field-span-2">
          <span className="field-label footer-field-label">Société</span>
          <input
            className="input footer-input"
            name="company"
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Votre société"
            type="text"
            value={company}
          />
          {fieldErrors.company ? <p className="field-error">{fieldErrors.company[0]}</p> : null}
        </label>

        <label className="field field-span-2">
          <span className="field-label footer-field-label">Message</span>
          <textarea
            className="textarea footer-textarea"
            name="message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Décrivez votre besoin, votre contexte ou votre demande de démonstration."
            rows={5}
            value={message}
          />
          {fieldErrors.message ? <p className="field-error">{fieldErrors.message[0]}</p> : null}
        </label>

        <label className="field footer-honeypot" aria-hidden="true">
          <span className="field-label">Website</span>
          <input
            autoComplete="off"
            className="input footer-input"
            name="website"
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            type="text"
            value={website}
          />
        </label>
      </div>

      <TurnstileWidget
        siteKey={turnstileSiteKey}
        onTokenChange={(token) => setTurnstileToken(token)}
      />
      {fieldErrors.turnstileToken ? (
        <p className="field-error">{fieldErrors.turnstileToken[0]}</p>
      ) : null}

      {feedbackMessage ? (
        <div className={`notice ${feedbackTone === "success" ? "notice-success" : "notice-danger"}`}>
          {feedbackMessage}
        </div>
      ) : null}

      <div className="button-row">
        <button className="button" disabled={isPending} type="submit">
          {isPending ? "Envoi..." : "Contacter ELEOB"}
        </button>
      </div>
    </form>
  );
}
