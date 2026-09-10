# Where I've Been accounts

The existing tracker used browser localStorage and an optional Supabase push/pull system. The configured Supabase project only had the device-transfer service; it did not have an account-data table. SlapsGame was reviewed: it uses Firebase email/password authentication. This change keeps Where I've Been on its own existing Supabase project, with equivalent email/password accounts and no shared SlapsGame users or data.

## Implemented

- Registration, login, logout, email/name editing, password changes and email password resets.
- Private owner-scoped travel snapshots, including stays, residences, traveller profiles, citizenships, rule settings, active profile, exclusions and other snapshot fields.
- Automatic saves, a visible saving/saved/failure indicator, retry on connection restoration, and refresh from the account on page focus and every 30 seconds while visible.
- A persistent outbox scoped by account and tab. Unsent changes survive reload and logout. A fresh page must successfully load the account before editing account data; failed initial loads offer Retry.
- Revision-checked writes. Independent edits merge; same-field conflicts and delete/edit conflicts require a choice. Original pending data stays in the outbox until choices are saved.
- Explicit device import, semantic duplicate detection, traveller ID remapping and conflict choices. The old local data keys are preserved and an additional original snapshot is retained before import. Imported device data is linked to its account so a different account is not offered it.
- `profile/index.html`, `login/index.html`, `register/index.html`, `reset-password/index.html`. GitHub Pages serves these folders directly; `/profile` redirects to `/profile/`, which supports refresh and direct links. No SPA fallback or custom 404 is required.
- Existing tracker calculations, maps, calendars and editing functions retained. The normal UI no longer requires backups, transfer codes or user-supplied Supabase configuration.

## Database

`supabase-accounts.sql` creates `travel_tracker_data`, its owner-only row-level policy, and the `save_travel_account` revision-checking function. It was applied to the existing `where ive been` project during this change. It does not replace or delete the old transfer service or any local browser data. The script is included for reproducible setup in another project.

The browser contains only the existing publishable key in `account-config.js`. Passwords are handled by Supabase Auth. A browser user ID is never trusted by the write function: it takes the identity from `auth.uid()` and executes with the caller's database permissions.

## Required Auth setup before releasing

The available integration cannot inspect or change Supabase Auth's URL or SMTP configuration. These settings must be verified in the [project dashboard](https://supabase.com/dashboard/project/dvbgjdghjjydajmulbjn/auth/url-configuration).

1. Enable the Email provider and signups. Keep email confirmation enabled.
2. Set Site URL to `https://george31ga31.github.io/where-ive-been/`.
3. Add these exact allowed redirect URLs:
   - `https://george31ga31.github.io/where-ive-been/profile/`
   - `https://george31ga31.github.io/where-ive-been/reset-password/`
4. Configure a custom SMTP sender for confirmations, password resets and email changes. Supabase's default sender is restricted to project-team addresses and is not a production mail service. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). SMTP service pricing depends on the provider; credentials belong only in the Supabase dashboard.
5. Keep secure email changes enabled. If custom email templates are already in use, ensure they honour the requested redirect URL. See [password authentication](https://supabase.com/docs/guides/auth/passwords) and [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
6. After merging and GitHub Pages deployment, verify signup confirmation, login on two devices, password-reset email completion, email-change confirmation and logout. These real email flows were not executed as part of automated testing.

No separate application server is needed: GitHub Pages serves the static pages and Supabase provides authentication and database access. Supabase plan limits and SMTP costs apply.

## First import

Open the deployed tracker in the same browser that holds your recorded trips. Create and confirm your account, then log in. The tracker opens Profiles & data with an **Import existing device data** button. Review the counts, confirm the import, and resolve any differences. Wait for **Saved** before opening another device. Repeating an import skips identical records; it may ask about records changed since the previous import.

The imported legacy snapshot remains on its original device, but is not automatically shown after logout or offered to another account. This protects the account separation in the UI; browser local storage is not encrypted and should not be treated as protection against someone with access to that browser's developer tools. No browser data can be migrated remotely by a repository update alone.

## Validation

- `node --test tests/account-sync.test.cjs`: migration deduplication/remapping, non-conflicting merge, delete conflicts, stale writes, offline recovery, edits during saving, logout during a request and protection of another tab's pending edits.
- `tests/account-security.sql`: transactionally creates two temporary test users, tests owner access, cross-user read/write/delete denial, anonymous denial and stale revision rejection, then rolls everything back. Passed against the configured database.
- JavaScript syntax and local HTML asset/route checks.
- Browser visual testing and real email delivery are not included in those checks.
