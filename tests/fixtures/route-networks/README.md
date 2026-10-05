# Captured transport geometry

These fixtures contain public OpenStreetMap ways and node geometry retrieved on 5 October 2026 using read-only map API extracts. They include nearby unrelated ways so tests exercise network selection, not just a single preselected route. The test itineraries are fictional; no personal travel or account data is included.

© OpenStreetMap contributors. Geometry is available under the [Open Database Licence](https://www.openstreetmap.org/copyright).

Source extracts (`https://api.openstreetmap.org/api/0.6/map?bbox=`):

| Fixture | Bounding box (west, south, east, north) |
| --- | --- |
| Cebu ferry | 123.89,10.29,123.91,10.31 |
| Portsmouth–Ryde | -1.12,50.78,-1.09,50.80 |
| Piraeus–Aegina | 23.62,37.93,23.64,37.945 |
| Paddington–Royal Oak | -0.195,51.513,-0.174,51.527 |
| Manchester–Ardwick | -2.233,53.467,-2.205,53.481 |
| Ljubljana–Tivoli | 14.49,46.054,14.515,46.062 |

Only transport ways and tags relevant to matching are retained. The map API includes complete way geometry outside the extract boundary. Browser tests replay these same ways as both Overpass geometry and a node-reference harbour response, so they work without contacting public routing services.
