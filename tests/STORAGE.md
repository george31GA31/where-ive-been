# Saved-data compatibility and recovery

The redesign keeps `version: 2` and all existing IDs. It does not rewrite account payloads in bulk or replace browser data during startup.

| Storage | Purpose and preservation |
| --- | --- |
| `whereIveBeen.data.v2` | Original guest state; retained during account import |
| `whereIveBeen.stays.v1` | Legacy guest stays; still loaded when no v2 state exists |
| `whereIveBeen.guest.v1` | Guest history created after a legacy copy was linked to an account |
| `whereIveBeen.localOwner.v1` | Ownership marker; prevents exposing the linked legacy copy to another account |
| `whereIveBeen.beforeAccounts.v1` | Original guest recovery copy |
| `whereIveBeen.outbox.v1.<user>.<tab>` | Durable base/local/revision checkpoint, scoped to account and tab |
| `herald.pendingImport.v1.<user>` | Recoverable cross-device import pending a successful account save |
| `whereIveBeen.auth.v1` | Existing authentication session storage key |
| `public.travel_tracker_data` | Private account JSON payload with revision-controlled saves |

Existing collections remain `profiles`, `stays`, `residences`, `transports`, `placeVisits`, and optional `trips` and `accommodations`. An optional `tripId` links existing stays, transport and accommodation without changing their IDs. A trip's displayed date range comes from its linked records. Ungrouped records remain valid.

Account checkpoints retain the complete merge base once, plus local changes. Unchanged fields and records are reconstructed from that base, keeping logos and route geometry intact without duplicate copies. Existing full `base`/`local` checkpoints are still readable. The account payload, storage-key names and revision rules are unchanged. Successfully downloaded account data remains visible even if a device checkpoint cannot be written. Full device storage is reported separately; unsaved changes stay in the current tab, trigger the existing close-page warning and can still be saved online. Recovery copies are only retired after a replacement checkpoint is written successfully and their stored contents have not changed.

Stay status is `actual`, `planned`, or `cancelled`. Planned stays become `actual` automatically on the day after their final date; planned transport does the same after the later local endpoint date. Older `unconfirmed` stays are migrated safely to `planned` or `actual` on load. Place visit status is additive: missing status means visited for older records; `want` and `not-recorded` do not count as visits. Explicit review can override an airport visit inferred from transport.

Imports preserve country-definition preferences and visual layer settings. Destination account preferences win conflicting scalar visual settings; country exclusion/inclusion lists are combined. Account conflict choices preserve both sides in the local outbox until resolved.

Tests use fictional records. No copy of the owner's private travel payload is committed to the repository. Browser export is available under Preferences; original guest recovery copies remain recoverable. Clearing guest data does not clear account outboxes. Clearing pending account changes requires a separate explicit control after sign-out.
