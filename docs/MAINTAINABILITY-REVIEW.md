# Version 1.0 maintainability review

The reference release was `dae26b8150b1645fd2fb89e25bdf6fca03968b39`, including
the preceding startup/recovery fixes. This pass preserves its UI, travel rules,
storage contracts and account protocol. It does not introduce a new framework.

## Changes a maintainer should know

- The compressed core and Calendar implementations now have readable authored
  sources in `src/core/` and `src/calendar/`. The small dependency-free build
  concatenates them into the existing browser URLs. Core keeps one shared global
  scope; Calendar keeps one private closure. Function hoisting, inline template
  text, dependency order and feature adapters remain intact.
- `app.js` now shows the dependency order one script per line. The final country
  and At Sea flag renderer is defined once in `src/core/display.js`, replacing
  three successive implementations. Domestic flag specialization and captured
  failed-image handling remain in their existing owners. The old `app-fixes.js`
  URL is retained as an inert compatibility file.
- The account client, cache, record projection, sync, adapter and network files
  are readable. Internal model/cache names and the remote-row method explain
  their roles. Comments identify hydration baselines, acknowledged/local state,
  revision guards, identity epochs, durable checkpoints and shared Retry. Their
  executable logic and existing bounded requests are preserved.
- Country definitions and artwork aliases live in two shared JSON files. The
  browser build embeds the original constants; the maintenance scripts read
  those same definitions instead of extracting them from source-code formatting.
  Every country code, name and alias is unchanged.
- The explicit flag import and scheduled health refresh rebuild the offline
  manifest. Editing an import script cannot automatically replace artwork:
  external flag import now requires its existing manual workflow dispatch.
- The concise README explains local setup, build, tests and publication.
  [ARCHITECTURE.md](ARCHITECTURE.md) maps feature ownership and documents state,
  authentication, sync, offline recovery, saved routes, logos, storage keys,
  external services and compatibility boundaries.

Generated bundles are committed and marked as generated for GitHub review.
Future changes belong in their authored sources, followed by `npm run build`.

## Preservation checks

The initial source extraction was checked against the original executable syntax
trees, including multiline template contents. A second syntax comparison covered
all six account/network files while accounting only for the documented internal
renames. The Calendar executable tree remains unchanged. The core's shared JSON
values, source ordering and final flag output were checked separately.

All existing CSS, vendor files, artwork, map/routing algorithms and established
planning datasets are unchanged. HTML changes are limited to script cache-version
parameters. There are no new database migrations, SQL writes, renamed persisted
fields, renamed storage keys or production record edits. Existing dependencies
retain their pinned versions; `pngjs` 7 is added only for screenshot comparisons.

The visual runner compares the reference checkout with the candidate using
identical populated fictional records and a fixed clock. It covers Home, Trips,
Calendar, Journey Map, Atlas, Countries, Stats, every main Travel Tools page,
People, trip planning, country/flight/accommodation editing and a hotel map popup
at 390, 768 and 1440 pixels in light and dark themes: 120 screenshot pairs. Atlas
uses pinned local copies of its real D3/TopoJSON/world-geometry dependencies.
Travel state and guest-storage snapshots must match exactly for every capture.

Repeated unchanged-release captures reproduced tiny antialiasing differences at
rounded form-control edges. The comparator does not mask any area: it allows at
most 64 pixels with a maximum channel delta of 3, only at rounded control/dialog
corners whose computed bounds and styles match exactly. All other pixels must
match. Images and detailed measurements are retained in `test-results/visual-parity/`.

## Validation

| Check | Result |
| --- | --- |
| Browser bundle/offline manifest generation and freshness | Passed |
| Existing and new Node unit tests | 234 passed |
| DOM integration | Passed |
| Country import tests | 3 passed |
| Existing real-Chromium browser runners | All 19 passed |
| Dependency audit | Zero vulnerabilities |
| Before/after visual and state comparisons | 120 passed; 115 byte-identical PNG pairs |

The five remaining pairs differ only within the bounded rounded-corner allowance
described above; travel/storage snapshots and control/dialog geometry and styles
match exactly. The comparison includes rendered Atlas country geometry.

The existing browser suite covers trip/accommodation/transport editing, calendars,
country/TCC counts, stats, notes/budgets/currency/road trips, manual plotting,
route fallback and persistence, uploaded logos, quotas, multi-session account
reconciliation, genuine offline reload, durable edits, expired sessions,
reconnection, backend outage and repeated Retry. Large-account fixtures retain
routes and identical logo strings through startup and recovery.

The new regression tests protect the shared flag renderer, captured failed-image
handling and maintenance-script use of the shared country catalogue. Existing
tests were retained. Browser/account tests use fictional data and intercepted
services; they do not sign into or write to a real user's account. SMTP delivery
and private account login were not exercised with production credentials. A
read-only production check confirmed existing account snapshots remained present.

Publication uses the existing Pages deployment. Verify the final merged commit's
deployment and served public-file hashes, then inspect its live responsive UI;
local tests alone are not deployment verification.

## Boundaries deliberately retained

- Classic global adapters and ordered scripts remain. Converting to ES modules
  would alter initialization and hoisting, requiring a separate behaviour review.
- The earlier manual-cloud/transfer functions remain isolated in
  `src/core/legacy-data.js`. The account adapter disables their controls; removing
  historical import globals and keys without compatibility evidence is riskier
  than clearly documenting them.
- Route snapping, water/rail fallbacks, saved geometry, account reconciliation,
  IndexedDB recovery and logo pooling keep their established rules. This pass
  explains their ownership instead of replacing those specialized systems.
- The CSS cascade and compatibility Calendar renderer remain. Dynamic pages and
  successive render adapters can make apparently unused styles/functions live;
  deleting them without stronger evidence would threaten the required parity.
- No speculative performance rewrite, library upgrade, new state framework,
  feature removal or UI redesign is included.
