# Herald Voyages redesign review

This branch is not approved for deployment. Production remains on commit
`6e458582bc783c277e245b4df1731969f75a995c` until the owner approves publishing.

## Implemented

- Grouped navigation and a global traveller selector.
- Quieter Overview, with current/next/recent travel and confirmation requests.
- Actual/planned/unconfirmed/cancelled stay statuses. Past plans require confirmation;
  keeping a plan explicitly is remembered until its start date changes.
- Historical counts, home/travel days and planning calculations distinguish statuses.
- Optional named trips, search/status/year filters and linked transport entries.
- Map selection stays on the map with a fixed details panel, accessible country selector,
  keyboard activation and branded focus styling. Geography is reused when data changes.
- A unified calendar toolbar, compact filters and Month/Year/Agenda modes.
- Personal history before country reference information; clearer unavailable-data wording.
- Optional flight numbers and transport date validation that permits date-line crossings.
- Import preservation of trip IDs and nested visual preferences; malformed backup checks.
- Export of the currently loaded account/guest dataset from Preferences.
- Calendar rendering consolidated into the core, shared pure status rules, asset version updates.

## Automated verification

Run the commands in UI-TESTING.md. Tests use fictional local data and mocked account APIs.
Additional coverage includes confirmation persistence, traveller isolation, optional flight
numbers, trip imports, malformed backups, map keyboard selection, calendar modes, filters
and escaping a malicious-looking trip name.

## Required before approval to publish

- Real-browser visual checks at 390, 768 and 1440 pixel widths, and 200% zoom.
- Keyboard/screen-reader and contrast audit, especially calendar cells, menus and dialogs.
- Authenticated two-device sync/import validation in a test account.
- Verify both themes, long names, dense calendars and empty accounts.
- Verify Full screen map selection: details must remain reachable and the selected country
  must stay visible. The standard map view is covered by DOM tests.

The browser installer repeatedly timed out in the implementation environment. DOM tests
are not evidence that responsive geometry or WCAG conformance has been verified.

## Broader brief still requiring work

- Complete removal of remaining global rendering wrappers and consolidation of CSS layers.
- Richer trip management using an explicit existing-trip picker, trip rename and transport-only trips.
- Full parity of transport/cancelled filters across Month, Year and Agenda views.
- Country-page planned-visit section and comprehensive content review.
- Broader import validation of transport/place-visit payloads and profile references.
- Live authorization/security audit, plus an account deletion workflow if required.

## Release and rollback

1. Complete the outstanding checks above and obtain explicit publishing approval.
2. Rebase/merge against current main, rerun all tests and review any concurrent changes.
3. Merge the reviewed pull request without force-pushing main; verify the hosting build.
4. Verify assets, routes, data loading and cache versions on the live site.
5. For a UI-only regression, revert the relevant commit with a normal revert commit.

Do not blindly restore the old status logic: the previous release does not understand
unconfirmed/cancelled statuses and can convert them into actual stays. A rollback must
retain the new status parsing/calculation compatibility, or disable editing until a
compatible release is available. Never roll back by overwriting user travel data.

No database migration or live account-data mutation is part of this branch.
