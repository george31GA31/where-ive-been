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

Exactly two countries appear side by side as flags, with complete country names in hover/focus details, accessible labels and the date panel. A touch tap retains the country editor and its complete name. Single-country days retain their flag and name. Routes use the full width and can wrap when a second line fits inside the cell; genuine overflow still has complete hover/focus and date-panel details. Cell heights stay at 88, 124 and 136 pixels for phone, tablet and desktop. External visa data is provisional, with a neutral unknown state and official-source checks rather than a guarantee of entry eligibility. Live Supabase authentication and multi-device operation require the controlled-account checks above; automated sync tests cover the unchanged account payload contract and added collections.

## October Calendar cell regressions

`tests/calendar-cell-browser.cjs` checks 360, 390, 768, 1024 and 1440 pixels in both themes. It covers country chronology, long names, visa/Schengen indicators, hover, keyboard focus, touch editing, half-day hotel boundaries, intermediate nights, concurrent hotels, separate full-width flight/ground rows, connecting flights, date ranges, editing and unchanged in-memory/stored records. Hotels keep their fixed row height and use a second line only when it fits. Check-in occupies the right half, check-out the left; an empty half stays unpainted. Concurrent records within the same half share that half rather than stretching across the date.

Screenshots and geometry are saved to `test-results/calendar-cell`. To compare the same fixture before and after, run the suite with `HV_COMPARE_ROOT` pointing to a checkout of the previous version, `HV_CALENDAR_BASELINE=1`, and `HV_SCREENSHOTS` pointing to a separate output directory. Run the changed version with `HV_BASELINE_SCREENSHOTS` pointing to that directory. This compares every cell's width, height and borders, the Calendar dimensions and the single-country presentation; inspect both sets of screenshots as well.

`tests/calendar-cell.test.cjs` verifies the half-day model without altering any source record, including optional times, reversed records and concurrent arrivals/departures.
