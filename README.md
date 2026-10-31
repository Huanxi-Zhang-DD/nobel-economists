# Nobel Economists

A static interactive archive of economics laureates from 1969 onward.

Live site: https://huanxi-zhang-dd.github.io/nobel-economists/

## Automatic updates

GitHub Actions checks the official Nobel Prize API daily at 01:17 UTC
(09:17 in Shanghai), on pushes to `main`, and when run manually. Scheduled
runs may be delayed by GitHub. New laureates are added and the website is
validated, committed, and deployed in the same run. The latest check is
recorded in `data/update-status.json`.

The importer adds official names, award years, affiliations, citations and
Nobel profile links. Existing edited profiles are preserved. Photos, field
classifications, biographies and doctoral relationships for future winners
require source review; pending content is clearly marked and uses initials
until a portrait is selected. The 2026 profiles have been reviewed separately.

To check immediately, open **Actions → Deploy static content to Pages →
Run workflow**, select `main`, and run. **Settings → Pages → Source** must
remain **GitHub Actions**. The deployment job needs `contents: write` to
save imported data; a branch rule blocking bot commits must allow this
workflow before scheduled updates can be saved.

## Local checks

```sh
node scripts/update-laureates.mjs
node scripts/update-laureates.test.mjs
node scripts/validate.mjs
python -m http.server 8000
```

Source provenance for reviewed profiles is stored with their biographies
in `data/enrichment.js`. Portrait attribution is in
`assets/portraits/CREDITS.md`.
