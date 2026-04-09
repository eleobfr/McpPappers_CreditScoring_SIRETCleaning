import { FooterContactForm } from "@/components/footer-contact-form";

export function SiteFooter({
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string;
}) {
  return (
    <footer className="site-footer print-hidden">
      <div className="container footer-shell">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-copy">
              <span className="eyebrow footer-eyebrow">Informations</span>
              <h2 className="footer-title">Credit Ops · Informations éditeur</h2>
              <p>
                Ce site a été développé par <strong>Vanuel BELLANCE</strong> pour la
                société <strong>ELEOB Data Consulting</strong>.
              </p>
              <p>
                Solution de démonstration B2B autour du crédit score, du matching
                entreprise et du MCP Pappers.
              </p>
            </div>

            <div className="footer-contact-card">
              <div className="stack-sm">
                <span className="eyebrow footer-eyebrow">Contact sécurisé</span>
                <h3>Parler avec Vanuel 🙂</h3>
              </div>
              <FooterContactForm turnstileSiteKey={turnstileSiteKey} />
            </div>
          </div>

          <div className="footer-bottom">
            <p>ELEOB Data Consulting · Contact professionnel sécurisé · France</p>
            <p>Credit Ops · Vérification client avant facturation · Démonstration produit</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
