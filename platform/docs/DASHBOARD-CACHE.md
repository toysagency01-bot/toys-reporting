# Dashboard response cache

Reloading a client board reuses fresh statistics, snapshots, campaign pages and
creative metadata from the current browser tab. The master overview reuses its
project summaries and morning review. The first visit and an uncached date range
still load data from the platform API.

## Storage and freshness

- `native/response-cache.js` keeps an in-memory cache and bounded `sessionStorage`.
  It survives reloads and navigation in the same tab, not closing the tab.
- Keys contain the complete API path and query, partitioned by an opaque server
  hash of the authorized identity, role and login session. The hash grants no
  API access. HTML remains authenticated and `Cache-Control: no-store`.
- Normal entries expire one minute after the next import slot: every 20 minutes
  during the day, hourly from 00:00 to 09:00 Asia/Tbilisi. The minute allows the
  scheduled import to publish. Creative media metadata expires after five
  minutes; the master morning review after two minutes.
- Expired data, up to 24 hours old, remains visible while the API refreshes in the
  background. Provider refreshes in progress remain immediately retryable;
  stale/partial provider responses are fresh for at most a minute. Errors are
  never saved as successful responses.
- Responses above 128,000 characters use browser-native asynchronous gzip.
  The store is limited to 60 entries and 1.5 million serialized characters, with
  a 750,000-character limit per stored entry. Old entries are evicted first.
  Compression/decoding is separate from rendering; unsupported or restricted
  storage gracefully falls back to ordinary loading and memory caching.
- Read-only measurement of all 11 live project snapshots on 2026-10-14 found
  the largest raw payloads at 5.2–5.7 MB, approximately 0.49 MB after gzip/base64.
  All current snapshots fit the per-entry budget. This measures payload sizes,
  not advertising reconciliation or data completeness.

## Invalidation and privacy

The allowlist excludes CRM contacts, client grants, draft approvals and editable
material rows. Those continue to use their existing authorized APIs. Successful
CRM writes clear saved statistics; project edits invalidate the project's cache.
Sign-in, sign-out, a changed identity/role/session, and 401/403 responses clear
saved dashboard data. Pending reads or compression cannot refill invalidated
entries. Returned values are cloned because native renderers modify snapshots.

Advertising reads for registered projects already use D1. This change reduces
repeat browser-to-platform reads; it does not change import jobs, advertising
provider permissions, Cloud Run, protected Sheets or their data pipelines.

## Verification

`recovery-tests/response-cache.test.mjs` covers TTLs, concurrent reads,
invalidation, identity boundaries, denied access, storage failures and large
compressed histories. Browser coverage includes request counts across reloads,
immediate stale rendering, changing periods and roles, master summaries, creative
media, CRM writes, logout, scheduled refresh and mobile navigation.

Release the existing Worker with `scripts/release-unified.py`. No migration or
Pages release is needed. Compare the active Worker bytes to the tested bundle
and verify existing bindings and crons are unchanged.
