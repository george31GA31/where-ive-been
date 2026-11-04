# Herald motion edition

This iteration follows the user's 4 November 2026 feedback that the first V1 design remained too restrained. The visual reference was [Lando Norris's site](https://landonorris.com/): large mixed typography, a central scene responsive to the pointer, and changing composition through scrolling. Herald uses original geography, contours, journal treatments and interactions rather than that site's images, branding or code.

## The working experience

Home is now an interactive personal atlas. A real D3 orthographic globe turns toward the pointer, can be dragged or rotated by buttons/keyboard, shows actual recorded places and opens selected-country history. Its shading, graticule and orbit provide depth. The globe settles when interaction stops and pauses offscreen or when hidden; there is no continuous idle spin. Bundled geometry, selected traveller and existing history projections remain authoritative. The country list in Atlas remains the alternative for places too small or absent from the simplified globe geometry.

Large mixed typography, moving contours, slight scene parallax and a scroll-responsive composition replace the small boxed Home banner. A practical dock inside the opening scene provides read-first access to today's original records. It retains their stable IDs even when identical-looking records are replaced. Today's full agenda remains below. Journal postcards open existing named journeys and use the traveller's own photos when present, with authored abstract covers otherwise. No stock image is represented as a personal memory.

Trips use numbered chapters; Places is an address index; statistics have a stronger scoreboard and year explorer; transport pairs a practical departure board with optional geography; country pages and readers share a travel-folio treatment. The existing Calendar category lanes, hotel handover halves, tentative lifecycle and explicit editors remain.

Motion follows the device's reduced-motion setting and the saved Motion off preference. Decorative weather remains visibly labeled. Globe buttons, keyboard controls, touch, country lists, practical readers and all normal navigation remain usable with effects disabled. Cards and portal text stop moving when Motion off is selected. No audio autoplays and no data/provider/schema migration is included.

## Code ownership

- `motion-globe.js`: real geographic projection, input, finite easing, visibility, error/retry and cleanup.
- `herald-motion.js` / `.css`: Home composition, dock, journal and presentation roles.
- `motion-workspaces.js` / `.css`: bounded row reveals, pointer lighting and workspace composition.
- `v1-experience.js`: retains the earlier context/Calendar/readiness work and delegates Home to the new scene.

All presentation operates on existing records. It does not persist travel, resolve new provider routes, or infer trip membership. The earlier audited release/date/readers fixes remain part of the candidate.

## Verification

`tests/motion-globe.test.cjs` covers actual geometry, finite frames, user/system preferences, lifecycle, retry, conservative horizon culling and fallback focus when a current country has no separate geometry. `tests/motion-experience-browser.cjs` checks actual projected-path changes from real pointer movement, drag, keyboard/touch controls, Back/focus, stable dock IDs, user Motion off and preservation. `tests/motion-workspaces-browser.cjs` covers four widths in both themes, original data, exact cover choice, retrieval and reader reflow. Both browser suites are wired into `test:v1:redesign` and hence the V1 candidate check.

The normal model, V1, Calendar, performance and offline checks are reported separately in the review. The original audit and its evidence remain in the previously delivered local audit package; private inspection material and bulk audit logs are not part of the GitHub implementation review.

The user subsequently authorized matching the remaining pages and publishing the changes. Publication follows implementation review and automated checks. Production database grants/write-boundary correction, email delivery, independent restore and manual assistive-technology/real-device acceptance retain their documented gates; UI publication does not certify those unrelated operational contracts.
