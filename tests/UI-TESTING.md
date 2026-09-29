# Automated and manual checks

Production remains static HTML/CSS/JavaScript. npm dependencies are development-only.

```sh
npm ci --ignore-scripts
npm test
npm run test:dom
npm run test:browser
python tests/test_country_import.py
```

Browser checks use the pinned Chromium package and write screenshots to `test-results/browser` (ignored by git, uploaded by CI). Set `HV_CHROMIUM_PATH` to an existing compatible Chromium executable if extraction is unavailable. `HV_SCREENSHOTS` changes the output location.

Fixtures are fictional. Real D3 and world-atlas geometry are served locally, while account/visa external services are blocked. Test dimensions are 390, 768 and 1440 pixels in both themes. Screenshots plus geometry/keyboard assertions support review; there are no pixel-diff baseline claims.

## Connectivity expectations

| Situation | Expected behaviour |
| --- | --- |
| Normal connection | Account sync and reference/map services can load; a real-account test is still required |
| Connection lost after loading | Guest edits persist locally; account engine preserves its durable outbox |
| Full offline reload | Not supported: no service worker/application-shell cache is provided; existing browser data must remain intact |
| Account library unavailable | Clear library failure and a retry control that reloads the library |
| Account load failure | Tracker remains locked to avoid overwriting unread account data; retry remains outside the lock |
| Save failure | Durable account outbox remains; explicit local-save wording |
| Map libraries/geography unavailable | Map fallback remains visible |
| Reference dataset unavailable | Explicit unavailable/loading failure state, never a false zero achievement total |
| Visa source unavailable | No definitive result; link to live requirements |

Before release, use a controlled account and inbox to test sign-up, email confirmation, password reset, guest import, repeat import, simultaneous edits, conflicts, logout and recovery on two browser profiles. Verify callback allow-list in Supabase settings. Do not use real travel data as destructive fixtures.

The SQL scripts `account-security.sql` and `transfer-security.sql` run in rollback-only transactions against a correctly configured project. Never remove the rollback when running tests.

## September 2026 refinement regressions

`tests/refinements.test.cjs` checks general domestic-trip classification, explicit-home precedence, home counted once, saved-place deduplication and private profile scope, additive import/merge, historical snapshots, unique foreign-date statistics, date-line accommodation order and airport details. No production data is used.

`tests/refinements-browser.cjs` runs alongside the existing browser suite at 390, 768 and 1440 pixels. It exercises mouse/touch first-click map selection, selection through zoom, coincident-stop expansion, three-country/three-accommodation days within the existing cell height, visa acknowledgement and passport changes, click-away/Escape, home/trip choices, optional accommodation times, and saved-place reuse/removal after refresh. Its screenshots are in `test-results/refinements`.

Country names use compact country codes alongside flags when several countries share a narrow phone cell; full names and airport details remain in accessible labels and the day panel. The busiest phone cells use flags and airport endpoints to keep each record individually visible; the full connected route stays in the date panel. Cell heights stay at 88, 124 and 136 pixels for phone, tablet and desktop. External visa data is provisional, with a neutral unknown state and official-source checks rather than a guarantee of entry eligibility. Live Supabase authentication and multi-device operation require the controlled-account checks above; automated sync tests cover the unchanged account payload contract and added collections.
