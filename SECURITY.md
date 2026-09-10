# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately through GitHub's **Private vulnerability reporting** feature for this repository when it is enabled.

Do **not** open a public issue containing:

- API keys, tokens, passwords, transfer codes, or other credentials
- another person's travel history or personal data
- a working exploit that could expose or alter user data

If private vulnerability reporting is not available, contact the repository owner through their GitHub profile and only share the minimum information needed to establish a private channel.

## What to include

Please include the affected page or feature, steps to reproduce, the security impact, and (where safe) a minimal proof of concept. Do not access, modify, or retain data belonging to other users.

## Supported version

The current production version on the `main` branch is supported. Older commits and forks are not supported.

## Security model

Where I've Been is primarily local-first. Travel history is stored in the user's browser unless the user explicitly uses a transfer or sync feature. The no-login device-transfer feature uploads only browser-encrypted data and is intended to use short-lived, single-use transfer codes.

Public/publishable Supabase keys are expected to be visible in browser code. Supabase secret/service-role keys must never be committed to this repository or shipped to browsers.
