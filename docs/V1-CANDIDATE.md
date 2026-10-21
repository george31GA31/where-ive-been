# Herald Voyages V1 review candidate

Branch: [`codex/herald-v1-candidate-20261021`](https://github.com/george31GA31/where-ive-been/tree/codex/herald-v1-candidate-20261021). Implementation: `3b46c75c100f1f85d28a4e025859fbc09cec9253` (the review branch also includes this report/evidence). Audited and implementation base: `86059274d2e3e34535472a1e4c636695442010bc` (main was unchanged when checked).

This candidate preserves the static vanilla-JavaScript application, existing data model and Herald identity. **It has not been merged or published.** There were no production account edits, database writes, migrations, access-grant changes or storage resets. Implementation and local verification are complete subject to the explicit verification limits below; production release gates are not all satisfied.

## What changes for users

**Saving and planning.** Failed quick country/accommodation saves retain the populated form and explain how to retry. Stable draft IDs and operation-scoped rollback prevent duplicates without overwriting unrelated work. The standalone country editor follows the same acceptance contract. The trip builder derives an untouched status from its dates, distinguishes date phase from saved status, and preserves deliberate choices. Contradictory past/planned choices require an explicit correction before saving. Closing a populated builder pauses it with Resume/Discard choices, including reload recovery scoped to its account and traveller.

**Actions and navigation.** Primary **Plan a trip** opens the complete builder. Shared **Add travel** offers Country visit, Accommodation, Transport, Note, Location and Complete trip through existing editors. A trip is optional. Date matches are suggestions; they no longer silently assign new records. Home opens its exact featured trip/record, including browser Back. Transport has a labelled mode selector and supports the existing modes and legacy URLs. The separate Personal itinerary service remains secondary, retains its enquiry drafts and honest unavailable state, and offers a self-service escape action.

**Calendar and trip details.** Country changeovers stack when the names do not fit inline. Week-specific lane allocation shortens quiet weeks while keeping the connected accommodation strip, checkout semantics, transport chronology and one blue Schengen edge. Boundary cues have their own title space; true overlaps and hidden categories retain accurate disclosures. Filters, Display and Add travel reduce permanent toolbar clutter; Tentative and date selection stay visible. Entry reminders appear once per visit in Month, with accessible actions in full details. A phone-first Agenda shows full record names and local times using the same projection, alongside remembered Month/Year choices. Trip Overview and daily Itinerary share existing records; expanded days and rich record panels load lazily. Itineraries longer than 370 days disclose their display cap and retain the full record list/Calendar.

**Home, Places and costs.** Current/next travel comes first, Today/Tomorrow follow, and memories remain below practical information. The compact month navigator keeps its monthly count separate from all upcoming travel and collapsed recent history. Places exposes saved addresses, dated locations, reference visits and wishes without merging source objects or marking an address visited. Imported budget estimates disclose source changes, cancellation/removal or movement; Update/Keep are explicit. Estimate currency and optional conversion rates remain independent of actuals, deposits/payments and original rates.

**Names and shared roles.** STN and GHA use familiar destination labels. Each flight endpoint offers **Correct display names**; applying a correction changes the draft, and saving the parent flight keeps it. Airport/leg IDs, codes, coordinates and saved route geometry stay intact. Equivalent fields, controls and panels use existing Herald roles. Country details use phase-appropriate date labels, planner provenance is separate from notes, and “Trips & standalone stays” clarifies the existing metric without changing its arithmetic.

## Issue ledger

“Passed” below means the listed local fixture/model/browser acceptance paths passed, not deployed-account certification.

| ID | Result | Changed areas and evidence |
| --- | --- | --- |
| REL-001 | Implemented; passed | `src/calendar/events.js`, `src/core/stays.js`; actual guest quota failure and active adapter edit rejection, false/throw, stable retry/reload |
| PLN-001 | Implemented; passed | Builder date/status defaults; fixed-clock past/current/future/cross-year/leap and explicit-choice checks |
| PLN-002 | Implemented; passed | Scoped paused drafts; close/Escape, resume/discard/reload, traveller and mocked account-key isolation |
| NAV-001 | Implemented; passed | Shared shell/router, primary builder and secondary compatible service route |
| NAV-002 | Implemented; passed | Shared dispatcher and six existing editor adapters; focus return and 360px navigation |
| LINK-001 | Implemented; passed | Visible No trip/date-match choices, zero/one/two matches, explicit same-ID relinking; no bulk reassociation |
| HOME-001 | Implemented; passed | Hero priority, practical daily cards, memories retained; populated/empty Home |
| HOME-002 | Implemented; passed | Approximately 278px month navigator; separate upcoming/recent/monthly scope |
| HOME-003 | Implemented; passed | Stable-ID trip/standalone deep links, exact featured record and Back |
| CAL-001 | Implemented; passed | Width-aware country rows, accessible overlap counts and weekly alignment |
| CAL-002 | Implemented; passed | Readable desktop hotel boundaries; occupied-night, same-day and true-overlap regression coverage |
| CAL-003 | Implemented; passed | Per-week lanes; measured density reduction and no hover grid jump |
| CAL-004 | Implemented; passed | Filters/Display/Add menus, narrow viewport bounds, Escape/outside dismissal and stable category controls |
| CAL-005 | Implemented; passed | One Month cue per visit, missing-passport/stale/review distinctions and full-width detail actions |
| CAL-006 | Implemented; passed | Future/current/past labels and separate new-record provenance; legacy notes retained |
| TRIP-001 | Implemented; passed | Overview/Itinerary, lazy per-day content, linked notes/checklists and retained rich panels |
| TRIP-002 | Deferred | Optional dated checklist items; existing checklist behavior retained |
| MOB-001 | Implemented; passed locally | First-use phone Agenda, full names/times, touch/exact dates and persisted view preference |
| TRANS-001 | Implemented; passed | Transport heading, explicit all-mode selector, stable mode values and legacy routes |
| TRANS-002 | Deferred | Optional transport map/countdown layout refinement |
| PLACE-001 | Implemented; passed | Four source-aware Places tabs; custom address discovery and historical snapshot preservation |
| BUD-001 | Implemented; passed | Explicit source reconciliation, independent estimate currency, model/browser/reload checks |
| UI-001 | Implemented; targeted checks passed | Equivalent computed roles, contrast, focus, reflow and both themes; physical keyboard/native text-only zoom remain manual checks |
| STAT-001 | Implemented; passed | Clarified label; existing calculation retained |
| COUNTRY-001 | Deferred | Optional directory density refinement |
| MAP-001 | Deferred | Optional world-map marker polish; precise individual markers retained |
| QA-001 | Implemented; passed | Route tests await provider-start promises; production throttle unchanged |
| AIRPORT-001 | Implemented; passed | User-requested STN/GHA labels and editable endpoint display overrides; geometry/identity/reload checks |

No requested unresolved defect is represented as already resolved by the baseline. The baseline's working selection, tentative planning, flags/blue Atlas, offline recovery and route behavior were preserved and regression-tested.

## Verification and evidence

All browser data and account API responses were fictional. Test routes intercept external requests before navigation; allowed requests serve the local application. No signed-in owner browser was used. Models and code were checked against the audited base before implementation.

| Check | Result |
| --- | --- |
| Dependency install | `npm ci --ignore-scripts` succeeded; no dependency changes |
| Build/output | `npm run build`, `npm run check:build`; authored sources, bundles and offline manifest match |
| Units | `npm test` / explicit TAP wrapper: **287 passed, 0 failed**, 39 files; baseline 283 passed |
| DOM, syntax, vendor and import | `npm run test:dom`, JS/CJS syntax, `node scripts/check-vendor-integrity.cjs`, `python tests/test_country_import.py` (3 passed) |
| Dependencies | `npm audit --audit-level=high`: 0 vulnerabilities |
| Existing browser checks | All 27 ordinary runners passed; startup/navigation timing runners checked separately; `test:v1` includes 300 page/viewport/theme states with zero page errors |
| Calendar operations | Chronology, range, interactive and planning runners passed; both resize edges, week/month movement, touch, exact dates, Escape, undo, autosave/reload, duplicate/delete, confirm/revert |
| New regressions | Eight `npm run test:v1:candidate` runners cover active save adapter failure/retry, planning/drafts, actions/association, layout/itinerary, Home/Places/budget, airport overrides, targeted accessibility and contract edges |
| Offline upgrade | `HV_PREVIOUS_ROOT=…/herald-baseline npm run test:update`: actual previous-source/worker to candidate upgrade, preserved IDs/references/geometry/logos/pending-deletion sentinel, Pakistan flag and offline reload |
| Recovery | Existing quota, offline resilience, routing and large-startup tests passed with fictional endpoints; two mocked sessions merge edits, delayed reads/outages/interrupted reads and repeated Retry retain history |
| Performance | Three isolated paired baseline/candidate runs at 8/160/800 records; original budgets retained. Two final runs passed; one contained TCC timing outliers. Medians meet the budgets; raw results and limitations are below |

Final refresh results and the exact implementation commit are recorded with the candidate evidence. Existing browser checks were run individually through an orchestrator (two workers for non-timing tests), rather than claiming one uninterrupted `npm run test:browser` invocation. The final source changes received focused reruns of the affected suites. CI includes the new suite; its timeout is 40 minutes to accommodate the expanded checks without changing assertions.

### Visual/device checks

Dense October and November fixtures include border days, long hotel names, missing times, actual overlaps, several transports, notes and gaps. Calendar, Home and Itinerary were captured at **360×800, 390×844, 768×1024, 1024×768, 1280×800 and 1440×900 in both themes**. All 12 calendar states retained identical payloads and aligned weekly lanes. Month remains a compact overview at narrow widths; Agenda and details expose the full information.

| Width | Baseline Month grid | Candidate | Reduction |
| --- | ---: | ---: | ---: |
| 1440, 1280 | 1189px | 902px | 24.1% |
| 1024, 768 | 1170px | 902px | 22.9% |
| 390 | 1051.5px | 687.5px | 34.6% |
| 360 | 1053.5px | 687.5px | 34.7% |

The gallery and machine-readable measurements are in [`v1-evidence/candidate-20261021`](v1-evidence/candidate-20261021/). Screenshot inspection found and corrected a phone Agenda reminder squeezing country names; the final check verifies readable name width and a separate reminder row. Keyboard tests cover visible focus, Escape and focus return; targeted Home CTA contrast passes 4.5:1 in both themes, and equivalent country/note fields share computed roles. Landscape, reduced-height form scrolling and 720 CSS-pixel desktop reflow (a 200% browser-zoom equivalent) pass.

This is not a full WCAG 2.2 AA certification. A physical on-screen keyboard and native text-only zoom were not available in this headless environment and remain manual device checks. Narrow Month icons intentionally use compact targets; full Agenda/detail actions provide touch alternatives. Calendar chronology, map canvases and the compact header retain functional role exceptions.

### Local performance

Measurements separate synchronous handler time from two-frame presentation, request delay and cached-account availability. The fixtures contain 8/160/800 each of country stays, accommodation, transports and saved places; the first two configurations have 8/160 trips and the 800 configuration has zero trips and no record trip links. Each also has one note, checklist, budget, expense, manual mark and independent TCC selection. Geometry, endpoints and artwork remain present.

Handler / two-frame values below are milliseconds; entries show baseline → candidate medians across three runs.

| Records per collection | Cold Calendar handler / two-frame | Warm Calendar handler / two-frame | Candidate range start / end | Candidate cached ready |
| --- | --- | --- | --- | --- |
| 8 | 128 / 133 → 68 / 73 | 20 / 26 → 52 / 71 | 1 / 18 | 588 |
| 160 | 66 / 75 → 65 / 75 | 36 / 47 → 29 / 39 | 1 / 10 | 923 |
| 800 | 159 / 169 → 168 / 179 | 33 / 80 → 36 / 54 | 3 / 20 | 1197 |

The existing 150ms warm/750ms cold handler budgets and <2s owned-cache readiness gate remain unchanged. Range start/end in the 800 case meet the separate <50ms target. Initial noisy attempts exceeded a warm budget in both the unchanged baseline and the candidate; those failures were retained, investigated with isolated paired repeats and were not addressed by raising thresholds. Hidden Agenda rendering was removed from Month. A separate 240-record Journey Map navigation check reproduced a baseline warm median of 171ms. Eliminating duplicate router scroll work and deferring offscreen catalogue card layout brought the final repeat handlers to 43/49ms; all records, keyboard reachability, map routes and scroll restoration remain intact.

Two of the three final priority runs passed every original assertion. The middle run recorded TCC-opening warm outliers of **177ms at 160 records and 701ms at 800**. Median measurements meet the budgets, but individual-run consistency is not established; this remains an explicit responsiveness verification gap, with raw results retained. An intermediate range-end median slightly exceeded the suggested 50ms target (51ms); final repeated measurements were 15/20/28ms at 800. The legacy exact-pixel parity command initially exited for a missing baseline argument; because it assumes unchanged UI geometry, the intentional V1 changes use the new same-fixture screenshot and preservation workflow instead. These are local synthetic measurements, not field INP, a physical-device guarantee or live backend latency. The large-artwork startup suite separately exercises 160/450/700-record payloads, quiet idle checks, exact logo pooling and preserved routes; its largest 33.6MB synthetic payload takes several seconds to hydrate, so it is not described as universally fast.

## Data preservation and optional fields

There is no bulk migration. The dense fixture has **2 profiles, 12 trips, 19 country stays, 23 accommodations, 14 transports, 8 saved places, 3 notes, 2 checklists, 1 budget, 1 expense, 1 dated location, 1 manual country mark and 1 TCC selection**. A complete normalized-state SHA-256 before and after read-only Calendar/Agenda/Trip/Home traversal is identical; collection IDs/counts and settings are recorded in `preservation.json`. Full JSON equality also protects associations and unknown nested fields, not just visible totals.

Mutation tests check one stable ID per retry, same-ID trip relinking, original airport/leg IDs/codes/coordinates/route signatures and geometry, unknown endpoint/record fields, unchanged actual/payment amounts and original currencies/rates, and reload. Existing tests cover logos/artwork, historical place snapshots, cancellation/deletion history, checklist completion, scoped country-count/TCC choices, visa acknowledgements, guest boundaries and revision/outbox behavior. Sixty mixed unknown/year/exact manual marks and independent TCC selection retain their precision without invented trips or travel days. These comparisons apply to disposable fixtures; they are not a comparison of the owner's private account.

Intended additive fields/keys:

- Expense `sourceSnapshot` / `sourceReview` record imported-estimate context and an explicit retained-source decision. `plannedCurrency`, `plannedRate`, `plannedRateCurrency` allow an estimate to differ from actual/payment currency. Legacy fields remain valid, and unknown conversions stay unknown.
- Flight endpoint `displayName` / `displayCity` affect presentation only, scoped to the edited flight; codes, exact endpoints and historical saved geometry stay authoritative.
- New stay provenance may use `createdBy: 'stay-planner'` instead of inserting generated prose into notes. Existing notes are untouched.
- `herald.tripDraft.v1.<account-or-guest>.<traveller>` uses session storage (maximum 250KB serialized text; images excluded) with at most eight in-memory paused drafts. Drafts belong to this browser tab/session; unsaved images last in memory only. Successful save clears the draft. `herald.calendar.view.v1` remembers the user's view choice. Existing storage keys are unchanged.

## Deployed metadata, official guidance and remaining gates

Only one connected Supabase project was available, matching the configured production ref. Read-only deployed metadata confirmed RLS on `public.travel_tracker_data`, an authenticated owner policy using `auth.uid() = user_id`, and a security-invoker `save_travel_account` function with empty search path, authenticated ownership, payload bounds, owner-row locking and revision checks. No account payloads were read. This structural evidence does **not** prove two-account isolation or deployed delivery behavior. No staging project/test accounts were supplied.

Official-source spot checks covered UK/Ireland CTA, Schengen short stays, US ESTA, Tunisia, Algeria and Nepal categories; existing local tests cover non-Schengen Europe, own citizenship, unknown passport, stale/unknown rules and future/historical/health context. Per-result source/review dates, overrides and uncertainty were preserved. No dataset was presented as comprehensive official travel permission, and read-only checks did not change history. References: [CTA](https://www.gov.uk/government/publications/common-travel-area-guidance/common-travel-area-guidance), [Schengen](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en), [ESTA](https://www.cbp.gov/travel/international-visitors/esta), [Tunisia](https://www.gov.uk/foreign-travel-advice/tunisia/entry-requirements), [Algeria](https://www.gov.uk/foreign-travel-advice/algeria/entry-requirements), [Nepal](https://www.gov.uk/foreign-travel-advice/nepal/entry-requirements).

**Remaining release gates:** two independent authorized staging accounts must prove snapshot/record/private-transfer isolation and real RPC ownership/revisions; successful/failed/empty loads must preserve good snapshots without empty recovery writes; in-flight edits must sync in a later revision; real expired-session offline reload/reconnect must preserve and sync pending edits once; sign-out/account switching must clear private views and isolate drafts; live export/import/restore must preserve archived/unknown fields, identity, media and settings; real full-device quota/unavailable durable cache/interrupted writes must retain truthful recoverable state. The local upgrade gate passed, but a deployed update should still be smoke-tested in staging. Mocked coverage supports implementation confidence and does not close those gates.

All mandatory implementation work is present and functional automated local acceptance paths have passed. Intermittent TCC benchmark outliers remain unresolved as a verification limit. The full P0/P1/release acceptance set is **not yet cleared for publication** because deployed account evidence and the noted manual device checks are missing, and individual-run TCC timing is not consistently within budget. Optional TRIP-002, TRANS-002, COUNTRY-001 and MAP-001 are deferred; no unrelated production defect is asserted.

## Backup, rollback and publication boundary

**No backup of the owner's live account was taken.** There was no authorized owner session. Fictional exports/snapshots and before/after source evidence were retained privately during implementation; the committed fixture and evidence are reproducible. Before publication, use the existing authorized account export workflow and verify a restore in staging. Never reset storage as an upgrade or loading remedy.

Rollback is a frontend revert to the audited base (or a revert of candidate commits), followed by `npm run build` and `npm run check:build` and publication of the matching complete offline shell. Keep user storage/outboxes and original exports intact. Existing readers tolerate the optional additive fields; no database rollback is required.

Review the exact branch/head linked by the pull request. After the staging/manual gates above pass, publication requires the owner's explicit approval of that candidate before merging to main or deploying GitHub Pages. This work does not grant or assume that approval.
