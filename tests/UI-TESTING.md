# Automated and manual checks

Production remains static HTML/CSS/JavaScript. npm dependencies are development-only.

```sh
npm ci --ignore-scripts
npm test
npm run test:dom
npm run test:browser
npm run test:performance
node scripts/check-vendor-integrity.cjs
python tests/test_country_import.py
```

Browser checks use the pinned Chromium package and write screenshots to `test-results/browser` (ignored by git, uploaded by CI). Set `HV_CHROMIUM_PATH` to an existing compatible Chromium executable if extraction is unavailable. `HV_SCREENSHOTS` changes the output location.

Fixtures are fictional. Real D3 and world-atlas geometry are served locally, while account/visa external services are intercepted. Test dimensions are 390, 768 and 1440 pixels in both themes. The separate visual-parity runner compares two checkouts with identical fixtures and clocks. Exclude an intentionally changed scene with `HV_VISUAL_SCENES`; never use a mask to conceal a regression. Direct fixture mutations must call `persist()` before querying cached views, as real editors do. Airport-dependent fixtures request the lazy directory by opening the editor before waiting for it.

## Connectivity expectations

| Situation | Expected behaviour |
| --- | --- |
| Normal connection | Account sync and reference/map services can load; a real-account test is still required |
| Connection lost after loading | Guest edits persist locally; account engine preserves its durable outbox |
| Full offline reload | Works after the verified core shell is installed; unavailable reference data/tiles retain explicit fallback states and existing browser data remains intact |
| Account library unavailable | Clear library failure and a retry control that reloads the library |
| Account load failure | An owned checkpoint can display provisionally with local edits retained; remote writes wait for reconciliation. Without a usable checkpoint the tracker stays locked and Retry remains available |
| Save failure | Durable account outbox remains; explicit local-save wording |
| Guest storage failure | Form and in-memory edits remain, Retry attempts persistence, and unload protection remains until saved |
| Map libraries/geography unavailable | Map fallback remains visible |
| Reference dataset unavailable | Explicit unavailable/loading failure state, never a false zero achievement total |
| Visa source unavailable | No definitive result; link to live requirements |

Before release, use a controlled account and inbox to test sign-up, email confirmation, password reset, guest import, repeat import, simultaneous edits, conflicts, logout and recovery on two browser profiles. Verify callback allow-list in Supabase settings. Do not use real travel data as destructive fixtures.

The SQL scripts `account-security.sql` and `transfer-security.sql` run in rollback-only transactions against a correctly configured project. Never remove the rollback when running tests.

## September 2026 refinement regressions

`tests/refinements.test.cjs` checks general domestic-trip classification, explicit-home precedence, home counted once, saved-place deduplication and private profile scope, additive import/merge, historical snapshots, unique foreign-date statistics, date-line accommodation order and airport details. No production data is used.

`tests/refinements-browser.cjs` runs alongside the existing browser suite at 390, 768 and 1440 pixels. It exercises mouse/touch first-click map selection, selection through zoom, coincident-stop expansion, three-country/three-accommodation days within the existing cell height, visa acknowledgement and passport changes, click-away/Escape, home/trip choices, optional accommodation times, and saved-place reuse/removal after refresh. Its screenshots are in `test-results/refinements`.

Calendar keeps a month grid with country bands, transport and accommodation. Version 1 uses compact country codes beside flags, full-width hotel rows with check-in/out cues, and a visible all-entry action on dense dates. On phones, hotel counts lead to full day details rather than rendering unreadable hotel fragments. The underlying half-day/date model is preserved; presentation no longer paints two hotels into halves of one row.

## Version 1 Calendar and release regressions

`tests/calendar-cell-browser.cjs` checks 360, 390, 768, 1024 and 1440 pixels in both themes. It verifies country chronology, complete accessible labels, 3-9-country dates, access to overflow entries, accommodation boundaries, connecting flights, editable details, range selection, keyboard activation and unchanged in-memory/stored records. Screenshots and measured geometry are saved under `test-results/calendar-cell`. The new cell heights are 104, 145 and 160 pixels for phone, tablet and desktop respectively.

`tests/calendar-cell.test.cjs` continues to protect the separate check-in/check-out, local-time, ordering and simultaneous-stay semantics. User data is never changed to fit the presentation.

`npm run test:v1` tests the twelve product areas, individual tools and all four standalone account routes at 1440x900, 1280x800, 1024x768, 768x1024, 390x844 and 360x800, with light and dark themes. It also exercises all five Cancel steps, Upcoming defaults, return-stage wording, the Saved places editor and focus return, range-to-note wording, trip filters, the budget prerequisite/return path, enquiry draft restoration and a configured email handoff. Its enquiry address is fictional and no email is sent. Screenshots, contrast samples and coverage are written to `test-results/v1-release`.

To check a real build upgrade with private fixture storage, run `HV_PREVIOUS_ROOT=/absolute/path/to/previous/checkout node tests/v1-update-browser.cjs`. This waits for the new worker itself to activate after old tabs close, then verifies records, a pending/deletion sentinel, Pakistan's flag and an offline reload. It does not clear storage or skip the normal worker lifecycle. Account outbox semantics are independently tested by the account unit tests and two-device SDK/browser integration.

## October performance and daily plans

`tests/daily-plans.test.cjs` checks elapsed country totals, overlapping/split visits,
home/profile/cancellation rules, interval windows and priority projections.
`tests/daily-plans-browser.cjs` verifies the Algeria 11 + 10 = 21 days / 2 visits
example, next-day rollover, Calendar note create/edit/move/delete/reload, failed-save
retention with a stable ID, existing hotel/transport editors, profile isolation,
responsive panels and unchanged unrelated payload fields.

`tests/account-loading.test.cjs` covers early cache display, stalled/missing remote
rows, edits during reconciliation, identical clean hydration, immutable merge bases
and revision-only acknowledgements. `tests/account-size.test.cjs` checks PostgreSQL
JSONB byte formatting, numeric expansion and invalid strings. One fictional UTF-8
fixture was also checked directly against `octet_length(jsonb::text)` on the existing
server. No production payload is a fixture.

`tests/route-pause-browser.cjs` holds a provider response while leaving the map,
asserts abort/no queued requests, resumes it once, and verifies camera, geometry and
retained-surface behaviour. `tests/offline-shell-delivery-browser.cjs` uses real
service workers and miniature releases to check hashes, cache-first reads, waiting
updates, old-cache retention, stalled bodies, encoded paths and private-request
exclusions. It also checks hash-validated reuse of unchanged public assets and
network replacement of deliberately corrupted cached bytes. The real release
upgrade fixture records core download counts and checks that unchanged D3 is
reused while the repaired Pakistan flag is fetched.

`tests/priority-performance-browser.cjs` runs fictional signed-in histories with
8, 160 linked and 800 unlinked records. Large payloads include saved geometry and
repeated artwork and remain below the existing server cap. Cached reloads delay
the remote read by 3 seconds. `HV_BENCH_OUTPUT` writes JSON and `HV_ROOT` targets a
baseline checkout. `HV_PERF_ASSERT=1` enforces cache-ready under 2 seconds, first
priority handlers under 750 ms and repeat/post-note handlers under 150 ms. Service
workers are blocked for this view-work comparison; worker delivery is tested
separately. Report handler and paint timings as controlled Chromium measurements,
not field INP, low-end phone performance or proof that every long task is removed.

Keep runtime checksum/advisory review separate from `npm audit`: the latter covers
the npm graph, while the app serves committed vendor files. The inventory records
versions/provenance and application handling of relevant upstream advisories.
