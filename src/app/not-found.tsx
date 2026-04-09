import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div className="empty-state">
        <h1>Fiche introuvable</h1>
        <p>
          La vérification demandée n&apos;existe pas ou n&apos;est plus disponible dans
          cette base locale.
        </p>
        <div className="button-row">
          <Link className="button" href="/verify">
            Vérifier un client avant facturation
          </Link>
          <Link className="button button-secondary" href="/history">
            Retour à l&apos;historique
          </Link>
        </div>
      </div>
    </div>
  );
}
