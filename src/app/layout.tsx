import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import { SourceBadge } from "@/components/badges";
import { FloatingFeedback } from "@/components/floating-feedback";
import { getFeedbackDraftForUser } from "@/lib/auth/auth-repository";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPappersMcpConfigured } from "@/lib/env";

import { logoutAction } from "@/app/login/actions";

import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const editorial = Cormorant_Garamond({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Credit Ops | Credit score et MCP Pappers",
  description:
    "Credit score B2B, verification client avant facturation et journal MCP Pappers dans une interface sobre et exploitable.",
  icons: {
    icon: "/credit-ops-favicon.svg",
    shortcut: "/credit-ops-favicon.svg",
    apple: "/credit-ops-favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pappersConfigured = hasPappersMcpConfigured();
  const user = await getCurrentUser();
  const initialFeedback =
    user && !user.isAdmin ? getFeedbackDraftForUser(user.id) : "";

  return (
    <html
      lang="fr"
      className={`${plexSans.variable} ${plexMono.variable} ${editorial.variable}`}
    >
      <body className="app-body">
        <div className="simple-shell">
          <header className="simple-header print-hidden">
            <div className="container simple-header-inner">
              <Link className="simple-brand" href={user ? "/verify" : "/"}>
                <Image
                  alt="Credit Ops"
                  className="simple-brand-logo"
                  height="44"
                  src="/credit-ops-logo.svg"
                  width="228"
                />
              </Link>

              <div className="simple-header-actions">
                {user ? (
                  <>
                    <span className="simple-user-chip">{user.email}</span>
                    <SourceBadge
                      mode={pappersConfigured ? "live" : "unconfigured"}
                      providerName={pappersConfigured ? "PappersProvider" : undefined}
                    />
                    <form action={logoutAction}>
                      <button className="button button-secondary" type="submit">
                        Deconnexion
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          <main className="page-shell">{children}</main>

          {user && !user.isAdmin ? (
            <FloatingFeedback initialFeedback={initialFeedback} />
          ) : null}
        </div>
      </body>
    </html>
  );
}
