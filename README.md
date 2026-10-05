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

Routes: Dashboard (default), Map, Trips, Countries, Calendar, Schengen, Statistics, Lived In, Plan a Trip, Travel Tools (Stay planner, Entry Requirements and Schengen calculator), People and Settings. Account pages remain separately addressable HTML documents.

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

Railway routing retains successful mapped routes, then reuses partial route geometry and searches nearby active physical tracks without requiring a matching scheduled service. Passenger passing loops remain usable. A wider second lookup includes infrastructure from both stops and uses a compatible OpenStreetMap Overpass instance if the first lookup fails or is incomplete. When that lookup stalls, small read-only OSM station extracts and at most two infrastructure relations provide a bounded backup through the same geometry solver. Connected tracks take priority over approximate small gaps; endpoint connectors and missing switches are bounded and penalised. Different physical node IDs at crossings, incompatible gauges, inactive tracks, freight-only lines and absurd detours remain excluded. Route appearance and all other transport routing are unchanged. Geometry is cached only in memory; this does not change stored journeys, accounts or sync data.

Calendar dimensions, colours and typography are retained. Single-property text uses the full row while the background retains its check-in/check-out cue. Country and route wrapping is measured against actual space and the fixed cell boundary.

Entry Requirements needs only a supported passport and destination. Date, stay length, departure, recent travel, transit and age are optional under Add trip details. The global planning snapshot supplies worldwide answers for 199 passports and 39,402 routes; sourced official corrections take precedence, with separate health and documentation enrichment. See [data provenance and refresh policy](data/entry-requirements/README.md). Calendar Schengen entries use a blue edge strip and a small S; split-country entries use only the strip, following the reference. Travel Tools remains in the normal navigation.

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

### Personal planning and self-service tools

Plan a Trip (`#/plan-a-trip`) introduces the personal travel-planning service in development: a free basic plan, a proposed £100 full itinerary and a possible booking service with details and fee unconfirmed. It has no intake, generation, payment or booking system.

Travel Tools (`#/travel-tools`) is the home for the existing working utilities. Stay planner uses `#/travel-tools/stay-planner`, Entry Requirements (including health guidance) uses `#/travel-tools/entry-requirements`, and the Schengen calculator uses `#/travel-tools/schengen`. Old `#/planner`, `#/visa`, `#/rules` and `#/schengen` links are replaced with their corresponding tool URL, including query suffixes, without adding duplicate history entries. The planner keeps its original handlers and element IDs and adds planned records to the same stays collection. No storage keys, saved-data schemas or account/sync code change. Existing Road Trip Planner, Budget Planner and Currency Converter coming-soon items remain.

### Currency Converter and Road Trip Planner

`#/travel-tools/currency` supports the global currency catalogue, current and dated reference conversions, editable custom rates, saved travel rates, searchable currency selection and synced favourites/recent selections. The exchange assessment compares money received with the total amount paid, including an optional extra or included fee. Good / Okay / Poor thresholds are centralised in `currency-model.js` (98% and 95%) and the effective rate, percentage difference and value lost/gained remain visible. Historical lookups never silently use today's rate. Latest lookups are capped at the traveller's date to avoid next-day publisher observations. Reference rates are attributed to [Frankfurter](https://frankfurter.dev/); network failures leave manual and saved custom rates usable.

`#/travel-tools/road-trip` uses Herald's existing place search, Leaflet map and shared FOSSGIS/OSRM route lookup. Routes have unlimited stops, accessible move/remove controls, optional stop dates, notes, a trip association and an optional fuel or EV estimate. Calculations run through two-point legs and the existing shared request throttle, so the provider's waypoint limit does not cap a saved journey. Each leg retains compact geometry and available distance/time metrics; changing a stop reuses unaffected legs. Failed replacement requests leave the previous saved route intact. Opening a saved route does not make fresh routing requests.

Ideas remain in `roadTrips` until the traveller explicitly chooses a genuine planned or completed journey and saves it. A genuine route creates or updates one linked car transport, retains every intermediate stop and writes each leg to the existing `resolvedRoutes` format. Calendar and Journey Map use these transport records, including their normal date and transport filters. Date-only road records retain real dates without fabricated clock times or assumed daily driving; individual stop dates narrow leg windows when available. Notes are stored in the existing notes collection. Adding an energy estimate to a trip budget is explicit and updates one source-linked expense rather than copying the cost repeatedly.

`roadTrips`, `currencyRates` and `currencyPreferences` are additive collections in the existing account payload. Account merge, guest import, exports and offline outbox recovery retain them; existing storage keys and database ownership/revision rules are preserved. No database migration is required. Unit tests cover arithmetic, historical dates, 103-stop routes, partial recalculation, persistence and import/merge preservation. Browser coverage includes desktop/tablet/phone in both themes, a provider-limit-exceeding route, Calendar/Map integration and two independent account sessions.
