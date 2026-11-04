# Endpoint-local time contract

CAL-02 implementation, 4 November 2026.

`HVJourney.resolveLocalTime(local, zone, choice)` is the shared pure resolver.
It returns `known`, `unknown`, `nonexistent`, or `ambiguous`. Only `known`
contains an authoritative `instant` in milliseconds. `instants` lists matching
instants. Both occurrences of a repeated time remain unresolved until the user
chooses `earlier` or `later`. Candidate UTC offsets are round-tripped through
the recorded zone; a daylight-saving gap cannot drift to a different hour.

The canonical stored values remain the original `startLocal`/`endLocal` strings
and endpoint `timezone` or `timeZone`. Optional `startDisambiguation` and
`endDisambiguation` store a repeated-hour choice on the relevant record or flight
leg. Ground via points use `arrivalDisambiguation`/`departureDisambiguation`.
No global normalization, calculated timestamp field, or schema migration occurs.

`validateTransport` validates new/edited values. Known-zone instants are ordered
instead of comparing local clocks, so legitimate overnight and Date Line journeys
remain valid. Missing or invalid zones remain unknown. Views cannot infer a
precise countdown or duration from the viewer's own zone or a different endpoint.
They use a stable UTC day only for an explicitly date-based comparison when the
destination zone is unknown, without manufacturing a subday instant.

Reading existing confirmed/tentative records, exporting, and importing do not
invoke the new write-time validation or change those records. The tentative
model retains its existing shape-only `validate(plan)` behavior for reads and
imports, including legacy unresolved times. Editors and confirmation use
`validate(plan, {times:true})`. Rescheduling validates the resulting times;
an invalid move is rejected without mutating the original plan. A tentative
editor can first reschedule its draft without time validation, then validate
the completed date/time/choice fields together before saving.

Flight, ground, via, and tentative editors expose optional IANA zone and repeated
hour controls. Changing a selected endpoint clears stale choices. Newly selected
directory zones update the fields; a missing zone is left unknown.

Regression evidence belongs to `tests/zoned-transport.test.cjs` and
`tests/zoned-transport-browser.cjs`. The range-navigation additions to
`tests/calendar-range-browser.cjs` cover forward and reverse month/year ranges,
keyboard activation, visible off-screen anchors, cancellation and zero travel
writes during selection. Browser results must be recorded separately from the
model results; a blocked localhost request is not a passing browser check.
