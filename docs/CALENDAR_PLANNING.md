# Tentative calendar plans

Use **+ Tentative plan** in Calendar, or select a range and choose **Add tentative
plan**. Countries, accommodation, every existing transport mode, notes and
locations use the current calendar hierarchy. The Plans checkbox hides tentative
entries without deleting them.

Drag an entry to move its whole inclusive range. The first and last visible day
have resize handles. Holding an entry briefly starts touch dragging. The month
changes when the pointer stays near an edge; the page also scrolls near the top
and bottom. Escape cancels a drag. A date preview shows the proposed dates.
Tapping an entry opens exact date editing and one-day/one-week move buttons.
Successful edits save through the existing guest/account persistence boundary.
Use Undo in the notification, or Ctrl/Cmd+Z outside an editor, to undo a change.

**Confirm plan** moves its complete record into the existing confirmed collection.
**Make tentative** in confirmed entry details performs the reverse operation.
IDs, unknown fields, prices, logos, linked trip IDs and resolved routes survive.
Date moves preserve local times and connecting-leg/via dates. Route geometry is
invalidated only if the user changes transport locations or mode. A hotel's
provenance-linked automatic country stay moves with it. Independent country stays
are never removed with a hotel.

## Storage contract

`state.calendarPlans` contains wrappers with `id`, `kind`, `profileId`, `record`
and optional `companions`. `record` retains the existing record schema unchanged.
The Calendar alone projects these wrappers onto its date windows. Shared
`HVCalendarData`, Journey Map, daily summaries, country totals, Schengen, travel
statistics and journey grouping continue to read confirmed collections only.
No database migration or new backend API is required.

The account model merges/imports plans as independent records and remaps nested
traveller/trip references. Concurrent confirmation versus date editing uses the
existing conflict-resolution flow, as do conflicting date ranges. Failed saves
roll back only affected collections. Undo refuses to overwrite newer edits or
cross traveller/account boundaries.

## Verification

`npm run test:calendar` includes the existing chronology, interaction and range
checks plus the tentative planning browser suite. `npm test` covers isolation,
inclusive dates, leap/year boundaries, route preservation, multi-leg/date-line
transport, hotel companions, import and concurrent sync decisions. The browser
suite uses fictional local records and blocks external requests; it never edits
a real account.
