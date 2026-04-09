import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { appEnv, hasTurnstileConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Credit Ops | Credit score et MCP Pappers",
  description:
    "Credit score B2B, verification client avant facturation et test du MCP Pappers pour la finance, l'ADV et le credit management.",
  keywords: [
    "credit score",
    "credit score B2B",
    "MCP Pappers",
    "Pappers",
    "verification client",
    "verification avant facturation",
    "SIREN",
    "SIRET",
  ],
};

function getErrorMessage(error?: string) {
  if (error === "invalid-or-expired-link") {
    return "Le lien de connexion est invalide ou expire.";
  }

  if (error === "missing-token") {
    return "Le lien de connexion est incomplet.";
  }

  return null;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/verify");
  }

  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);
  const turnstileSiteKey = hasTurnstileConfigured()
    ? appEnv.turnstile.siteKey
    : undefined;

  return (
    <div className="container content-canvas stack-xl">
      <section className="landing-hero seo-landing-hero">
        <div className="landing-hero-inner stack-lg">
          <div className="landing-hero-topline stack-sm">
            <p className="eyebrow">Credit score · MCP Pappers</p>
            <h1 className="landing-title landing-title-wide">
              Credit score B2B et verification client avant facturation
            </h1>
            <p className="landing-subtitle landing-subtitle-wide">
              Testez un parcours sobre et exploitable pour rapprocher une entreprise,
              interroger le MCP Pappers et produire une decision lisible pour la
              finance, l&apos;ADV et le credit management.
            </p>
          </div>

          <div className="hero-proof-grid">
            <article className="proof-card">
              <span className="proof-label">Usage</span>
              <strong>Verification avant facturation</strong>
              <p>
                Centraliser le credit score, la trace MCP Pappers et la decision
                recommandee dans un meme flux de travail.
              </p>
            </article>
            <article className="proof-card">
              <span className="proof-label">Source</span>
              <strong>MCP Pappers</strong>
              <p>
                Journal technique exhaustif, appels traces et donnees restituees sans
                exposer la cle API au navigateur.
              </p>
            </article>
            <article className="proof-card">
              <span className="proof-label">Resultat</span>
              <strong>Decision exploitable</strong>
              <p>
                Entite recommandee, risque, confiance de matching, limite suggeree et
                justification claire.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-login-shell">
        <div className="login-card stack-lg">
          <div className="stack-sm">
            <p className="eyebrow">Connexion</p>
            <h2 className="login-card-title">Acceder a l&apos;outil</h2>
            <p className="section-subtitle">
              Bienvenue sur l&apos;outil de test du MCP Pappers.
            </p>
          </div>

          {errorMessage ? <div className="notice notice-danger">{errorMessage}</div> : null}

          <LoginForm turnstileSiteKey={turnstileSiteKey} />
        </div>
      </section>
    </div>
  );
}
