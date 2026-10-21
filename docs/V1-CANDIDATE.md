# Herald Version 1.0 candidate

Branch: `codex/herald-v1-candidate-20261021`. Base: `86059274d2e3e34535472a1e4c636695442010bc`.

This is a review candidate. No production publication, account mutations, SQL,
permissions or migrations are authorized or performed by this work.

## Preservation and rollback

There is no signed-in owner session or authorized staging account available.
**No backup of the owner's live account has been taken.** Isolated fictional
fixtures are exported under ignored `test-results/v1-candidate/`; browser tests
intercept external network requests before navigation. Existing local/remote
storage keys, unknown fields, IDs, coordinate snapshots and route geometry remain
compatibility contracts. The baseline checkout is retained for visual comparison.

Before publishing, export the authorized account through the existing backup
workflow and verify a restore in staging. Roll back frontend publication by
reverting this candidate's commits and rebuilding the complete offline shell;
never clear user storage. No data migration is required.

## Issue ledger

| IDs | State | Evidence / changed areas |
| --- | --- | --- |
| REL-001 | Implemented; local regression passed | Retained forms, stable retry IDs, operation-only rollback; `v1-consolidation-browser.cjs` |
| PLN-001, PLN-002 | Implemented; local regression passed | Date defaults, deliberate status, X/Escape/reload draft resume/discard and traveller isolation |
| NAV-001, NAV-002, LINK-001, HOME-003, TRANS-001 | Implemented; focused browser passed | Shared actions, no silent date association, labelled all-mode transport, direct Home/Back and 360px navigation |
| CAL-001, CAL-002, CAL-003, CAL-004, CAL-005, TRIP-001, MOB-001 | Pending | Aligned week layout, agenda and daily itinerary |
| HOME-001, HOME-002, PLACE-001, BUD-001 | Pending | Practical dashboard, Places discovery and source reconciliation |
| UI-001, CAL-006, STAT-001 | Pending | Shared roles and phase-aware copy |
| QA-001 | Pending | Synchronize test with provider invocation |
| AIRPORT-001 | Pending | User-requested airport display-name corrections |
| TRIP-002, TRANS-002, COUNTRY-001, MAP-001 | Deferred | Optional scope; preserve existing behavior |

## Verification

Baseline build/unit/DOM and before screenshots are being recorded. Each phase
will record focused evidence here before the next phase. Mocked/local evidence
does not verify deployed owner isolation or real account delivery.

## Release gates

Two-account staging isolation, deployed RPC/ownership checks, real sign-out and
offline-session recovery, account export/restore and live quota checks remain
unverified without an authorized staging setup. Publication must wait for an
explicit approval of the completed candidate and these remaining checks.

Baseline: build consistency, 283/283 unit tests and DOM smoke passed. Baseline browser coverage: 300 states, zero page errors. The bundled Chromium needed its SwiftShader archive extracted without changing ownership on this host; tests use `HV_CHROMIUM_PATH=/tmp/chromium`.

Phase 1 focused local browser checks passed: false/throw persistence rollback, stable-ID retry/reload, future defaults, explicit status, paused builder with two stops and accommodation, reload recovery, discard and traveller isolation. Phase 2 focused local browser checks passed: shared creation choices, standalone country editor, optional trip selection, all-mode transport, direct Home record/Back, preserved service route and mobile menu. External requests were blocked. Real account rejection/isolation is still a staging gate.
