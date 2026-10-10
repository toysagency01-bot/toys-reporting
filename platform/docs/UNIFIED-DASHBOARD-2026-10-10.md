# Original board restoration — 2026-10-10

The existing staging Worker now serves one project workspace at the existing
`/api/v2/projects/{slug}/content-project` and `content-editor` routes. Pages exposes
these routes under `/mvp`. The three supported projects are HOUSEVIP, PROFKIT
Instashop and Karlovarska Sul. The editor route opens the weekly report directly.

The workspace preserves each project’s original board structure, navigation,
logos, SVG icons, cards, charts and theme. The reference is the repository’s
`karlovarska-sul-k4rm/#overview` board. New controls live within the existing
sections. It has one period selector, overview, nested advertising campaigns,
funnel, weekly editor/history/rollback/comments, published report archive,
project materials, and creative files/status/comments. Missing integrations are
shown as unavailable. No fabricated client data, conversion mappings or plans
were added. Advertising currencies remain separate; Profkit's converted UAH
spend is not added to its original USD value. Business sales remain independent
of advertising attribution. An unsuccessful refresh retains the last usable data.

## Provenance and build

The repository was behind the deployed application. `recovered/staging-entrypoint.js`
is the exact deployed bundle from Worker version
`0f6a980d-dcdb-4360-b469-308409fcffd2`. `runtime/backend.js` removes
the absent source-map reference, exposes internal functions to the wrapper, and
projects the canonical commerce provider label from the internal observation key.
The key itself is never exposed.

`native/` adapts typed platform data to the original board renderers.
`scripts/build-native.mjs` reads the original `core/`, `housevip-cxp7/` and
`assets/` files directly and records their SHA256 in `dist/native-provenance.json`.
Original CSS, navigation/theme scripts and SVG files are copied byte-for-byte.
Core scripts receive only data/refresh hooks; external Sheets, chart-CDN and FX
requests use platform adapters or the bundled original Chart.js version.
The existing weekly and creative workflows are reused from `unified/app.js`.
The route wrapper lives in `unified/worker.js`; the earlier redesigned shell is
no longer served. Existing API handlers remain in use.

Golos Text is bundled from Fontsource 5.3.0, with the original SIL OFL license,
Cyrillic/Latin subsets and variable weights 400–900. The font CSS and WOFF2 data are embedded directly in the authenticated HTML
response, without a separate stylesheet request. Fonts load before the original
board renders. Other board assets use the existing content-project route with
an allowlisted ui query parameter, retaining its authentication gate. A mounted
/mvp browser scenario blocks /api/ui/* and still verifies rendered Golos Text. No Google Fonts dependency remains. Chromium
CDP checks confirm the actual rendered font on all three boards, not just the CSS
family declaration. A scoped typography layer normalizes control fonts, heading
line-height and form spacing. Exact typographic parity with toys-agency.com is
not claimed: direct access to that reference still receives a proxy 403.

Unknown conversion metrics remain unavailable rather than becoming zero.
Commerce ratios are hidden when revenue and spend currencies cannot be matched.
A failed refresh retains the last usable values; fresh data replaces the same
provider/period atomically, without counting child levels twice. `recovered/schema.sql` is a schema-only fixture, **not a migration**.
Never apply that fixture to a remote database.

From `platform/`, using Node 24 and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm unified:build
pnpm unified:test
pnpm unified:browser
```

The browser config uses `/usr/bin/chromium`. Tests use synthetic data and a local
SQLite adapter around the actual recovered backend. They do not prove a real
Cloudflare Access login. `recovery-tests/server.mjs` is a test-only server that
injects a synthetic editor token; never deploy it.

Optional read-only verification of real staging data:

```sh
node recovery-tests/verify-remote.mjs
```

This uses `CLOUDFLARE_API_TOKEN` only against `api.cloudflare.com`; its adapter
rejects non-SELECT queries. It does not download credentials or personal leads.
On this release it validated advertising/currency/business metric mappings for
all three projects and returned 10 HOUSEVIP material tabs, 0 PROFKIT tabs, and
19 Karlovarska tabs.

## Release and rollback

Active Worker version: `bcb09d30-a5ac-4741-afa1-7b3144915e5c` (100%).
Previous version: `122505fc-09ff-4826-944f-802b3db58631` (failed external font stylesheet route).
Earlier redesigned version: `9cd2a826-e302-46e2-9ab6-964f1a6463f4`.
Uploaded bundle SHA256:
`b95e1073bbbe2d74cb4054c0a52dffe2bf8a7ece8fff16cae865e2b872b5fbb5`.

`release-unified.py` targets only `toys-agency-platform-staging`, verifies its
staging D1 binding, retains assets and secrets, and guards deployment against a
changed active version. It does not update Pages, DNS, Access, schedules or data.
After release, the downloaded active bundle matched the local bytes; existing
bindings and access variables matched the pre-release settings.

```sh
python scripts/release-unified.py upload
# Use the returned version ID and the currently active version ID:
python scripts/release-unified.py deploy NEW_VERSION EXPECTED_CURRENT_VERSION
```

Rollback this release:

```sh
python scripts/release-unified.py deploy ab0ef953-d219-485a-b3f3-263b268617be bcb09d30-a5ac-4741-afa1-7b3144915e5c
```

## Verified limits and remaining work

- 14 model/API/asset-fidelity tests and 6 Chromium scenarios passed: weekly
  save/reload/publish/comments/history, project materials, all three original
  board layouts, mobile overflow, campaign refresh/drilldown/error retention,
  missing conversion values and currency mismatch protection.
- The environment still allows only `api.cloudflare.com` plus package hosts.
  Direct site requests receive proxy 403. An authenticated end-to-end test on
  `reports.toys-agency.com` is therefore outstanding. No Access policy was weakened.
- The private workspace is the release entrypoint. Existing static public pages
  and their routing were retained; they have not been asserted to use the new UI.
- R2 bucket listing returns Cloudflare HTTP 403 / code 10000. No CREATIVE_MEDIA
  binding or project quota is configured. File upload remains visibly unavailable;
  creation of a bucket/binding/quota and real upload/preview QA remain outstanding.
- Google Ads Cloud Run delivery is not verified or repaired by this release.
  No Google Cloud identity is configured in this environment. Google snapshot
  data remains usable; it must not be represented as a successful direct API sync.
- The deployed importer already contains the Profkit optional-header and
  Karlovarska empty-weekly fixes. A successful subsequent source sync has not
  been verified. UI refresh invokes existing advertising refresh; it does not
  silently claim to refresh Sheets/business data.
- PROFKIT has no stored project material tabs. The interface displays that state;
  it does not invent strategy or planning documents.
- The original HOUSEVIP lead tab remains visible, but its Sheets-backed personal
  lead source is not connected to this platform adapter. It reports that state
  explicitly. This release adds no new public access to personal lead records.
