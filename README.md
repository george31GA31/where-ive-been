# Herald Voyages

A local-first personal travel atlas for trips, countries, travel days, home periods and Schengen 90/180 planning, published as a static GitHub Pages application.

## Product architecture

- `index.html` holds the shared application shell and individual page structures.
- `voyages.js` mounts only the active page, handles addressable hash routes and browser history, and composes the atlas interface. Inactive page nodes are retained in memory so existing form references and data rendering remain stable.
- `voyages.css` owns all Herald Voyages tokens, responsive layouts, navigation, typography and motion. The earlier branding and override sheets have been removed.
- `styles.css` contains the underlying functional component rules; `accounts.css` contains account layouts.
- `atlas-model.js` supplies read-only geographic grouping for continental progress. It never writes travel data.
- `dashboard-enhancements.js` opens statistics in a native dialog for mouse, keyboard and touch.
- `app-core.js`, `app-fixes.js`, `country-count-model.js` and `map-enhancements.js` retain travel calculations, data entry, country definitions and map behavior.
- `account-*.js` retain authentication and synchronization. `herald.js` retains encrypted guest transfer and merge logic, and adds guest export and transfer access on Profile.
- `theme.js` retains the existing light/dark preference key and uses the supplied trumpet artwork.
- `assets/herald-trumpet.png` is the supplied logo, unchanged. The masthead uses this fourth supplied image in place of the inspiration page's globe.

Routes: Dashboard (default), Map, Trips, Countries, Calendar, Schengen, Statistics, Lived In, Trip Planner, Entry Requirements, Travel Tools, People and Settings. Account pages remain separately addressable HTML documents.

Desktop links become a floating island after scrolling. Mobile uses the same primary areas through a bottom navigation bar, including Tools. Motion respects reduced-motion preferences.

Storage keys, account identity, country-count choices, existing flags and synchronization payloads are preserved. No database migration is required for this redesign.

## Validation

- Unit tests cover storage/imports, accounts, trips, maps, safe hotel reconciliation, Roman-script display and worldwide entry lookups.
- DOM integration checks: individual page mounting, rerendering while pages are detached, country search, year/month navigation, widget dialogs, trip creation retaining existing homes and profiles, and account-page boot.
- JavaScript syntax and local HTML asset references checked.
- Chromium checks cover desktop (1440px), tablet (768px), mobile (390px), both themes, click/tap, manual map plotting, date overlaps, Calendar sizing, complete flight panels, entry contexts and acknowledgements. Baseline and current Calendar screenshots are compared with the same records.
- No live-account mutation is used for testing; existing version-2 fixtures, imports, guest persistence and account merge flows are exercised.
- Run `npm test`, `npm run test:dom`, `npm run test:browser` and `python tests/test_country_import.py`. The site is static; there is no compilation step.

## October 2026 refinements

Journey Map date ranges intersect each flight leg, transport, accommodation stay and dated destination/location. Hotel pins are 16px SVG drops. Physical-property reconciliation is read-only: conservative distance, address, identity and name checks group historical stays and expose aliases without combining or deleting stays. Removed saved places remain removed.

Calendar dimensions, colours and typography are retained. Single-property text uses the full row while the background retains its check-in/check-out cue. Country and route wrapping is measured against actual space and the fixed cell boundary.

Entry Requirements accepts any supported passport, destination and date, with optional departure, recent travel, transit durations and age. The global planning snapshot covers 199 passports and 39,402 routes; reviewed official rules take precedence. Unverified rules, health and document conditions are explicit. See [data provenance and refresh policy](data/entry-requirements/README.md). Travel Tools has moved into the normal navigation; its existing Coming Soon tools are unchanged.

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
