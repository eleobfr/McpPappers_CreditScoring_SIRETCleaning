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

      <section className="seo-section stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SEO</p>
            <h2>Pourquoi parler de credit score et de MCP Pappers sur cette landing</h2>
          </div>
          <p className="section-subtitle seo-section-copy">
            Cette page sert a la fois de point d&apos;entree produit et de page de
            referencement pour les recherches autour du credit score B2B, du matching
            SIREN/SIRET et des usages du MCP Pappers.
          </p>
        </div>

        <div className="seo-card-grid">
          <article className="card stack-md">
            <h3>Credit score B2B</h3>
            <p className="muted-text">
              Un credit score utile n&apos;est pas seulement un signal de risque. Il doit
              aussi aider a choisir la bonne entite legale, justifier la decision et
              limiter les revues manuelles inutiles avant facturation.
            </p>
          </article>

          <article className="card stack-md">
            <h3>MCP Pappers</h3>
            <p className="muted-text">
              Le MCP Pappers permet d&apos;interroger les donnees entreprise avec une
              trace technique lisible. Cela facilite les tests, l&apos;explicabilite et la
              preparation d&apos;une integration plus robuste en production.
            </p>
          </article>

          <article className="card stack-md">
            <h3>Verification avant facturation</h3>
            <p className="muted-text">
              En pratique, la valeur vient de la rapidite de decision : identifier le
              bon tiers, estimer le risque, proposer une limite de credit et garder un
              historique clair pour l&apos;equipe finance.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
