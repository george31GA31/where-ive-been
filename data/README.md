# Country reference datasets

Reference data is versioned with the site, separate from private travel/account records. The application loads each category once. Adding a category means adding a category label to `HVJourney.categories` and a corresponding JSON file; visit records use stable category/item IDs.

## Included data

- `buildings.json`: all 251 rows of the supplied **Tallest Buildings.xlsx**, names and metre values preserved, not independently verified. A row represents the owner's chosen tallest building/structure for that country.
- `mountains.json`: all 251 rows of **Tallest Natural High Point(1).xlsx**, names and metre values preserved. These are highest natural points, not necessarily mountains.
- `capitals.json`: country/capital facts from [samayo/country-json](https://github.com/samayo/country-json/blob/master/src/country-by-capital-city.json), retrieved 2026-09-11 (MIT). Unknown entries remain unavailable; constituent UK countries and obsolete Netherlands Antilles rows were not assigned to another country.
- `unesco.json`: pending a downloadable dataset. The official [UNESCO list](https://whc.unesco.org/en/list/) was inspected; its XML download returned HTTP 403 in the implementation environment. Country pages link to the official source without inventing site records or totals.
- `airports.json`: pending the owner's airport file. No international/major-only filter is applied. Small airfields, heliports, seaplane bases and other supplied types are retained. An empty reference catalogue does not prevent manual flight recording.

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
