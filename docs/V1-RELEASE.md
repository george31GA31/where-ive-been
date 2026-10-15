# Herald Voyages release review

Prepared against published baseline `dedd9d0add75598a1a25f4e426c3dfc6a54c1758`, using the owner's implementation brief, surface audit and populated screenshots. This is the implementation and verification record for the release candidate. The associated pull request and Pages deployment provide the final commit and publication status.

The result keeps Herald's identity and familiar Calendar, with a smaller header, grouped navigation, clearer populated days, coordinated Home cards and complete trip, transport and saved-place journeys. The Pakistan flag's display WebP was empty; it has been rebuilt from the intact original. An empty British Virgin Islands display asset was repaired too. Flag generation now verifies output before replacing an existing file.

## Twelve-area completion

| Area | Result | Audit references / verification |
| --- | --- | --- |
| Home | Consistent Today/Tomorrow/memory titles and metadata, natural card heights, useful empty composition. On phones, Today and Tomorrow precede memories. Transport, hotel, country and note priority retained. | H1–2; populated screenshots and agenda regression |
| Calendar | Existing month grid, date selection, layers, records and detail actions retained. Full-width meaningful hotel labels, In/Out cues, restrained country codes and explicit all-entry details for dense days. Year arrows browse years in Year overview; range notes explain the actual date. | CA1–2; dense 3–9-country days, boundaries and ten viewport/theme scenes |
| Trips | Lower Cancel works on all five steps and after rapid reopening. One main list, secondary grouping, distinct empty/filter states, correct upcoming/ongoing labels and working existing-trip selection. | TR1–3; wizard, filtering, grouping and creation regressions |
| My Flights & transport | Upcoming starts Planned, future Completed entries receive validation, all five modes remain available, return continuation explains the unsaved next step. Independent return dates and pair persistence retained. | FL1–3; creation/edit/reload, return-pair and two-device/logo tests |
| Journey Map | Reusable addresses and dated visits are distinguished. Saved places manager suspends while the editor accepts input, then restores focus. Property/address and city/country search scope is visible. | JM1–3; editor input/Cancel/focus, route and historical snapshot tests |
| Atlas | Whole-country blue selection with a restrained blue border, clear country cue and visible travel-history link. Selecting a country never marks it visited. | AT1 and owner override; colour and state-preservation regression |
| Personal trip planning | Finished service explanation, scope/quote process, deliverables, FAQs, detailed request, review, session draft, copy/download and configurable email handoff. | PT1; validation, reload, isolation and configured handoff tested; inbox dependency below |
| Countries | Autosave explanation and actual sync feedback above the tracker, Close tracker action, directory/count definitions and corrected entries/UNESCO/unavailable wording. | CO1–3; tracker and two-device persistence tests |
| Places | Clear country/category/status path and contextual link distinguishing reference visits from reusable addresses and dated map locations. | PL1–2; populated/empty states and saved-place regressions |
| Travel Statistics | Compact empty action and accurately labelled recorded-history totals. Missing-end ongoing stays now accrue through today without writing an end date or completing the stay. Scheduled future ends retain elapsed-only totals. | ST1; controlled 11 prior + 10 elapsed = 21 days / 2 visits, next day 22, cancelled exclusion, unchanged fields |
| Travel Tools | Shared aligned cards, readable dark results, Stay planner passport/history assumptions and calculated latest departure with year. Budget creates a prerequisite trip and returns to its budget. Checklist labels, close controls and road saved-state language are coherent. | TT1–6; tools, currency, route persistence, prerequisite journey and contrast tests |
| Account and travellers | Account identity/sync and traveller/passport/home settings are labelled distinctly. One guest-transfer panel precedes the footer; duplicate asynchronous insertion and duplicate brand script loading are prevented. Existing auth, recovery, retry, outbox and deletion machinery retained. | AC1–3; real SDK with deterministic endpoints, two-device, recovery, offline and quota tests |

Shared changes X1–4 apply throughout: serif heading/UI text roles, consistent fields/cards/buttons/focus, accessible names and grouped menus. Desktop, touch and keyboard menu operation is retained, with one Account area and page location cues. Existing URLs, aliases and browser history continue to work. The audit-by-audit [implementation ledger](V1-IMPLEMENTATION.md) records the changes.

## Data preservation and update evidence

No database migration, payload schema change, storage-key rename or travel-record rewrite is introduced. Existing IDs, trip/profile associations, dates, logos, saved route geometry, manual visits, preferences and import/export contracts remain. The ongoing-stay correction changes read-only projections; the original record, including its absent end date, is unchanged. Enquiry drafts use separate per-user session storage and never create travel records.

Tests compare fields and associations as well as counts. The account suites exercise pending edits, stale responses, conflict retries, deletion tombstones, account ownership, recovery, reconnects and two-device changes. The actual previous-app/service-worker upgrade test installs the baseline, preserves fixture records and a pending/deletion sentinel, activates the new worker by closing old tabs, then verifies the new shell, decoded Pakistan flag and offline reload without clearing storage. See [upgrade result](v1-evidence/update-check.txt). The sentinel check is supplemented by the account suites' semantic outbox/deletion tests; it is not a substitute for them.

All writes used fictional local fixtures with external service calls blocked or deterministic mocked endpoints. The production owner account and its records were not modified or inspected as a private export. No actual enquiry or recovery email was sent.

## Actual verification and limits

- **265 unit tests**, DOM integration, country import, vendored runtime inventory, generated-build consistency and whitespace checks passed. No new dependency was added; `npm audit` reported zero vulnerabilities.
- **All 25 browser scripts passed**, including the new release suite. The [script results](v1-evidence/browser-checks.json) record the final outcome after corrections, rather than retaining failed intermediate expectations as passing runs.
- **300 rendered states**: 21 application views plus login, registration, password reset and Account, at 1440×900, 1280×800, 1024×768, 768×1024, 390×844 and 360×800, each light/dark. No page errors or page-level horizontal overflow in this suite. [Raw coverage](v1-evidence/coverage.json).
- Additional populated Calendar tests cover ten width/theme combinations, dense days, all-entry access, check-in/out boundaries, editing and unchanged record fields. Transport tests cover all five modes, twelve responsive/theme scenes, logo replacement/removal, historical reuse and deterministic two-device sync.
- Tested keyboard date selection, native menu operation, Cancel/Close/Escape paths, editor focus return and touch emulation. Sampled Stay planner dark result values measured **10.58:1** foreground/background contrast; this is a specific measured result, not a claim of complete accessibility conformance. [Measurements](v1-evidence/contrast-dark.json).

The initial candidate's GitHub CodeQL job passed. Its two remaining findings also occur in the previous release scan, in unchanged files: a substring URL match in the city-autofill test mock and an origin-check warning on the dedicated import-summary worker. The worker is created directly by same-origin account code and returns only a summary to its owner. No alert was dismissed, scan disabled or security gate bypassed. The final branch is scanned again after the last wording changes.

These are headless Chromium and responsive emulation checks, with selected desktop and phone screenshots manually inspected. They do not establish real-device, Safari, screen-reader, mobile operating-system keyboard, browser text-enlargement or formal accessibility coverage. Authentication, recovery and delivery boundaries use the real client SDK with deterministic service responses; owner email receipt, a real signed-in owner account and production backend latency were not tested. No substantive legal, entry or health guidance was changed or revalidated by visual testing.

## Performance

Three paired before/after samples were run sequentially in the same quiet local container, using headless Chromium 133, a 1440×1000 viewport, reduced motion, no CPU/network throttling and the real auth client SDK against deterministic 40ms cloud responses. A cached reload intentionally delays the remote account read by 3,000ms. Service workers are blocked for timing isolation and tested separately for real upgrade/offline behaviour.

The fixtures contain 8, 160 or 800 rows per principal collection, retaining all history, eight reusable logo artworks with repeated references and saved eight-point route geometry. The 800-row fixture is deliberately unlinked. Calendar opens populated January 2018. These are synthetic account histories, not the owner account. “Opening” below is the synchronous view handler; loading and two-animation-frame timings are separate in the raw report. This is not INP or a real-device benchmark.

Milliseconds: median (minimum–maximum), three samples per side.

| Rows per collection | Measurement | Before | After |
| --- | --- | --- | --- |
| 8 | App ready | 418 (407–544) | 408 (403–413) |
| 8 | Owned cache ready during slow remote read | 283 (243–324) | 251 (228–281) |
| 8 | Calendar first opening handler | 69 (58–79) | 53 (51–57) |
| 8 | Statistics first opening handler | 10 (8–11) | 23 (22–24) |
| 160 | App ready | 388 (386–401) | 407 (387–414) |
| 160 | Owned cache ready during slow remote read | 301 (273–467) | 285 (275–285) |
| 160 | Calendar first opening handler | 58 (56–61) | 45 (44–53) |
| 160 | Statistics first opening handler | 28 (26–28) | 40 (39–41) |
| 800 | App ready | 573 (561–585) | 634 (601–666) |
| 800 | Owned cache ready during slow remote read | 451 (446–489) | 409 (389–590) |
| 800 | Calendar first opening handler | 89 (88–96) | 78 (70–87) |
| 800 | Statistics first opening handler | 52 (51–58) | 68 (58–70) |

Additional established-history actions, 800-row fixture, same paired samples:

| Measurement | Before, median (range) | After, median (range) |
| --- | --- | --- |
| Calendar repeat opening | 20 (18–21) | 19 (17–21) |
| Home first opening | 20 (19–23) | 25 (24–26) |
| TCC first opening | 20 (19–22) | 20 (20–22) |
| TCC opening and Pakistan search | 13 (13–17) | 16 (15–17) |
| Calendar day details | 33 (32–37) | 18 (17–18) |
| Next month | 32 (32–33) | 19 (19–19) |
| Choose year | 34 (32–43) | 23 (19–28) |
| Open Year overview | 5 (4–5) | 6 (5–22) |
| Next arrow in Year overview | 16 (16–16) | 18 (16–39) |
| Account page ready, first load | 104 (103–116) | 140 (118–179) |
| Account page ready, reload | 58 (57–63) | 64 (59–78) |
| Note save synchronous work | 55 (55–59) | 61 (60–62) |
| Note save to authentic Saved to account feedback | 1383 (1378–1587) | 1369 (1367–1429) |

Calendar first opening and day/month/year-detail work improved in these samples. Some first openings, especially Statistics, and the largest initial load are slower. No multi-second handler freeze occurred in these fixtures; that does not prove the owner’s intermittent Account freeze is resolved. Account page timings use cached fictional authentication, not real email or production backend wait. The Year overview arrow follows each version’s behaviour: the candidate fixes the previous month-instead-of-year defect.

Save feedback includes the existing debounce, fixture network and account write/acknowledgement; the UI does not announce a successful account save early. All samples passed the existing budgets: cached app usable before the delayed remote read (<2,000ms), first priority handlers <750ms and repeat handlers <150ms. No errors were recorded. These budgets do not establish responsiveness on slower devices.

See [all paired samples](v1-evidence/paired-performance.json) and [summary with ranges](v1-evidence/performance-summary.json). To reproduce, keep an unchanged baseline checkout and run the candidate `tests/priority-performance-browser.cjs` three paired times with `HV_ROOT` set to each checkout and `HV_BENCH_OUTPUT` set to distinct report paths; set `HV_PERF_ASSERT=1`. Use the same browser binary and otherwise idle environment for both sides.

## Synthetic visual evidence

All images use fictional records. Baseline and candidate fixtures differ where the candidate additionally exercises a missing-end ongoing stay; these are composition evidence, not pixel-identical record screenshots. Supplied private screenshots are not published.

| Surface | Before | After |
| --- | --- | --- |
| Home and header | [Desktop](v1-evidence/before-dashboard-1440-light.png) | [Desktop](v1-evidence/after-dashboard-1440-light.png), [phone dark](v1-evidence/after-dashboard-390-dark.png) |
| Populated Calendar | [Desktop](v1-evidence/before-calendar-1440-light.png) | [Desktop grid](v1-evidence/after-calendar-grid-1440-light.png), [phone grid](v1-evidence/after-calendar-grid-390-light.png) |
| Atlas selection | [Desktop](v1-evidence/before-map-1440-light.png) | [Blue country selection](v1-evidence/after-map-1440-light.png) |
| Personal trip planning | [Provisional page](v1-evidence/before-planner-1440-light.png) | [Service and request form](v1-evidence/after-planner-1440-light.png) |

The measured sticky header is 64px on desktop, 60px at 768px and 58px on the two phone widths. At 1440px the prior shell measured 174.7px; the 390px prior header measured 80px. All essential destinations remain available in the grouped menus.

## Exact remaining activation dependency

The owner must supply and confirm the enquiry receiving email, then set `HV_PLANNING_CONFIG.enquiryEmail` in `trip-planning-config.js`. No existing repository address was assumed to be the service inbox. Until configured, the service says enquiries are not open and offers review/copy/download; it never claims a request was sent. With a configured address, the button opens the user's email app with the reviewed request, and explains that the email still needs sending. A fictional `planning@example.test` address verified this handoff without sending email. Real receipt can only be verified once the owner-confirmed inbox exists.

The independent interface work and preservation checks are complete. This dependency and the coverage limits above mean this should not be described as a fully verified production enquiry service or universal real-account performance fix.

## Recovery and rollback

Revert the release code through the normal GitHub process to the baseline if necessary. Do not clear browser storage, reset an account, or restore an old data export over newer writes. The unchanged payload contract lets newer travel records remain readable by the prior application. The service worker follows normal activation after old tabs close; a page using the previous release stays coherent until that activation. Request drafts are separate and can be copied/downloaded before a rollback.
