# Herald Voyages

A local-first personal travel atlas for trips, countries, travel days, home periods and Schengen 90/180 planning, published as a static GitHub Pages application.

## Product architecture

- `index.html` — semantic application shell and route-specific page structures
- `styles.css` — the single Herald Voyages design system, responsive layouts and component styling
- `ui-shell.js` — branding, hash routing, responsive navigation, dashboard statistics, interactive widgets and map/country presentation
- `app.js` — small bootstrap loader
- `app-core.js` — established travel state, calculations, rendering and data-entry logic
- `app-fixes.js` — focused compatibility/UI fixes
- `country-count-model.js` — personal country-count rules
- `map-enhancements.js` — zoom, hover and time-map behavior
- `account-*.js` — authentication, private account storage and synchronization
- `herald.js` — encrypted guest-to-account transfer and safe merge flow only
- `theme.js` — lightweight shared branding/appearance support for standalone account pages
- `assets/` — site artwork. The current logo asset is intentionally unchanged pending the final Herald Voyages logo.

The redesign keeps the existing travel data model, storage keys, account schema and Supabase persistence boundary intact. UI changes are separated from those data services so the product can evolve without risking recorded journeys.

## Navigation and pages

Herald Voyages is a routed single-page application suitable for GitHub Pages. Major features have distinct route/page structures such as `#/dashboard`, `#/map`, `#/trips`, `#/countries`, `#/calendar`, `#/stats`, `#/schengen`, `#/planner`, `#/visa` and `#/lived`. Shared data and rendering logic is not duplicated between routes.

Desktop uses a dedicated navigation rail. Tablet and mobile use deliberately different layouts, including a bottom navigation bar and a mobile More sheet.

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
