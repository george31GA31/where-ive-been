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

Existing collections remain `profiles`, `stays`, `residences`, `transports`, `placeVisits`, and optional `trips`. An optional `tripId` links existing stays and transport without changing their IDs. A trip's displayed date range comes from its linked records. Ungrouped records remain valid.

Stay status remains `actual`, `planned`, `unconfirmed`, or `cancelled`. Place visit status is additive: missing status means visited for older records; `want` and `not-recorded` do not count as visits. Explicit review can override an airport visit inferred from transport.

Imports preserve country-definition preferences and visual layer settings. Destination account preferences win conflicting scalar visual settings; country exclusion/inclusion lists are combined. Account conflict choices preserve both sides in the local outbox until resolved.

Tests use fictional records. No copy of the owner's private travel payload is committed to the repository. Browser export is available under Preferences; original guest recovery copies remain recoverable. Clearing guest data does not clear account outboxes. Clearing pending account changes requires a separate explicit control after sign-out.
