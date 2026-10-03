# Country reference datasets

Reference data is versioned with the site, separate from private travel/account records. The application loads each category once. Adding a category means adding a category label to `HVJourney.categories` and a corresponding JSON file; visit records use stable category/item IDs.

## Included data

- `buildings.json`: all 251 rows of the supplied **Tallest Buildings.xlsx**, names and metre values preserved, not independently verified. A row represents the owner's chosen tallest building/structure for that country.
- `mountains.json`: all 251 rows of **Tallest Natural High Point(1).xlsx**, names and metre values preserved. These are highest natural points, not necessarily mountains.
- `capitals.json`: country/capital facts from [samayo/country-json](https://github.com/samayo/country-json/blob/master/src/country-by-capital-city.json), retrieved 2026-09-11 (MIT). Unknown entries remain unavailable; constituent UK countries and obsolete Netherlands Antilles rows were not assigned to another country.
- `unesco.json`: pending a downloadable dataset. The official [UNESCO list](https://whc.unesco.org/en/list/) was inspected; its XML download returned HTTP 403 in the implementation environment. Country pages link to the official source without inventing site records or totals.
- `airports.json`: public-domain OurAirports directory for local autocomplete (details below). Airports with IATA or ICAO codes are included, including small airfields, heliports and seaplane bases. Manual transport recording remains available.

## Import an Excel or CSV file

Requires Python 3 and `openpyxl` for `.xlsx` (CSV and XML use the standard library).

```sh
python scripts/import-country-data.py buildings "Tallest Buildings.xlsx" --source "Owner's building dataset"
python scripts/import-country-data.py mountains "Tallest Natural High Point.xlsx" --source "Owner's high-point dataset"
python scripts/import-country-data.py airports "Airports.xlsx" --source "Airport source and date"
python scripts/import-country-data.py unesco "UNESCO.xlsx" --source "UNESCO source and date"
```

The command validates the entire file before writing. It replaces only the selected reference dataset, never travel data. Review and commit the generated JSON. Use `--output /tmp/preview.json` to inspect an import first. Keep existing stable IDs when updating datasets so visit records remain attached. A removed reference item does not delete its private visit history.

| Dataset | Required columns | Optional columns |
| --- | --- | --- |
| Buildings / high points | Country, Tallest Point Name, Height Meters | id, latitude, longitude, url |
| Airports | id, Country or countryCode, Name | iata, icao, City, Type, latitude, longitude, timezone |
| UNESCO | id, countryCode, Name | latitude, longitude |

ISO alpha-2 country codes are preferred. Airport `ident`, `iso_country`, `iata_code`, `icao_code`, `municipality`, `latitude_deg`, `longitude_deg` are accepted aliases. No rows are filtered by airport type. `timezone`, when supplied, should be an IANA identifier such as `Europe/London`.

For transnational UNESCO properties, provide one row per UNESCO property ID with comma-separated ISO codes (e.g. `FR,BE`). The property counts once globally and appears under each listed country. Official XML names `id_no`, `iso_code`, `site` are supported. Long descriptions are not imported.

Buildings and mountains default to country-based IDs (`buildings:GB`, `mountains:GB`). Provide an explicit ID if tracking a different reference entity over time. Airfields require stable IDs because not all have IATA codes. Blank/misspelled countries, missing names, invalid coordinates, duplicate IDs and invalid heights abort with a row number.

## Private state additions

- `profiles[].homeCountryCodes`: permanent home preferences for that traveller. Existing dated `residences` remain in effect. Home status only classifies recorded days; it never fabricates stays or changes Schengen eligibility.
- `transports[]`: ID, profileId, type, status, `startLocal`/`endLocal` as local wall-clock strings, endpoint objects, flightNumber and optional bookingReference. Endpoint objects contain name, optional terminal, coordinates, airportId and timezone.
- `placeVisits[]`: ID, profileId, category, itemId, date. Country stays do not imply attraction visits. Actual flight endpoints with imported airport IDs count on their respective local dates; planned flights do not count.
- `visualLayers`: independent map/calendar visibility preferences. Map transport routes accumulate through the selected timeline date, like country history. Routes require endpoint coordinates; no geocoding is invented. They represent endpoint connections, not actual flown/driven tracks.

These fields use the existing local/account payload, optimistic sync and guest transfer flow. Merge rules handle transport and place visits by record ID. Public reference datasets are never copied into account payloads or transfer codes. Flight local times are deliberately not converted to the viewer's timezone and not compared to calculate duration without explicit zone/offset data.

## Airport search directory

`airports.json` contains 11,763 non-closed airports with an IATA or ICAO code, from OurAirports public-domain data via https://github.com/datasets/airport-codes (retrieved 28 September 2026). ICAO codes come from the explicit `icao_code` column. The directory supplies search suggestions only; airport selection does not add country visits. Coordinates are retained internally for transport endpoints.

## Airline directory and domestic flags

- `airlines.json`: 1,255 active-coded rows from [OpenFlights airlines.dat](https://github.com/jpatokal/openflights/blob/master/data/airlines.dat), retrieved 2026-09-28. OpenFlights data is available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/); individual contents are under the Database Contents License. This extracted subset is licensed under ODbL 1.0. This historical directory is a search aid, not a live airline-operations feed. Names and IATA/ICAO codes may change; manual airline names remain supported. Logos are deliberately omitted without a reliable licensed source. Airline selections are independent for each flight leg.
- `assets/domestic/gb-*.svg`: constituent-country flags from [FlagCDN](https://flagcdn.com/), retrieved 2026-09-28. Northern Ireland uses the historic Ulster Banner as a destination symbol. These destinations retain sovereign country code GB in travel records.

## Free search and route providers

Photon supplies live multilingual place search (up to 50 ranked results, displayed ten at a time). Search near adds optional city/country context; map position provides geographic bias. An explicit wider-search action queries accommodation names and English/French aliases in OpenStreetMap through Overpass (up to 100 additional records). Coverage and addresses depend on the community database; manual draggable-pin plotting remains available. No paid API or key is required.

Journey Map uses OpenStreetMap tiles and FOSSGIS OSRM road/walking routing, with requests paced above one second and cached in memory. Rail/ferry lines use connected OSM route-relation geometry only when both selected stops match it within 2.5 km. These are candidate mapped routes, not a guarantee of the operator's actual itinerary. Flight arcs are illustrative airport connections, not actual flight tracks. Atlas does not draw these routes or accommodation.

When mapped water geometry is unavailable, `journey-routes.js` checks the direct connection against local land polygons before generating bounded, water-aware waypoints. Coastline intersections, a paced A* search, clear-water simplification and collision-checked corner curves avoid obvious land shortcuts. The recorded endpoints are retained, with short coastal connectors for pins on land. Open-water connections stay direct, and existing mapped ferry paths take priority. Boats, ferries, cruises, water taxis, speedboats and explicitly classified water records share this geometry. Routes are illustrative and are not maritime navigation. Missing coastline data or exhausted routing limits produce a labelled straight fallback without changing saved transport.

`water-land.json` is a lazy-loaded public-domain Natural Earth 1:50m coastline mask derived from the existing `world-atlas` 2.0.2 development dependency. Its source and limitations are embedded in the file. Rebuild with `node scripts/build-water-land.cjs`; no runtime geospatial dependency or paid route API is added. Small harbours, narrow channels and islands below the source resolution can differ from actual navigation geography. See [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/).
