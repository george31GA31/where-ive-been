# Herald Voyages

A static, local-first travel tracker for trips, countries, Calendar, Journey Map,
Atlas, travel statistics and planning tools. Guests keep their history on the
device; signed-in users synchronize private snapshots through Supabase.

## Start developing

```sh
npm ci --ignore-scripts
python -m http.server 8000
```

Open `http://localhost:8000/`. GitHub Pages serves the committed browser files
directly; no application server is needed.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for startup order, feature ownership,
shared state, authentication, sync/offline recovery, stored routes, logos, deployed
storage contracts and the intentionally retained compatibility layers.

`src/core/` and `src/calendar/` are the readable sources for `app-core.js` and
`calendar-experience.js`. Edit the source files, then run the build. Other named
root feature/model scripts remain directly authored. `src/browser-bundles.json`
defines the original shared scopes and concatenation order.

## Build and verify

```sh
npm run build
npm run check:build
npm test
npm run test:dom
npm run test:browser
python tests/test_country_import.py
```

The dependency-free build assembles the two browser bundles and refreshes the
offline-shell allowlist/version. Commit the generated files with their sources.
CI checks that they match, audits dependencies and runs functional/browser tests
and CodeQL. The pinned browser test dependencies are in `package-lock.json`.

Before an invisible refactor, keep a separate checkout of the previous release:

```sh
HV_BASELINE_ROOT=/absolute/path/to/baseline npm run test:visual
```

This compares before/after screenshots and travel/storage snapshots across both
themes and mobile/tablet/desktop layouts. Results are in
`test-results/visual-parity/`. `HV_CHROMIUM_PATH` can select a local Chromium binary.

## Configuration and compatibility

The normal static app requires no environment variables. `account-config.js`
contains the existing public Supabase URL and publishable/anon key. Keep secrets,
service-role keys and private credentials out of browser code and Git.

- [ACCOUNT-SETUP.md](ACCOUNT-SETUP.md): Auth/redirect/SMTP configuration and imports.
- [SECURITY.md](SECURITY.md): vulnerability reporting.
- [data/entry-requirements/README.md](data/entry-requirements/README.md): guidance provenance and refresh policy.
- [tests/PERFORMANCE-REVIEW.md](tests/PERFORMANCE-REVIEW.md): startup/retry diagnosis, checkpoints and stress measurements.
- [tests/TRACKERS-REVIEW.md](tests/TRACKERS-REVIEW.md): country/TCC and personal-statistics rules.
- [docs/MAINTAINABILITY-REVIEW.md](docs/MAINTAINABILITY-REVIEW.md): scope, preservation and verification of this cleanup.

Existing account/guest records, storage keys, revision checks and saved geometry
are compatibility contracts. Frontend deployment does not require a database
migration. Preserve original backups and unknown payload fields when extending
features; never reset storage to solve a loading problem.

## Publish

Use the existing pull-request checks, then merge the verified commit to `main`.
GitHub Pages publishes it through the existing build/deployment process. Wait for
deployment success and verify the served public files and UI. No SQL is applied
automatically. The offline shell replaces an installed version only after a
complete successful installation.

Live site: <https://george31ga31.github.io/where-ive-been/>.
