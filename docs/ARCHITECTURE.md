# Herald Voyages developer guide

Herald is a static, local-first application written in plain JavaScript. GitHub
Pages serves the HTML, CSS, data and committed browser scripts. Supabase supplies
email/password authentication, private account snapshots and encrypted transfers.
There is no application server, React tree or SPA compilation service.

## Start here

1. Read `index.html` for the shared shell, forms and script entry points.
2. Read `app.js` for the ordered browser dependencies.
3. Read `src/core/state.js`, `src/core/shell.js` and `src/core/startup.js` for the
   mutable travel state, initialization and the original render/persistence hooks.
4. Read `voyages.js` for hash routes, page mounting, navigation and the active UI.
5. Read `account-tracker.js` for the boundary between that mutable UI and accounts.
6. Follow the feature table below, rather than editing a generated browser bundle.

### Authored sources and browser bundles

`src/browser-bundles.json` lists the source files and their execution order.
`npm run build:browser` concatenates them into the existing `app-core.js` and
`calendar-experience.js` URLs. The output is committed because Pages serves it
directly. Generated files identify their source sections and are marked as
generated in `.gitattributes`; edit the corresponding `src/` file instead.

This small Node script uses no additional dependencies. Core fragments retain
their original shared global scope. Calendar fragments retain one private,
strict-mode closure. They are **not independently loaded modules**. Keeping each
bundle as one script preserves declaration hoisting, global adapters and startup
order. Splitting the network requests or changing to ES modules would need a
separate compatibility review. Template text is concatenated without reindentation.

`data/country-catalog.json` and `data/flag-name-aliases.json` are shared static
definitions. The build embeds them as the original browser constants; Python/Node
import and health-refresh scripts read the same JSON directly. They no longer
extract data from generated JavaScript with formatting-sensitive regular expressions.

The remaining root JavaScript files are their own authored browser/model modules.
Moving them solely to change folder names would churn static URLs, workers and
offline manifests. Their feature ownership is listed here.

## Feature ownership

| Area | Main files | Responsibility |
| --- | --- | --- |
| Shared state and compatibility | `src/core/state.js`, `src/core/display.js`, `src/core/travel-days.js`, `src/core/catalogs.js` | Version-2 normalization, guest saves, UTC date calculations, flags, country/rule constants |
| Initialization and Home | `src/core/shell.js`, `src/core/startup.js`, `dashboard-enhancements.js` | Original event binding, active-page rendering, dashboard widgets |
| Navigation and shared chrome | `voyages.js`, `theme.js`, `index.html` | Hash routes, detached pages, navigation, document titles, theme |
| Trips and stays | `src/core/stays.js`, `trip-experience.js`, `journey-model.js` | Country date entries, trip editors, phase/scoping calculations |
| People and home history | `src/core/people.js`, `home-choice.js`, `journeys.js` | Traveller passports, residences, home-country choices |
| Calendar grouping | `src/calendar/groups.js` | Read-only trip/stay/transport groups and day membership |
| Calendar display | `src/calendar/month.js`, `src/calendar/details.js`, `calendar-layout-model.js`, `calendar-details.js` | Month cells, measured wrapping, selected dates and details |
| Calendar editing | `src/calendar/planner.js`, `src/calendar/events.js`, `accommodation-times.js` | Trip planner, validation, date actions and event capture |
| Atlas and country counts | `src/core/atlas.js`, `map-enhancements.js`, `atlas-model.js`, `country-count-model.js` | World geometry, read-only grouping, count preferences and map colours |
| Manual visits and TCC | `country-visit-model.js`, `country-trackers.js`, `data/tcc-destinations.js` | Manual country dates/precision; independent TCC destination IDs |
| Journey Map | `journey-map.js`, `journey-library.js`, `journey-global-model.js` | Global history, filters, markers, popups and record lists |
| Transport | `journeys.js`, `flight-editor.js`, `transport-details.js`, `transport-icons.js`, `journey-presentation.js` | Flight legs, transport editors and existing display conventions |
| My Flights / transport dashboard | `transport-dashboard-model.js`, `transport-dashboard.js`, `transport-dashboard.css` | Scoped projections, endpoint-local dates, five-mode selector, search and 40-row pages |
| Operator logos | `transport-operators.js`, `accommodation-logos.js` | Shared private operator identities, conservative matching and aspect-preserving artwork uploads |
| Route geometry | `journey-routes.js`, `route-persistence.js` | Provider lookup, rail/water/road fallbacks and saved geometry |
| Accommodation and logos | `accommodation-place-model.js`, `saved-places-model.js`, `accommodation-logos.js`, `place-search.js` | Physical-property matching, shared catalogue, uploads and manual plotting |
| Places | `saved-places.js`, `journeys.js`, bundled `data/*.json` | Private saved places and catalogues of capitals, mountains, UNESCO sites and buildings |
| Notes, checklists and budgets | `travel-tools.js`, `budget-model.js`, `travel-costs.js` | Existing travel-tool UI and costs linked to transport/accommodation |
| Currency | `currency-model.js`, `currency-converter.js`, `currency-catalog.js` | Reference/custom rates, arithmetic, saved rates and favourites |
| Road trips | `road-trip-model.js`, `road-trip-planner.js` | Stops, reusable legs, explicit Calendar/Journey Map promotion and scoped drafts |
| Statistics | `travel-history-model.js`, `travel-stats.js`, `journeys.js` | Read-only lifetime/date calculations, six detailed personal statistics and achievements |
| Entry and health guidance | `entry-checker.js`, `entry-rules.js`, `entry-health.js`, `visa-notices.js`, `src/core/planning.js`, `data/entry-requirements/` | Passport/destination lookup, optional trip context, health and acknowledgements |
| Account pages | `account-pages.js`, `login/`, `register/`, `profile/`, `reset-password/` | Email/password forms, profile settings, password recovery and account imports |
| Auth and account adapter | `account-client.js`, `account-tracker.js` | SDK instance/session checks, identity changes, UI hydration and shared Retry |
| Sync and recovery | `account-sync.js`, `account-model.js`, `account-records.js`, `account-cache.js` | Reconciliation, revisions, preserved legacy rows and durable checkpoints |
| Transfers | `herald.js` | Current encrypted guest transfer, account import and pending-import recovery |
| Connectivity and diagnostics | `network.js`, `account-diagnostics.js`, `account-preview-worker.js` | Bounded service requests, connection events, opt-in metadata and background import previews |

### Styling ownership

`styles.css` supplies the underlying components; `voyages.css` supplies Herald's
shell and responsive presentation. Calendar, Journey Map/presentation, accounts,
travel tools and currency/road tools have their corresponding named sheets.
The cascade and load order are part of the existing UI contract. This cleanup
does not remove selectors or reorder stylesheets. Keep theme and responsive
comparisons when altering a shared selector.

## State and rendering

`state` is a global lexical binding initialized in `src/core/state.js`. Feature
editors update it and call `persist()`. Pure model files expose their existing
`HV…`/`WIB…` APIs and are also loadable by Node tests. They should receive records
as inputs instead of acquiring DOM state or writing storage themselves.

`voyages.js` owns `HVPages`: inactive page elements are detached and kept in
memory. `getElementById` alone cannot find a detached form. Existing lookup
helpers use `document.getElementById(id) || HVPages.get(id)`. Retain that fallback.
Removing a detached node or cloning a form would invalidate saved element
references and event handlers.

Completed page renders are reused until persistence, account hydration, the active
traveller, the day, Calendar month or country route changes. `HVPages.revision`
invalidates feature projections when records are saved. Inactive People panels
are not rebuilt on every link click; the traveller selector has its own inexpensive
refresh. Journey Map retains the same Leaflet surface across unchanged visits.
Full-screen layout captures the camera before changing dimensions and resizes that
surface without rebuilding routes, filters or the selected popup.

Existing layers wrap global hooks such as `renderAll`, `switchView`, `persist`
and editor functions. `app.js` keeps their deliberate order. The Calendar
experience owns the enhanced month renderer; `src/core/calendar.js` preserves the
underlying compatibility renderer. `map-enhancements.js` still owns domestic
destination flag specialization. Shared country/At Sea flag markup is now defined
once in `src/core/display.js`; `security-runtime.js` owns failed-image handling.
`app-fixes.js` remains an inert URL for installed older shells.

### Transport dashboard and operator artwork

`#/my-flights` reads existing scoped `transports` through `HVJourney`; it does not
store a second collection of journeys. Flights project individual legs, while
ground journeys retain their existing records and via stops. The five modes use
the current `flight`, `train`, `boat`, `bus` and `car` values. Local endpoint times
stay local; countdowns and ordering convert known endpoint timezones through Intl.
Unknown times remain visibly missing and reliable live status is not invented.

The list and map are limited to 40 visible entries. `HVJourneyMap.mountGlobal`
accepts `{viewer:true}` for this screen: it reads saved routes through
`HVRouteStore`, makes no route-provider requests and never writes route geometry.
Unsaved flights use the existing connection arc helper; unsaved surface records
retain endpoint connections or stops rather than generating a fresh mapped route.
Selection and edits reuse the current map surface, popup presentation and editors.

The optional `transportOperators` collection belongs to the same version-2 account
payload and participates in its existing merge, guest import, export and offline
checkpoint paths. Each mode/name identity stores at most one `operatorLogo` PNG.
Matching normalises case, whitespace and accents, or uses an existing directory ID;
it does not fuzzy-match different names. Historical records resolve logos without
a bulk migration. Logo changes/removals apply to that shared identity. Editor drafts
commit with the transport save, discard unfinished identity changes and reject an
account/traveller switch. Unrelated legacy flight legs are preserved exactly.

Uploads reuse `HVAccommodationLogos.prepare`: images fit within a transparent
128px canvas with aspect ratio preserved and a bounded PNG data URL. Account-cache
asset pooling handles operator and hotel artwork without changing its existing
checkpoint format. No database or storage-key migration is required.

Use existing feature entry points for refresh and editing. Do not call every
renderer from a new data event: Home intentionally avoids hidden import previews,
hotel image elements, saved-route decoding and detailed statistics.

## Data contract

Guest and account histories use the existing version-2 object. Major arrays are
`profiles`, `trips`, `stays`, `residences`, `transports`, `transportOperators`, `accommodations`,
`placeVisits`, `savedPlaces`, `notes`, `checklists`, `budgets`, `expenses`,
`roadTrips`, `currencyRates`, `currencyPreferences`, `manualCountryVisits`,
`tccVisits` and `visaAcknowledgements`. Stable record IDs and cross-record
references drive imports, reconciliation and linked costs. Preserve unknown fields.

Country dates are inclusive `YYYY-MM-DD` calendar dates with UTC arithmetic.
Transport records can have local timestamps, distinct legs and endpoint identities.
Do not reinterpret date-only entries as fabricated departure times. Manual country
visits have different date precision from stays; TCC has its own denominator and
must not silently affect normal Atlas/country counts.

Hotel artwork belongs to `savedPlaces[].accommodationLogo`, as an existing PNG data
URL and timestamp; linked accommodation records identify the shared physical
property. Grouping is read-only and conservative. A shared hotel marker does not
mean the original stays have been merged. Other/unknown artwork fields round-trip
with the payload; this cleanup adds no airline/operator catalogue.

## Authentication and sync

`WIBAuth` creates the configured Supabase SDK client once. The SDK stores and
refreshes sessions. Cached identity selects only that user's local recovery data;
it cannot authorize remote reads or writes. `revalidate()` checks/refreshed session
state and verifies the user through Auth. RLS and the save RPC remain authoritative.

The adapter (`account-tracker.js`) keeps these responsibilities separate:

1. Restore the identity and start one shared account load.
2. Project malformed legacy rows out of display while retaining their original data.
3. Normalize the mutable display state and record its hydration baseline.
4. Turn real editor differences into payload changes, excluding unchanged UI defaults.
5. Connect status, conflicts, Retry, import previews and visible-page refresh to the UI.

The sync service (`account-sync.js`) has no tracker DOM dependency. `base` is the
acknowledged merge base, `local` is the current edit copy, `revision` guards writes,
and `epoch` invalidates work after an identity change. Startup callers share one
flight. A clean periodic check selects only `revision`. Actual edits/recovery read
the current payload, run the existing three-way merge, and call `save_travel_account`
with `p_payload` and `p_revision`. A conflict never authorizes blind replacement.
Edits arriving during a save remain pending; old-identity responses are ignored.

`account-cache.js` writes atomic, verified per-account/per-tab IndexedDB checkpoints.
It pools **identical** logo strings locally and expands them back to the unchanged
remote format. Legacy localStorage outboxes remain readable and are a fallback.
An unreadable checkpoint is preserved/diagnosed rather than replacing a valid cloud
read. An offline-save status requires a committed checkpoint; failure retains edits
in memory and the existing keep-this-tab-open/unload protections.

Manual Retry and `hv-reconnect` use one promise, existing session verification and
one controlled load/flush. `network.js` owns browser connectivity, debounced
reconnection and provider request deadlines. A provider's 503 does not declare the
whole app offline. Auth, connectivity, service reachability and sync readiness are
distinct states. `account-diagnostics.js` is opt-in (`?heraldDebug=1`) and records
bounded metadata, not passwords, tokens or travel contents.

## Storage compatibility

These names are deployed contracts. Do not rename them as part of tidying.

| Location/key | Purpose |
| --- | --- |
| localStorage `whereIveBeen.data.v2` | Original guest/device history |
| localStorage `whereIveBeen.stays.v1` | Older stays-only history, still readable |
| localStorage `whereIveBeen.guest.v1` | Separate guest history after a device copy is claimed |
| localStorage `whereIveBeen.localOwner.v1` | Account ownership of the original device copy |
| localStorage `whereIveBeen.beforeAccounts.v1` | Original pre-import backup |
| localStorage `whereIveBeen.importNoticed.<userId>` | Import-notice preference |
| localStorage `whereIveBeen.auth.v1` | Supabase SDK session storage |
| localStorage `whereIveBeen.theme.v1` | Existing light/dark preference |
| localStorage `whereIveBeen.lastSaved.v1`, `whereIveBeen.cloud.v1` | Original device-save metadata/manual-cloud compatibility |
| sessionStorage `whereIveBeen.tab.v1` | Tab identity for durable recovery |
| localStorage/IndexedDB entry `whereIveBeen.outbox.v1.<userId>.<tabId>` | Recovery base, edits and revision; old formats remain readable |
| IndexedDB `whereIveBeen.account.v1`, store `outbox` | Atomic packed recovery checkpoints |
| localStorage/sessionStorage `herald.pendingImport.v1.<userId>` | Interrupted account-import copy |
| sessionStorage `herald.roadDraft.v1.<userId-or-guest>.<profileId>` | Account/profile-isolated road draft |
| Supabase `travel_tracker_data` | Owner-private `user_id`, `payload`, `revision` and update metadata |

`src/core/legacy-data.js` isolates earlier manual push/pull, backup and transfer
functions. The normal account adapter disables the earlier cloud/transfer controls;
the maintained flow is in `account-tracker.js`, `account-pages.js` and `herald.js`.
These older globals/storage expectations were retained rather than guessing that
every historical import/integration is gone. Never restore the old upsert path as
an alternative to the revision-checked service.

## Maps and saved routes

Leaflet renders Journey Map and plotting controls; D3/TopoJSON render Atlas from
bundled world geometry. `journey-routes.js` resolves mode-specific geometry.
`route-persistence.js` stores it on the transport record under `resolvedRoutes`,
with the existing version, signature, compact polyline, provenance flags and
refresh token. Its coordinates are `[latitude, longitude]`; provider/GeoJSON
boundaries may use `[longitude, latitude]`. Preserve that conversion boundary.

Saved geometry is checked before calling providers. A changed endpoint/type/leg
signature or explicit Recalculate can request replacement. A failed lookup must
not replace a useful saved route. Offline drawing can use the previous geometry.
Rail follows appropriate connected infrastructure without requiring the exact
scheduled service; water fallbacks avoid land with bounded approximation. Those
algorithms, thresholds and styles are unchanged here. Geometry is not country-visit
evidence. Road ideas become transport/Calendar records only through the existing
explicit genuine-trip action.

## External services and bundled assets

| Service | Existing role |
| --- | --- |
| Supabase | Auth, ownership RLS, revision-checked account saves and one-use encrypted transfer RPCs |
| Photon/Komoot | Forward/reverse place search and location enrichment |
| OpenStreetMap tiles | Leaflet basemaps; not cached in the offline shell |
| OpenStreetMap Overpass/read-only extracts | Transport infrastructure and place enrichment |
| FOSSGIS/OSRM | Road geometry through the existing shared request throttle |
| Frankfurter v2 | Reference currency rates; manual/custom rates remain separate |
| Bundled passport-index/official guidance/TravelHealthPro snapshot | Entry/health checker; refresh/provenance are documented in `data/entry-requirements/README.md` |
| Flag CDN/Wikimedia fallback | Legacy flags when a bundled asset is unavailable |

Vendor code, transport icons, flags, country geometry and planning datasets retain
their existing paths and licences. Generated data is not hand-refactored.

## Development and deployment

Use Node with the committed lockfile and Python 3 for country-import tests:

```sh
npm ci --ignore-scripts
python -m http.server 8000
```

Open `http://localhost:8000/`. A server is needed for fetch/worker/service-worker
behaviour. Tests use fictional data and intercepted service responses. Production
configuration is in `account-config.js` and the existing setup SQL/documents.
No environment variables are required for the normal static app. Browser config
contains only the public publishable/anon key; private credentials belong outside
the repository. Do not apply SQL merely to deploy a frontend change.

After editing `src/` or public assets:

```sh
npm run build
npm run check:build
npm test
npm run test:dom
npm run test:browser
python tests/test_country_import.py
```

The build assembles the two committed scripts and refreshes `sw.js`'s public-asset
allowlist/content version. It does not change travel schemas. CI rejects stale
bundles/manifests and checks dependencies, functional/browser tests and CodeQL.
The browser runner uses its pinned Chromium; `HV_CHROMIUM_PATH` can select an
existing binary when needed locally.

For an invisible refactor, make a separate checkout of the release being preserved
and run the new comparison runner against it:

```sh
HV_BASELINE_ROOT=/absolute/path/to/baseline npm run test:visual
```

It compares populated pages, tools, forms and a Journey Map popup at 390/768/1440px
in both themes, with a fixed Date and identical unavailable external services.
It checks exact pixels and normalized travel/storage snapshots. Identical-release
control runs reproduced 1–2 RGB-level rounding at form-control corners. The
comparator permits at most 64 pixels with a maximum channel delta of 3, confined
to rounded control/dialog corners with identical computed styles and bounds.
No screen is masked and all other pixels must match. Before/after
images and `comparison.json` are in `test-results/visual-parity/`. Existing browser
runners cover live interactions, auth/sync, offline recovery, routes and logos.
These are complementary checks, not a substitute for real-account email delivery.

Publishing uses the existing GitHub Pages build/deployment from `main`. Merge only
the checked commit, wait for Pages success, then check the public asset hashes and
the served UI. `sw.js` installs complete public shells in bounded batches; failed
installation retains the previous version. It excludes account APIs, tokens and
third-party tiles. Cached users can therefore see an earlier working shell until
the new installation completes; do not ask them to clear their travel storage.

The scheduled health refresh also rebuilds the offline manifest before committing
its public dataset. The SlapsGame artwork import is intentionally **workflow_dispatch
only**: editing its maintenance script must not automatically fetch and publish
different artwork during a code cleanup. Its explicit run still uses the same
import and existing Pages process.

## Boundaries kept deliberately

This pass changes code organization and clarity, not business rules. It keeps
classic-script adapters, legacy compatibility, route algorithms, persisted keys,
vendor versions and the CSS cascade. Do not combine their removal/replacement with
a feature change. Future work should start with the owning files above, extend the
existing model/editor/persistence path, and protect that feature's data and visuals.
