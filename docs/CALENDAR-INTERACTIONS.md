# Interactive journey calendar

The month remains a projection of the existing shared travel records. There is no
Calendar-specific note collection, record migration, account change or new dependency.

## Interaction model

- Countries share one fixed row. Two countries divide it equally; further countries
  open the Day Explorer. A Schengen visit has one blue left border.
- Accommodation follows immediately below countries. Existing date semantics and
  the checkout-left / check-in-right half-cell layout remain intact. Ambiguous,
  overlapping and incomplete reservations open their complete day list.
- Transport follows accommodation. Actual note text and dated locations occupy
  the remaining preview lane. Overflow opens a contextual explorer without scrolling.
- A single lazy desktop preview reads the active record. Keyboard focus provides
  the same information; entering the preview keeps it open. Related dates and all
  visible segments of the same record highlight together without rebuilding the grid.
- Clicking an entry opens its detailed view. Clicking a date opens the Day Explorer,
  organised as Countries, Accommodation, Transport, Notes, Locations. Desktop uses
  a non-modal floating drawer; mobile uses a bottom sheet. Existing native editors
  remain available, with their existing persistence and deletion safeguards.
- Date numbers and empty cell space default to two-click range selection. The first
  click leaves the grid unobstructed; the second selects inclusive dates in either
  direction and opens the add menu. Selecting the same date twice selects one day.
  `Select range` toggles back to the existing one-click Day Explorer behaviour.
  `Explore day` remains available independently. Date fields remain available in the
  explorer. Arrow keys move focus; Escape, Cancel and clicking outside clear selection.
  Selecting dates never invokes a journey planner, including the legacy click adapter.
- `Hover previews` defaults on. The checkbox stores only
  `visualLayers.calendar.hoverPreviews`, alongside existing display preferences.
  Turning it off removes a current preview and pending timers. Mouse hover no longer
  opens previews or highlights related records; keyboard focus and click/touch details
  remain available. Category filters are still temporary.
- The matching legend temporarily toggles categories. Shift-click isolates a category;
  Show all restores everything. These controls do not write a travel/account payload.
- Search indexes scoped, dated records on demand. A result opens its actual month and
  the relevant saved record, including repeated visits to the same country.

## Data and scope

Notes reuse `state.notes` and the existing Travel Tools editor, including date changes,
linked records, durable saving and deletion confirmation. The existing model supports
single-date notes; selecting a range explicitly explains that a note applies to its
start date. No date-range note schema is introduced.

Country cards use the selected visit ID. Accommodation nights exclude checkout.
Transport cards retain endpoint-local dates and times. Duration is shown only when
both endpoint instants can be established. A saved trip ID plus overlapping dates
is labelled as such, rather than claiming a confirmed hotel-transfer relationship.
Explicit linked notes retain their existing related-type and related-ID references.

The public `HVCalendarDetails.transport` adapter retains its prior markup for Trips,
Journey Map and other consumers. Rich Calendar transport cards have their own renderer.
No map is loaded by a hover; map actions use the existing Journey Map.

Long mobile months keep one transport preview and readable note text, with complete
counts and access through the explorer. Desktop retains two transport previews.
Further note/location records stay available in the day list. Drag-and-drop and
resizing are deliberately omitted; saved dates change through the existing editors.

## Verification

`npm run test:calendar` includes chronological accommodation checks and the new
interactive browser coverage. The latter uses fictional data in 360, 390, 768,
1024 and 1440px viewports, both themes, London/Sydney time zones and reduced motion.
It verifies hierarchy and alignment, equal country splits, one Schengen accent,
hover bounds and pointer continuity, keyboard access, complete busy-day contents,
visit-aware details, temporary filters, ranges, search, Pakistan flags, note CRUD
across Calendar/Travel Tools/reload, accommodation edits, overnight/date-line times,
and preservation of pre-existing records, routes, identifiers and stored payloads.

`npm test`, `npm run test:dom`, `npm run test:browser`, `npm run test:performance`,
`npm run test:update`, `npm run check:build` and the vendor/country-import checks
provide the existing broader release checks. Synthetic account fixtures and cloud
responses exercise synchronization without accessing a real person's account.

`tests/calendar-range-browser.cjs` adds real pointer/touch country creation for
8–14 August, reverse ranges, cancellation, keyboard ranges, one-click day mode,
preference persistence, hover suppression and restoration, and saved-data comparisons
at 360, 390, 768, 1024 and 1440px in both themes. It also verifies that date selection
and dismissal retain the original month DOM rather than rebuilding record lanes.

## Responsiveness follow-up

CPU sampling identified repeated month HTML construction, date-formatter creation and
focus layout work during selection and dismissal. Selection now updates existing date
classes, pressed states, the selection message and the detail surface only. The month
is rebuilt when its records, month or category visibility change. The Calendar's two
date formatters are reused, and detailed entry links use cached record/group membership
and trip/note indexes instead of repeatedly scanning the complete history.

Like-for-like synthetic browser measurements over 15 repetitions, with 8, 160 and 800
records per main collection, reduced median single-day opening from 79–91ms to 6–7ms
and dismissal from 39–48ms to about 2ms. These are controlled handler measurements,
including the reset before opening, not field INP or a guarantee for every device.
