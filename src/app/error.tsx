"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container">
      <div className="empty-state">
        <h1>Analyse momentanément indisponible</h1>
        <p>
          Une erreur a interrompu le parcours de vérification. Le dossier n&apos;a pas
          pu être restitué correctement.
        </p>
        <p className="muted-text">
          Détail technique : {error.message || "Erreur non spécifiée"}.
        </p>
        <div className="button-row">
          <button className="button" type="button" onClick={() => reset()}>
            Réessayer
          </button>
          <Link className="button button-secondary" href="/verify">
            Nouveau contrôle
          </Link>
        </div>
      </div>
    </div>
  );
}
