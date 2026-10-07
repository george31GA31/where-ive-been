# Account startup, recovery and performance review — 7 October 2026

## Reproduced causes and resulting behavior

Herald uses plain JavaScript, not React. The investigation followed `loadState`,
authentication restoration, `changed`, `AccountSync.start`, its recovery outbox,
`apply`, the page renderers, and the revision-checked account RPC.

The dominant reproducible freeze was the device-import preview. Home ran it twice
at startup even when the import page was hidden. For every incoming record it
searched the existing collection and repeatedly copied and canonicalized whole
records. Logos and coordinate arrays were included in those comparisons. A
160-record fixture spent 7.49 seconds in the two import calls, with individual
main-thread tasks of 3.75 and 4.63 seconds. Duplicate authentication/startup paths
also issued two full account reads. Hidden Calendar, statistics, and journey
renderers added work to unrelated pages.

Import matching now indexes record IDs and signatures once. Import previews run
only on the device-import page, normally in a cancellable worker. Account startup
shares one in-flight load and one authentication subscription. Rendering follows
the active page, including guest startup. Home creates no hotel-logo elements,
does not invoke saved-route retrieval, and does not calculate the six detailed
statistics. Calendar and statistics reuse lightweight inputs that omit artwork
and route geometry. Calendar layout and journey/route algorithms are unchanged.

## Account-load failure and service checks

The exact banner is set by `account-tracker.js` when `changed` finishes with an
authenticated identity and `engine.ready === false`. Previously one catch covered
the account request, JSON recovery parsing, merging, copying and UI hydration.
A malformed recovery checkpoint could therefore turn a successful account read
into the same generic failure as a network outage. Malformed legacy rows could
also throw during processing. These failure branches were reproduced and tested.

Unreadable recovery entries now remain untouched and are diagnosed individually.
Malformed account rows are isolated from display and restored to the original
payload when healthy rows are edited. Request/auth deadlines release stalled
attempts. Failure diagnostics distinguish offline, network, server, authentication,
permission, schema, malformed data, storage/quota, timeout, programming errors and
sync conflict; users receive concise status text.

A read-only production audit found the expected payload/revision schema, the
authenticated ownership RLS policy and the existing compare-and-save RPC. Two
account rows were present. The largest serialized JSON payload was 1,984,617 bytes,
with 279 stays, 220 accommodation records, 32 transport records and 158 saved places.
Core collections and record IDs passed structural checks. In the inspected
24-hour logs, all 28 account reads and three token requests returned HTTP 200.
There was no evidence of a missing table/column, failed ownership policy or
server-side account error in that sample.

The original exception in the user's private browser was not available. The audit
does not establish which exception caused each historical banner. The new
diagnostics capture the operation, category, HTTP status/error code, elapsed time,
connectivity and retry count without credentials or travel contents.

## Retry and offline recovery

The old main Retry handler passed a fabricated `{user:{id}}` object to `changed`.
It could repeat the same failing account path without revalidating the session,
releasing a stalled attempt, or preventing concurrent clicks. The save-retry and
automatic reconnect paths had separate behavior, and restarting authentication
could register another subscription.

Both controls and reconnect now share one retry promise. They show `Retrying…`,
disable parallel clicks, check offline state, restore/refresh the session when
required, verify the user with Auth, and perform the account fetch or reconciliation
needed to recover. Actual request success determines backend reachability.
Success clears the error and resumes existing sync without a page reload.
Failures retain saved data, release the controls and permit another manual attempt.
Automatic sync retains bounded backoff and stops repeated attempts for actionable
authentication, schema, permission or processing failures.

Cached account data is scoped to its authenticated account identity. Offline edits
retain their merge base; reconnect fetches the actual remote state and uses the
existing three-way merge and revision-checked RPC. A failed fetch cannot publish
an incomplete local copy as an authoritative replacement.

## Logos, routes and storage

Hotel artwork lives in the shared saved-place catalogue as
`accommodationLogo.src`, a Base64 data URL. Accommodation records reference that
catalogue through their existing identities; no separate operator-image backend
was found. The audit found 105 logo strings totalling 1,328,206 bytes, averaging
12,650 bytes, with a maximum of 46,646 bytes and ten repeated exact copies. Saved
routes totalled 215,333 bytes across 32 transport records, with a maximum of 59,362
bytes. These values made repeated whole-record comparisons and serialization
more costly; they did not justify deleting assets or recalculating routes.

Visible logo images use lazy loading and asynchronous decoding. New uploads keep
the existing 128-pixel, aspect-preserving representation and now retain PNG
transparency. Existing artwork is not converted, cropped or changed. Popup layout
and the white display background remain unchanged.

The existing outbox now has an asynchronous IndexedDB backing store. One atomic
checkpoint pools identical Base64 logo strings into an asset array and uses
references within the snapshot. Read-back verification checks the committed token
and expands every reference before older acknowledged recovery checkpoints can
be retired. A failed or interrupted write leaves the previous committed snapshot
and original legacy recovery data available. Remote payloads retain their existing
format, so no database, account or remote asset migration is required.

Legacy outbox formats and keys remain readable, with a localStorage fallback on
devices denying IndexedDB. Guest history, claimed device history, original
pre-account backups, preferences and saved routes are preserved. There is no
startup reset or blanket browser-storage clearing. The existing explicit
"Log out and clear pending changes" control also removes the new account cache
when the user chooses that control.

Quota failures cannot hide a successful cloud read. Pending edits are acknowledged
as saved on the device only after the checkpoint commits. If neither storage
backend can retain them, Herald explains that the tab must remain open until the
account save succeeds. The existing unload warning remains.

## Sync and rendering lifecycle

No infinite hydration-save loop was reproduced: startup produced zero cloud writes.
There were duplicate initial reads, full-payload polling and repeated unchanged
device checkpoints. Idle polling now reads only `revision`; an unchanged revision
does not hydrate, write the database or rewrite the checkpoint. Polling pauses
while the page is hidden. Genuine edits still use the existing full reconciliation
and revision conflict protection.

A new concurrent-device test exposed another real problem: display normalization
could add empty fields that were later saved alongside an unrelated user edit.
If another device changed that field, the default created a false conflict.
Persistence now applies differences from the displayed hydration baseline to the
original payload, so unchanged UI defaults do not become edits. Reverting a user
edit is also preserved correctly. Unknown fields and isolated legacy rows survive.

The first account read still downloads the existing complete payload. This change
avoids expensive hidden rendering, comparison and repeated persistence without
introducing a competing database/asset system or breaking old clients.

## Measurements and validation

The same 1,555,247-byte fictional account, with 160 accommodation/logo/transport
records, 56,000 route points and a retained owned device copy, was profiled before
and after in Chromium. Both elapsed measurements include the same one-second
settling interval:

| Measurement | Before | After |
| --- | ---: | ---: |
| Elapsed startup benchmark | 10,126 ms | 1,787 ms |
| Longest observed startup task | 4,625 ms | 105 ms |
| Full account reads | 2 | 1 |
| Cloud writes during hydration | 0 | 0 |
| Home import preview calls | 2 | 0 |
| Home hotel-logo elements after the fix | — | 0 |

The repeatable stress runner covers 160, 450 and 700 records per major collection,
3.04–33.64 MB of JSON, repeated and unique legacy logos, and up to 770,000 saved
route points across flights, trains, ferries, cars and buses. The largest payload
is approximately 17 times the audited production account. It records startup
long tasks, readiness, cache size, pooled asset counts, JS heap samples, account
requests and cloud writes. These are synthetic measurements, not guarantees for
every browser/hardware combination. Short idle heap samples do not establish
long-term leak freedom.

| Records per collection | JSON size | Ready | Longest startup task | Pooled logo assets | Checkpoint size |
| --- | ---: | ---: | ---: | ---: | ---: |
| 160 | 3.04 MB | 622 ms | 120 ms | 84 | 2.73 MB |
| 450 | 14.66 MB | 1,444 ms | 458 ms | 229 | 13.75 MB |
| 700 | 33.64 MB | 2,955 ms | 1,017 ms | 354 | 32.23 MB |

JS heap samples at readiness were approximately 32, 122 and 333 MB. The larger
samples after the test's complete cache read-back and JSON-size measurement also
include transient test allocations; they are not a steady-state leak measurement.
The first account payload still needs parsed object copies for the existing mutable
UI and merge baseline. Home has zero hotel-logo elements and zero saved-route
retrievals in all three cases. The inspected startup trace records no image-decode
events. Each idle check downloads one revision, with zero account/checkpoint writes.

Run `npm test`, `npm run test:dom`, `npm run test:browser`,
`python tests/test_country_import.py`, and
`node scripts/build-offline-shell.cjs --check`. The browser command includes all
18 existing runners plus `startup-performance-browser.cjs`. Its cases cover lazy
guest/account startup, quiet revision checks, exact artwork pooling, preserved
routes, statistics and Calendar, durable offline reload, concurrent sessions,
backend HTTP 503 with working internet, connection loss during startup and ten
repeated Retry clicks sharing one authentication check and account read.

Existing suites additionally cover sign-in/out, account isolation, conflicting
edits, old imports/notes, real storage quota, offline expired sessions, Journey Map,
saved rail/ferry/road routes, logo upload/replace/remove and corrupt files,
country/TCC counts, Schengen, entry/health information, tools, budgets and expenses.
Responsive browser checks include 360, 390, 768, 1024 and 1440 pixels and both themes.
Fixtures and all browser/backend writes are fictional; production queries are
read-only. There are no production schema changes or travel-record writes.

The runner writes `test-results/startup-performance.json` and a Chromium timeline
at `test-results/large-account-startup.trace.json`. CI retains these with its
browser screenshots. The inspected trace shows the remaining bounded account
hydration/checkpoint work rather than startup import loops or hotel-image decoding.
The offline shell allowlist/version is regenerated from the final public assets.

Final local results: 231/231 unit tests; DOM integration passed; 3/3 Python country
import checks; all 19 browser runners passed; changed JavaScript syntax, offline
manifest consistency and `git diff --check` passed. Two old pixel assertions were
updated to check transparent padding instead of enforcing the former flattening
of uploads onto white. A transparent source with a central cutout is also tested;
the existing white popup background, dimensions and layout remain verified.

For a recurrence, open the tracker with `?heraldDebug=1` and call
`await HVAccountDiagnostics.inspect()` in developer tools. The metadata ring is
bounded to 100 entries. It reports approximate browser-storage/collection sizes,
logo uniqueness, route sizes and operation/failure timings without logging tokens,
passwords or travel record contents.
