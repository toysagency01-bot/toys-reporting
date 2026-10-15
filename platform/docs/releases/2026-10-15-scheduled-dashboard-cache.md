# Scheduled dashboard cache — 2026-10-15

Reloads and navigation reused only small session entries, while refreshing and
partial results triggered rapid polling. Pending campaign navigation and CRM
writes also discarded advertising caches. Large snapshots could evict one
another before the next visit.

The browser now retains bounded, compressed, authorized responses in CacheStorage
with a session/memory fallback. Refreshing and partial responses follow the normal
import slots. Campaign navigation reuses pending reads; CRM and project writes
invalidate only their relevant derived data. Advertising retries run at the next
scheduled slot, not on the intervening two-minute CRM cron. The daytime 20-minute
and overnight hourly Asia/Tbilisi schedule is unchanged.

See [cache behavior and limits](../DASHBOARD-CACHE.md). No migrations, Pages
release, integration assignment changes, Cloud Run or protected Sheets changes.

Validation:
- 133 backend/unit checks passed, including database-only reads for statistics,
  hierarchy, campaign pages and rankings across repeated and missing ranges.
- 51 Chromium scenarios passed; additional logout/role-change assertions passed.
  Covers large responses across new tabs, partial/running imports, stale display,
  period navigation, scheduled refresh, CRM edits and authorization boundaries.
- Date-dependent advertising UI tests now use a fixed date matching their fixture.
- Active Worker bytes match the tested build. Existing bindings and crons match
  the pre-release snapshot. Live authenticated browser testing was unavailable
  under the environment's domain policy; Chromium used local synthetic fixtures.

Active Worker version: `32ce29c5-0f8b-4eca-8511-82e726a5f5d3`.
Rollback version: `66e6abd4-ee8c-4f02-8d6c-9362058927eb`.
SHA-256: `396a4abc1e1463885d4bfce02672b7d785cc0aaadb8edb2c94b215a121b30f40`.
