## Account system

See [ACCOUNT-SETUP.md](ACCOUNT-SETUP.md) for account setup, safe migration and validation. The account UI replaces the former manual backup/transfer workflow.

# Where I've Been

A local-first travel-day, country and Schengen 90/180 tracker published as a static GitHub Pages site.

## Application files

- `index.html` — page structure
- `styles.css` — base appearance
- `app.js` — bootstrap loader
- `app-core.js` — main application logic
- `app-fixes.js` — focused compatibility/UI fixes
- `theme.js` — WIB branding and light/dark themes
- `security-runtime.js` — browser-side security/runtime hardening
- `assets/` — site artwork

## Data and Supabase

- `supabase-setup.sql` — production setup for optional cloud sync and encrypted no-login transfer codes
- `supabase-hardening.sql` — migration for an existing Supabase project created with an earlier setup

Travel history is local-first and is stored in the browser under `whereIveBeen.data.v2` unless the user explicitly uses a transfer or sync feature. Replacing repository files does not intentionally delete that browser data.

## Security

- Browser code may contain a Supabase **publishable/anon** key. That key is designed to be public and must be protected by database permissions/RLS.
- Never commit a Supabase **secret/service-role** key, password, private token, `.env` file, or private certificate.
- Device-transfer payloads are encrypted in the browser, short-lived and single-use.
- Security checks run through `.github/workflows/security.yml`.
- Dependency updates for GitHub Actions are monitored by Dependabot.
- Vulnerabilities should be reported according to `SECURITY.md` rather than in a public issue.

## Public-release checklist

Before announcing a production release, make sure GitHub secret scanning/push protection, branch rules, HTTPS and private vulnerability reporting are enabled in repository settings, and apply `supabase-hardening.sql` to any existing Supabase project.
