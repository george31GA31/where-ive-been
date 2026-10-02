# Master development review - 2 October 2026

Baseline: `240f1edf928b160c82b6b6139ed2f8969c6ab8af`. GitHub Security checks and Pages deployment were successful on this baseline.

The account client, account model, account sync engine, tracker, configuration, database schema and storage keys are unchanged. No data reset, database migration or account operation is performed by this change. New fields are additive and the existing backup/account merge preserves them.

## Section review

| Brief section | Final implementation |
| --- | --- |
| 1 | Shared debounced live search ranks stations, airports, terminals and accommodation by transport context; saved places remain searchable. |
| 2 | Map editor searches the same service, moves to the result and supports dragging, clicks and keyboard adjustments. |
| 3 | Addresses, city, country and coordinates are populated when available; addresses stay editable; Location Code removed from normal forms. |
| 4 | Ground transport uses precise endpoint searches, editable addresses and optional operator, service, booking reference and seat details. |
| 5 | Return editor reverses the route, clears independent timing/booking fields and saves two distinctly identified, linked records. Cancel does not silently save a partial pair; outbound-only save remains available. |
| 6 | Ground via stops support search, map selection, arrival/departure times, operator/service data, removal and reordering. Route projections contain individual legs. |
| 7 | Multiline notes on trip, country stay, transport, accommodation and location forms. Details show existing notes, compact cells do not. |
| 8 | Optional original amount/currency, GBP default, world currency selector. Supplementary conversion opens XE with the chosen currencies. No rates are fabricated or scraped. |
| 9 | Existing road/walking and mapped railway/ferry providers retained. Precise lightweight straight connections appear immediately and are replaced when a reliable route is returned. Vias are separate legs. |
| 10 | Journey Map uses smaller markers and lighter routes. |
| 11 | Flight paths are thin, curved and solid. |
| 12 | Airport dots 8px, accommodation markers 16px, other point markers 10px. |
| 13 | Generic clustering and spiderfying removed. Only repeated records at the same property share a precise marker and count; popup lists actual stay dates. |
| 14 | Markers remain at actual saved coordinates. Different neighbouring properties remain separate. |
| 15 | Leaflet retains individual points across zoom levels. Zoom does not rebuild or aggregate marker positions. |
| 16 | Reviewed official nationality-aware rules and conservative unknown fallback replace community-dataset conclusions. CTA, Schengen, Albania, US, India and Egypt cases covered; purpose, duration, special status and review expiry affect confidence. |
| 17 | Inclusive transport date projection covers intermediate dates and flight legs without duplicating saved records. |
| 18 | Existing semantic accommodation changeover ordering retained and regression-tested. |
| 19 | Existing proportional country/accommodation widths preserved; a single mobile route may wrap within available space, while crowded rows keep the compact treatment. |
| 20 | Fixed floating hover/focus detail shows real routes, legs, times, operators, prices and notes without shifting cells. |
| 21 | Date and journey side panels show structured individual legs with muted details and existing edit/map actions. |
| 22 | Existing subtle green Schengen edge retained. |
| 23 | Today uses burgundy text with no background circle. Selection styling is unchanged. |
| 24 | Grid, cell heights, fonts, palette, borders and layout retained. Browser geometry checks cover 88px mobile, 124px tablet and 136px desktop busy cells. |
| 25 | Date range Create Trip action reviews overlapping existing records and allows exclusions or addition to an existing trip. Links are references; explicit exclusions also prevent inferred map/calendar membership. |
| 26 | Trip detail page/dialog combines dates, duration, country flags, itinerary, notes, costs, photos and map actions. Existing trip editing remains available. |
| 27 | Original-currency transport, accommodation and overall totals deduplicate record IDs; returns count as separate priced journeys. |
| 28 | Trip map actions use the existing Journey Map architecture. |
| 29 | Multiple resized raster photos, removal, reordering and cover selection. Photos remain in the trip record for backup/account synchronisation. |
| 30 | Existing House Sit type preserved and tested for save and refresh. |
| 31 | Directory is the country navigation/status view; separate breakdown retains unique home/travel-day comparison and visibility controls. |
| 32 | Compact aligned country rows associate flag, name, logged days and visited state without large cards. |
| 33 | Road Trip Planner, Budget Planner and Currency Converter appear under Travel tools with lightweight Coming Soon dialogs. |
| 34 | Exact supplied dark/light logos, full aspect ratio, keyboard-accessible dashboard link and supplied favicon across main/account pages. |
| 35 | Exact seven supplied transport PNGs, consistent rendered height and proportional widths across Calendar, lists and details. |
| 36 | Local syntax, DOM, account/data unit, country import and browser gates; GitHub security gate on the review branch before production. |
| 37 | Full regression plus new search, return, via, trip linking, costs, photos, marker identity and icon geometry checks. |

## Validation

- 55 unit tests passed, including account merge, failed requests, durable outbox, conflict handling, import and new additive fields.
- DOM integration passed: routes, detached pages, transport CRUD, traveller scoping and local persistence.
- Three country import tests passed.
- Browser regression covers 60 populated scenes at 390, 768 and 1440 pixels in light and dark mode, service failures, responsive layouts and keyboard interaction.
- Focused Calendar/map tests preserve cell geometry, accommodation order, first-click/tap selection, selected-point persistence through zoom, home choice and saved-place removal semantics.
- New end-to-end checks cover live station search, addresses, vias, independent returns, notes, prices, House Sit, multi-day Calendar, date-range trips, original-currency totals, photo refresh, hover stability, branding and repeat-property markers.
- Source PNGs are copied unchanged. Icon geometry verifies equal heights and natural aspect ratios.
- No account, database, environment or security weakening changes. Workflow adds the new tests and JavaScript syntax checks.

## Explicit limits

- An authenticated real-user sign-in/logout and two physical-device sync test cannot be claimed from the fictional fixtures. The account transport and sync code are unchanged; automated network-failure and data-retention tests are the available evidence.
- XE embedded live conversion requires legitimate API credentials and a secure service. This static site instead opens the legitimate XE converter; original currencies remain authoritative.
- Place search, map tiles and routing depend on external services. Failed lookup does not clear records. Unknown railway/ferry routes use labelled straight connections.
- Verified visa coverage is intentionally limited. Unverified passports/destinations and special circumstances show Check official requirements; guidance has a review date and expires rather than becoming indefinitely trusted.
- A fixed 88px mobile day with several countries, journeys and stays cannot display every full name simultaneously. The compact entries retain all underlying information through hover/focus detail and the date panel, with no +X-more data removal.

Official visa source pages: [Ireland](https://www.gov.uk/foreign-travel-advice/ireland/entry-requirements), [France/Schengen](https://www.gov.uk/foreign-travel-advice/france/entry-requirements), [Albania](https://www.gov.uk/foreign-travel-advice/albania/entry-requirements), [USA](https://www.gov.uk/foreign-travel-advice/usa/entry-requirements), [India](https://www.gov.uk/foreign-travel-advice/india/entry-requirements), [Egypt](https://www.gov.uk/foreign-travel-advice/egypt/entry-requirements).
