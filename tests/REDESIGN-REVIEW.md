# Herald Voyages implementation and release review

Base inspected: `fe8b8b919b900a8e62887ea8a1201a15354a8875` on main, 21 September 2026. This branch advances the comprehensive redesign brief and remains a draft; it is not a claim that every requirement is complete.

## Changes in this stage

- Shared pure travel summary and explicit combined-traveller summary; cancelled transport excluded from calendar/map/timeline/inferred airport visits.
- Calendar uses separate date buttons, preserves range selection after cancellation, and includes transport and country filters in Agenda. Compact mobile toolbar and default Agenda on narrow screens.
- Explicit trip picker, trip rename/notes/membership editor, multi-traveller group membership, transport-only trips, optional bulk confirmation/planned/cancelled action. Existing stay and transport IDs are preserved.
- Overview leads with the relevant trip, its grouped stay dates, and three or four primary statistics. Empty CTA opens the form. Country reference pages expose first/last/next visits and individual visit status/date controls.
- Places visited under Explore, wish-list states, reviewable inferred airport visits, honest unavailable-data states and readable source context.
- Account retry beside status, library reload retry, explicit account-saved wording, readable conflicts and richer same-device import summary. Import validation and group-ID remapping extended.
- Guest export/clear controls, explicit sign-out and pending-account cleanup, explanation of retained recovery copies. Account deletion is not implemented without a verified server-side lifecycle.
- Removed obsolete dashboard/country render overrides and editor creation in app-fixes; moved injected editor/calendar styles into CSS. Calendar uses a named render event. Other legacy wrappers remain.
- Rolling Schengen forecast computes one bounded date set rather than repeatedly rebuilding it for each future day.
- 250 lossless WebP display flags total about 1.01 MiB; original 22 MiB artwork retained. Generator is scripts/optimise-flags.py.
- Pinned development-only dependencies, DOM and browser checks in CI, screenshot artefacts.

## Production service work already performed

The configured Supabase project was INACTIVE. It was resumed and reached ACTIVE_HEALTHY.

Live account RLS has both ownership USING and WITH CHECK predicates. The save RPC is SECURITY INVOKER. Rollback-only production tests passed owner access, cross-user read/write/delete isolation, stale revision rejection and anonymous denial. The tests create only fictional rows inside a transaction and roll back.

The repository transfer hardening was absent in production. After a rollback rehearsal and checking that there were no live transfers, migration `harden_guest_transfer_bounds` was applied. It preserves account payloads, denies direct transfer table access, bounds payload size/lifetime/active storage, serialises creation, prevents overwriting existing codes, and retains single-use claims. Production transfer-security tests passed after deployment. Expired transfer cleanup occurs on creation.

Security advisors still flag the intentionally public SECURITY DEFINER transfer RPCs and deny-all transfer table. Guest cross-device transfer requires this capability. Global storage bounds are not a per-client rate limiter. Leaked-password protection is disabled; auth configuration was not changed.

## Verification

- 22 model/sync tests.
- DOM integration, including grouping existing records across travellers, optional flight numbers, import idempotency, cancelled travel, map click staying on map, and keyboard/select controls.
- 3 country-import tests and JavaScript syntax checks.
- Chromium layout checks at 390, 768 and 1440 pixels in light/dark modes. Screenshots cover Overview, Calendar, Map, Trips, Countries, country details, Statistics, Places and Travellers. Map checks use the pinned world-atlas geometry and real D3 rendering, served locally for deterministic tests.
- Empty Add trip action, keyboard date selection, cancelled dialog retaining selection, and account-library error pages.
- Browser checks block account/visa external services; they do not represent successful real-account end-to-end verification.

## Release gates and remaining brief

Do not merge/publish this draft until real email confirmation, password reset, configured callback allow-list, same-browser guest import and two-device sync have been verified in a controlled test account. A test inbox/session was not available in this run. No real confirmation/reset email was sent.

Additional work before claiming the entire brief complete:

- Full manual screen-reader/contrast/200% zoom audit; automated keyboard checks cover only selected workflows.
- Complete remaining render-wrapper/CSS consolidation and render-only-visible-page architecture. Current refactor is incremental.
- Year view planned-status presentation, full trip-status lifecycle/transport review parity, and exhaustive visual regression baselines. Current browser checks assert geometry and save screenshots; they are not pixel-diff baselines.
- Review every account and guest transfer conflict/recovery path in real authenticated browser sessions.
- Source/licence-backed Airport and UNESCO datasets remain intentionally unavailable.
- Server-side account deletion/session invalidation remains unavailable.
- Live GitHub Pages verification is pending because this branch is unpublished.

No browser offline application shell is provided. Losing a connection after loading is different from a full offline reload; see UI-TESTING.md.

## Rollback

Revert the UI commit normally, keeping support for additive statuses/trip/place-visit fields. Never restore user data by overwriting newer payloads. Do not revert the deployed transfer guards merely to roll back UI styling. Main still includes unconfirmed/cancelled status compatibility.
