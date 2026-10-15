# Dashboard response cache

Reloading a client board reuses fresh statistics, snapshots, campaign pages and
creative metadata from the authorized browser session. The master overview reuses its
project summaries and morning review. The first visit and an uncached date range
still load data from the platform API.

## Storage and freshness

- `native/response-cache.js` keeps an in-memory cache and bounded `sessionStorage`.
  `native/persistent-cache.js` adds bounded CacheStorage for larger responses and
  reuse by new tabs in the same authorized session. No service worker is used.
- Keys contain the complete API path and query, partitioned by an opaque server
  hash of the authorized identity, role and login session. The hash grants no
  API access. HTML remains authenticated and `Cache-Control: no-store`.
- Normal entries expire one minute after the next import slot: every 20 minutes
  during the day, hourly from 00:00 to 09:00 Asia/Tbilisi. The minute allows the
  scheduled import to publish. Creative metadata follows this schedule too;
  the master morning review keeps its independent two-minute TTL.
- Expired data, up to 24 hours old, remains visible while the API refreshes in the
  background. Refreshing, stale and partial responses follow the same schedule;
  they never trigger rapid polling. A failed scheduled read retains the last
  good response until the next slot. Errors are not saved as successful data.
- Responses above 128,000 characters use browser-native asynchronous gzip.
  The store is limited to 60 entries and 1.5 million serialized characters, with
  a 750,000-character limit per session entry. CacheStorage allows 128 entries,
  25 million serialized characters total and 8 million per entry. Old entries
  are evicted first; session eviction does not delete the larger backing store.
  Compression/decoding is separate from rendering; unsupported or restricted
  storage gracefully falls back to ordinary loading and memory caching.
- Read-only measurement of all 11 live project snapshots on 2026-10-14 found
  the largest raw payloads at 5.2–5.7 MB, approximately 0.49 MB after gzip/base64.
  All current snapshots fit the per-entry budget. This measures payload sizes,
  not advertising reconciliation or data completeness.

## Invalidation and privacy

The allowlist excludes CRM contacts, client grants, draft approvals and editable
material rows. Those continue to use their existing authorized APIs. Successful
CRM writes invalidate the affected project's creative rankings and master
summary, while client CRM totals refresh independently. Advertising statistics
stay cached. Project edits invalidate material tabs and rows only.
Sign-in, sign-out, a changed identity/role/session, and 401/403 responses clear
saved dashboard data. Pending reads or compression cannot refill invalidated
entries. Returned values are cloned because native renderers modify snapshots.

Advertising reads for registered projects already use D1. This change reduces
repeat browser-to-platform reads. Advertising jobs, including failed attempts,
now run only in their scheduled slots; the two-minute CRM wake-up does not
retry advertising between slots. Provider permissions, Cloud Run, protected
Sheets, integration assignments and cron expressions remain unchanged.

## Verification

`recovery-tests/response-cache.test.mjs` covers TTLs, concurrent reads,
invalidation, identity boundaries, denied access, storage failures and large
compressed histories. Browser coverage includes request counts across reloads,
immediate stale rendering, pending-read reuse across periods, large responses
in new tabs, partial imports, changing roles, master summaries, creative
media, CRM writes, logout, scheduled refresh and mobile navigation.

Release the existing Worker with `scripts/release-unified.py`. No migration or
Pages release is needed. Compare the active Worker bytes to the tested bundle
and verify existing bindings and crons are unchanged.
