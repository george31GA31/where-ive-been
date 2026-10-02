# Entry-requirements data

`passport-index.js` is an imported, MIT-licensed snapshot of [imorte/passport-index-data](https://github.com/imorte/passport-index-data), published 17 February 2026 and retrieved 2 October 2026. It covers 199 passports and 39,402 routes. It is provisional planning information, not official confirmation. Retrieval does not make an old rule current.

`guidance.js` contains small, sourced, destination-based official rule sets and health conditions reviewed 2 October 2026. These override the dataset only when their scope, date and freshness match. Missing passport, health or documentation details remain explicitly unverified. Rules for special passports, work, study and complex exemptions require official confirmation.

Refresh the dataset with `node scripts/update-entry-data.cjs /path/to/provider.json PROVIDER_UPDATED_DATE RETRIEVAL_DATE`. Review authoritative guidance separately; do not advance `checked` dates without reviewing the linked authority. Requirements are cached in memory by the entire input context and expire independently of user storage. There are no account migrations or database writes. A licensed live provider can implement the same lookup interface without changing the result renderer.
