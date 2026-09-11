# Herald Voyages

A local-first personal travel atlas for trips, countries, travel days, home periods and Schengen 90/180 planning, published as a static GitHub Pages application.

## Product architecture

- `index.html` — stable application/data hooks and the core view structure
- `styles.css` — legacy/base styles required by existing components
- `voyages.css` — Herald Voyages design tokens, responsive product UI and component overrides
- `app.js` — bootstrap loader
- `app-core.js` — travel state, calculations, rendering and data-entry logic
- `app-fixes.js` — focused compatibility/UI fixes
- `voyages.js` — Herald Voyages shell, routing, navigation, map interactions and progressive-disclosure UI
- `dashboard-enhancements.js` — interactive dashboard-stat expansion
- `country-count-model.js` — personal country-count model
- `map-enhancements.js` — map behavior
- `account-*.js` — authentication, account storage and synchronization
- `herald.js` — encrypted guest-to-account transfer and safe merge flow
- `assets/` — site artwork. The current logo asset is intentionally unchanged pending the final Herald Voyages logo.

The app keeps its existing data model and storage keys. The redesign is a presentation/routing layer over the proven travel and account logic rather than a backend rewrite.

## Account system and guest migration

See [ACCOUNT-SETUP.md](ACCOUNT-SETUP.md) for account setup, safe migration and validation.

Travel history is local-first and is stored in the browser under `whereIveBeen.data.v2` for guest use. Signed-in data is synchronized to the user's private account. Guest histories can be moved into an account with the encrypted, short-lived, one-use transfer flow. Imports merge records safely rather than replacing the account copy.

Replacing repository files does not intentionally delete browser or account travel data.

## Data and Supabase

- `supabase-setup.sql` — production setup for account sync and encrypted transfer codes
- `supabase-hardening.sql` — migration/hardening for an existing Supabase project

## Security

- Browser code may contain a Supabase **publishable/anon** key. It is designed to be public and must be protected by database permissions/RLS.
- Never commit a Supabase **secret/service-role** key, password, private token, `.env` file or private certificate.
- Device-transfer payloads are encrypted in the browser, short-lived and single-use.
- Security checks run through `.github/workflows/security.yml`.
- Dependency updates for GitHub Actions are monitored by Dependabot.
- Vulnerabilities should be reported according to `SECURITY.md` rather than in a public issue.

## Public-release checklist

Before announcing a production release, make sure GitHub secret scanning/push protection, branch rules, HTTPS and private vulnerability reporting are enabled in repository settings, and apply `supabase-hardening.sql` to any existing Supabase project.
