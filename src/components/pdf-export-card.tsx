export function PdfExportCard({ checkId }: { checkId: string }) {
  return (
    <section className="card stack-md">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PDF</p>
          <h2>Rapport de décision crédit</h2>
        </div>
        <p className="section-subtitle">
          Version premium imprimable pour comité crédit, DAF et démonstration client.
        </p>
      </div>

      <div className="pdf-export-grid">
        <article className="pdf-feature-card">
          <span className="pdf-feature-label">Couverture</span>
          <strong>Décision recommandée mise en avant</strong>
          <p>Restitution immédiate de l&apos;action, du risque et de la confiance de matching.</p>
        </article>
        <article className="pdf-feature-card">
          <span className="pdf-feature-label">Analyse</span>
          <strong>Structure cabinet de conseil</strong>
          <p>Sections claires, synthèse exécutive, lecture rapide puis détails exploitables.</p>
        </article>
        <article className="pdf-feature-card">
          <span className="pdf-feature-label">Trace</span>
          <strong>Partageable en démo</strong>
          <p>Journal de décision, signaux clés et mentions prêtes à être imprimées en PDF.</p>
        </article>
      </div>

      <div className="button-row">
        <a
          className="button"
          href={`/checks/${checkId}/export?print=1`}
          rel="noreferrer"
          target="_blank"
        >
          Exporter en PDF
        </a>
        <a
          className="button button-secondary"
          href={`/checks/${checkId}/export`}
          rel="noreferrer"
          target="_blank"
        >
          Ouvrir le rapport
        </a>
      </div>
    </section>
  );
}
