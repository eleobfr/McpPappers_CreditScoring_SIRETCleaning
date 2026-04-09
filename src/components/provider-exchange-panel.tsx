import { type ProviderExchangeEntry } from "@/lib/credit-ops/types";
import { formatDateTime } from "@/lib/utils";

function prettyPayload(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function ProviderExchangePanel({
  providerName,
  providerTransport,
  entries,
}: {
  providerName: string;
  providerTransport: string;
  entries: ProviderExchangeEntry[];
}) {
  if (!entries.length) {
    return (
      <section className="card stack-md">
        <div className="stack-sm">
          <p className="eyebrow">Journal provider</p>
          <h2>Aucun échange technique capturé</h2>
        </div>
        <p className="muted-text">
          Cette vérification n&apos;a pas déclenché d&apos;appel live vers un provider externe.
        </p>
      </section>
    );
  }

  return (
    <section className="card stack-lg focus-target" id="journal-technique" tabIndex={-1}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Journal technique</p>
          <h2>Échanges MCP envoyés via {providerName}</h2>
        </div>
        <p className="section-subtitle">
          Transport : {providerTransport}. La clé et l&apos;URL complète ne sont jamais
          affichées.
        </p>
      </div>

      <div className="provider-log-list">
        {entries.map((entry) => (
          <article className="provider-log-card" key={entry.id}>
            <div className="provider-log-head">
              <div className="stack-sm">
                <span className="provider-log-title">{entry.toolName}</span>
                <span className="provider-log-meta">
                  Début : {formatDateTime(entry.startedAt)}
                  {entry.completedAt ? ` · Fin : ${formatDateTime(entry.completedAt)}` : ""}
                </span>
              </div>
              <span className={`provider-log-status status-${entry.status}`}>
                {entry.status}
              </span>
            </div>

            <p className="muted-text">{entry.summary}</p>
            {entry.note ? <p className="provider-log-note">{entry.note}</p> : null}

            <div className="provider-log-grid">
              <div className="stack-sm">
                <h3>Commande envoyée</h3>
                <pre className="log-code-block">{prettyPayload(entry.requestPayload)}</pre>
              </div>
              <div className="stack-sm">
                <h3>Données reçues</h3>
                <pre className="log-code-block">
                  {prettyPayload(entry.responsePayload ?? { note: "Aucune réponse capturée." })}
                </pre>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
