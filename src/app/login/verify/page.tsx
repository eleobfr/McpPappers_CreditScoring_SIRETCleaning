import { redirect } from "next/navigation";

import { getCurrentUser, getMagicLinkPreview } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";

export default async function LoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/verify");
  }

  const params = await searchParams;
  const token = params.token;

  if (!token) {
    redirect("/?error=missing-token");
  }

  const preview = getMagicLinkPreview(token);

  if (!preview) {
    redirect("/?error=invalid-or-expired-link");
  }

  return (
    <div className="container content-canvas">
      <section className="login-shell">
        <div className="login-card stack-lg">
          <div className="stack-sm">
            <p className="eyebrow">Connexion</p>
            <h1 className="page-title">Confirmer la connexion</h1>
            <p className="section-subtitle">
              Adresse detectee : {preview.email}. Le lien est valable jusqu&apos;au{" "}
              {formatDateTime(preview.expiresAt)}.
            </p>
          </div>

          <form action="/api/auth/consume-link" className="stack-md" method="post">
            <input name="token" type="hidden" value={token} />
            <button className="button" type="submit">
              Se connecter
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
