# Herald release implementation ledger

Baseline: `dedd9d0add75598a1a25f4e426c3dfc6a54c1758` (published main, 14 October 2026).
Inputs: the owner's Version 1.0 implementation brief, 30-page surface audit and two populated screenshots, reviewed on 15 October. Live guest observations confirmed the audit's shell and wording findings. No real travel/account record is used for testing.

The release branch preserves the existing account model, collections, record identities, local storage keys, outbox, deletion reconciliation, import/export formats and route persistence. No database migration is introduced. The comparison baseline is the unchanged prior application plus isolated fictional fixtures. Private user exports and supplied screenshots are excluded from this repository.

## Completed implementation ledger

| Finding | Evidence / priority | Change / dependencies | Verification |
| --- | --- | --- | --- |
| H1 | Oversized empty Home; low | Compact empty composition; natural card heights | Passed six viewports and both themes |
| H2 | Build-trip and service labels overlap; medium | Build a trip vs Personal trip planning | Passed navigation and trip/planning journeys |
| CA1 | Year arrows change months; low | Arrows browse years in Year overview | Passed release browser regression |
| CA2 | Range opens one-date note; low | Explain selected date in note preview | Passed explicit single-date range-note regression |
| TR1 | Lower Cancel unbound; medium | Bind both close controls on every step | Passed Cancel on all five steps, including immediate reopening |
| TR2 | Repeated lists and ambiguous creation; medium | One trip list; explicit grouping panel | Implemented |
| TR3 | Empty history says filter mismatch; low | Separate empty history and filtered results; correct ongoing/upcoming phase labels | Passed empty, filtered, upcoming and existing-trip selection regressions |
| FL1 | Upcoming defaults Completed; medium | Planned from Upcoming; editable status; future/completed validation | Implemented |
| FL2 | Other modes hard to discover; low | Scope hint and transport group link | Implemented |
| FL3 | Return continuation unclear; medium | Continue to return journey; explicit nothing saved yet | Passed independent return dates, atomic pair persistence and reload checks |
| JM1 | Search-area scope hidden; medium | Visible property/address and city/country fields | Implemented |
| JM2 | First use described as no matches; low | Distinct initial and filtered map/record states | Implemented |
| JM3 | Manager blocks editor; high | Suspend manager, activate editor, return with focus | Passed active editor input, Cancel and focus return |
| AT1 + owner override | History hard to discover; low | Visible history link; blue fill without gold outline | Passed blue selection and unchanged personal travel state |
| PT1 + owner override | Provisional service; low | Complete service, request/review/session draft and optional email handoff | Activation dependency: owner-confirmed enquiry email in `trip-planning-config.js` |
| CO1 | Autosave explanation below list; medium | Sticky explanation and authentic sync feedback above list | Implemented |
| CO2 | Territory/count scope unclear; low | Directory scope and country-definition link | Implemented |
| CO3 | Entries/UNESCO/internal wording; low | Correct plural/capitalisation and unavailable-list guidance | Implemented |
| PL1 | First-place path unclear; medium | Explain country > reference category > status | Implemented |
| PL2 | Reusable and dated places confused; medium | Reusable-address editor, separate labels and contextual bridge | Implemented |
| ST1 | Oversized empty headline; low | Compact first dated-trip action | Implemented |
| Ongoing stays | Required 11 + 10 = 21 / 2 visits | Read-only elapsed model; missing end means ongoing through today, never complete the record | Passed 11 + 10 = 21 days / 2 visits, next-day 22, scheduled future end and cancelled exclusion; stored fields unchanged |
| TT1 | Overconfident result scope; medium | Traveller/passport context, recorded-history assumptions, calculated departure and year | Passed tools regression; calculation unchanged |
| TT2 | Budget prerequisite lacks next action; medium | Create-trip path, return to new trip budget | Passed empty-budget > create/save trip > new budget journey |
| TT3 | Checklist initial name mismatch; low | Match Before booking template | Implemented |
| TT4 | Card actions ragged; low | Shared cards with bottom-aligned actions | Implemented |
| TT5 | Technical route wording; low | Saved-route language | Implemented |
| TT6 | Faint dark results; medium | Explicit themed result/gauge foreground and background | Passed dark result contrast: 10.58:1 for sampled Stay planner values |
| AC1 | Async guest-panel duplication; medium | Recheck after await; insert before footer | Implemented |
| AC2 | Account and traveller identity conflated; medium | Distinct account/sync vs traveller settings labels | Implemented |
| AC3 | Variable response; verification priority | Repeat representative account tests, avoid speculative sync rewrite | Paired baseline/candidate measurements; deterministic real-SDK/two-device, retry and recovery checks passed; owner Account latency not reproduced |
| X1 + owner instruction | Tall header and duplicate destinations; medium | 64px desktop / 58-60px mobile; grouped menus; one account area; page location cues | Passed all 300 emulated states; measured header heights |
| X2 | Inconsistent fields/cards; low | Shared typography, controls, surfaces and focus roles | Implemented |
| X3 | Native date locale and cross-year labels; low | Retain native inputs; explicit formatted year in results | Implemented |
| X4 | Symbol-only names; low | Close note/checklist and Bold names | Implemented |
| Owner: populated Calendar | Fragmented hotels and dense rows | Full-width hotel names, In/Out cues, restrained codes, all-entry details | Passed dense Calendar, all-entry details and field preservation; fictional screenshots retained |
| Owner: coherent Home cards | Different title/weight/rhythm | Shared title and metadata roles; priority order preserved | Passed populated desktop/phone visual review and priority-order regression |
| Owner: Pakistan flag | Display asset is zero bytes | Regenerate WebP from intact original | Passed all display flag validation, PK browser decode and old-worker upgrade; also repaired empty VG asset |

## Preservation and rollback

All test writes target local isolated fixture contexts with external requests blocked or mocked. Before/after snapshots compare record fields and references, not only counts. Existing account tests cover pending edits, stale responses, conflict retry, deletion tombstones, device ownership and recovery. No new payload fields or storage migrations are introduced by visual changes. Enquiry drafts use a separate per-session key and never enter travel/account records.

Rollback code to the baseline commit through a normal revert. Because payload contracts and authoritative server data are unchanged, newer travel writes remain compatible with the baseline; do not clear storage or restore an old user-data export over newer writes. Request drafts are independent and can still be downloaded/copied before reverting.

## Verification record

See [V1-RELEASE.md](V1-RELEASE.md) for the twelve-page completion table, actual coverage, before/after measurements, synthetic screenshots, the enquiry activation dependency and limits. Local unit (265), DOM, all 25 browser scripts, vendor/import/build checks, dependency audit and actual previous-worker upgrade checks passed. GitHub CI and the deployed build are checked separately after this candidate is committed. No real owner record was changed during testing.
