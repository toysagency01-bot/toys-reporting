# Unified dashboard release — 2026-10-10

The existing staging Worker now serves one project workspace at the existing
`/api/v2/projects/{slug}/content-project` and `content-editor` routes. Pages exposes
these routes under `/mvp`. The three supported projects are HOUSEVIP, PROFKIT
Instashop and Karlovarska Sul. The editor route opens the weekly report directly.

The workspace has one period selector, overview, nested advertising campaigns,
funnel, weekly editor/history/rollback/comments, published report archive,
project materials, and creative files/status/comments. Missing integrations are
shown as unavailable. No fabricated client data, conversion mappings or plans
were added. Advertising currencies remain separate; Profkit's converted UAH
spend is not added to its original USD value. Business sales remain independent
of advertising attribution. An unsuccessful refresh retains the last usable data.

## Provenance and build

The repository was behind the deployed application. `recovered/staging-entrypoint.js`
is the exact deployed bundle from Worker version
`0f6a980d-dcdb-4360-b469-308409fcffd2`. `runtime/backend.js` differs only by removing
the absent source-map reference and exposing internal functions to the wrapper.
The new UI and route wrapper live under `unified/`. Existing API handlers remain
in use. `recovered/schema.sql` is a schema-only fixture, **not a migration**.
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

Active Worker version: `9cd2a826-e302-46e2-9ab6-964f1a6463f4` (100%).
Previous version: `0f6a980d-dcdb-4360-b469-308409fcffd2`.
Uploaded bundle SHA256:
`d071be6d6eebee259a2b8eaccfc38a7e601e4bc6bd37d9f042f071c322b4db2d`.

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
python scripts/release-unified.py deploy 0f6a980d-dcdb-4360-b469-308409fcffd2 9cd2a826-e302-46e2-9ab6-964f1a6463f4
```

## Verified limits and remaining work

- 11 model/API tests and 2 Chromium scenarios passed (desktop weekly save,
  reload, publish, comments/materials; mobile overflow check).
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
- Legacy lead/CRM APIs remain outside the authorized public data projection.
  This release adds no new public access to personal lead records.
