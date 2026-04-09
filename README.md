# Credit Ops

MVP B2B francais pour verifier un client avant facturation, exploiter le MCP Pappers et produire une decision lisible pour la finance, l'ADV et le credit management.

## Parcours actuel

- `/` : landing publique avec contenu SEO autour des themes `credit score` et `MCP Pappers`, plus cadre de connexion email au centre
- `/verify` : application connectee, avec formulaire minimal, decision, journal MCP et historique du compte
- `/login` : alias legacy qui redirige vers `/`
- `/login/verify` : page de confirmation du magic link
- `/checks/[id]` : redirection vers `/verify?check=...`
- `/history` : redirection vers `/verify`
- `/healthz` : endpoint de sante

## Stack

- Next.js 16 App Router
- React 19
- TypeScript strict
- SQLite via `better-sqlite3`
- Zod
- Vitest
- Docker + `docker-compose.yml`

## Variables d'environnement

Copier `.env.example` vers `.env.local` pour le developpement local.

```env
PAPPERS_MCP_URL=
PAPPERS_API_TOKEN=
APP_BASE_URL=http://localhost:3000
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
DATA_DIR=./data
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
DATABASE_PATH=./data/credit-ops.sqlite
```

Notes :

- configuration recommandee Pappers : `PAPPERS_MCP_URL=https://mcp.pappers.fr/{votre-cle-api}`
- `PAPPERS_API_TOKEN` reste accepte en fallback pour reconstruire l'URL MCP
- la cle MCP Pappers et les secrets SMTP restent toujours cote serveur
- Turnstile est active si `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` sont presents

## Lancer en local

```bash
npm install
npm run dev
```

Landing : `http://localhost:3000`

Application connectee : `http://localhost:3000/verify`

## Docker

```bash
docker compose --env-file .env.local up --build
```

## Authentification

- connexion par email professionnel
- si l'email correspond a un admin en base, connexion immediate
- sinon, un magic link est envoye
- le magic link est valable 5 minutes
- une session non-admin dure 25 minutes
- a expiration, les donnees et l'historique du user non-admin sont supprimes

Creer ou promouvoir un admin :

```bash
npm run admin:create -- admin@entreprise.fr "Admin Credit Ops"
```

## Turnstile

Turnstile protege la demande de magic link.

- widget cote client sur la landing
- verification serveur via `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- en cas d'echec, aucun lien n'est emis

## MCP Pappers

Le provider live utilise le serveur MCP officiel Pappers en `streamable-http`.

Outils utilises :

- `sirenisateur`
- `informations-entreprise`

Le journal MCP de chaque analyse affiche :

- les commandes envoyees
- les donnees recues
- les etapes d'orchestration
- les horodatages

## Commandes utiles

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

## Deploiement

Le deploiement serveur vise `mixo75` via GitHub Actions.

- workflow : `.github/workflows/deploy-mixo75.yml`
- SMTP mutualise : `/etc/eleob/common-mail.env`
- variables app : `/srv/credit-ops/.env.app`
- data persistante : `/srv/credit-ops/data`
