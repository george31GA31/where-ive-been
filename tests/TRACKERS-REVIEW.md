# Country trackers, hotel artwork and travel statistics

The normal manual-country tracker and TCC tracker use separate, additive account
payload collections: `manualCountryVisits` and `tccVisits`. Their stable IDs include
the traveller and destination. Neither collection creates stays, calendar records,
routes or trips. Existing three-way account merging, durable offline outboxes,
guest transfer and backup import handle both collections.

The TCC snapshot in `data/tcc-destinations.js` reproduces the official geographical
list at https://travelerscenturyclub.org/countries-and-territories/ (330 destinations
in 12 official regions, verified 6 October 2026). Counts derive from that dataset.
Destination identities are independent of ISO country codes. There is no automatic
country-to-TCC inference or TCC Atlas mode. When updating the official snapshot,
keep existing destination IDs so account selections retain their identity.

Hotel form uploads use the existing `savedPlaces[].accommodationLogo` catalogue,
image preparation and conservative physical-property matching. A hotel without
coordinates can retain its own artwork through an explicit accommodation ID
binding; its name alone never shares artwork with another hotel. Import remaps
those bindings. Prepared images remain 128-pixel white squares containing the
original image in proportion. Draft uploads stay outside persisted accommodations.

All six new statistics use the read-only `HVTravelHistory` engine. It clips dated
history to today, deduplicates dates/countries, applies Herald's home classification,
and splits days by calendar month/year. Unknown gaps are not filled. Explicit ongoing
actual trips with foreign evidence can extend through today until a recorded home
return. Changing foreign country does not break a continuous absence. An airport
connection alone does not prove a country visit. Genuine domestic trips count
according to Herald's existing travel classification; ordinary residence and home
records do not count as time away.

An exact manual visit date contributes country chronology, never travel days. An
approximate year contributes only the known year; it cannot identify a month,
duration or exact last-new-country date. An undated assertion counts for lifetime
totals and Atlas, but supplies no chronology. If an earlier visit is undated, a later
dated revisit is not presented as a first visit. Normal country-count preferences
apply to the country statistics; TCC is excluded throughout.

Regression coverage includes pure day/chronology calculations, import and concurrent
offline merge/removal, real Chromium phone/tablet/desktop flows in both themes,
square/wide/tall logo pixels, shared map/form artwork and refresh, inline planner
and legacy hotel editors, keyboard widget navigation and isolated two-session
account sync using the actual SDK with a deterministic RPC backend. The existing
platform browser suite also accepts an isolated live account fixture through
`HV_ACCOUNT_FIXTURE`; no real user's credentials or payload are required.

`account-security.sql` and `transfer-security.sql` exercise the deployed RPC and RLS
with rollback-only fixtures. The account test verifies tracker/logo round-tripping,
TCC removal independence, unknown-field preservation, optimistic concurrency,
cross-account isolation and anonymous denial. They do not read real user payloads.
