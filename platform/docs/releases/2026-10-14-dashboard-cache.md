# Dashboard reload cache — 2026-10-14

Client and master dashboards now retain authorized, bounded response caches
between reloads in the same tab. Fresh responses avoid repeat API reads; stale
statistics remain visible while the platform refreshes them. Large historical
snapshots use asynchronous gzip to fit browser storage. CRM writes, project
edits, logout and access changes invalidate the relevant saved data.

Details: [Dashboard response cache](../DASHBOARD-CACHE.md).

## Validation

- Build completed; 120 recovery tests and 46 browser scenarios passed.
- Browser tests verify unchanged request counts after reload for snapshots,
  statistics, rankings, campaign pages, media metadata and master summaries.
- Covered expired background refresh, separate ranges/roles, large histories,
  logout, CRM invalidation, expanded campaign refresh and mobile navigation.
- Read-only measurement of all 11 live snapshots confirms they fit the compressed
  per-entry budget. No source credentials or client payloads were committed.
- Test Worker bundles now use separate process filenames so parallel test suites
  cannot read a partially overwritten shared bundle.

## Release

- Active Worker version: `5a007ee8-f7af-4c9b-9b6d-abb1d23ed322` (100%).
- Rollback version: `6492b113-dff4-42a4-baf7-0397f67ea7f5`.
- Deployed SHA-256:
  `d9ae449c4749be0219f03fb35870f14aa818e9399627cdab325fcb2ea3fa59cb`.
- Cloudflare API readback confirms deployed bytes match the tested bundle;
  bindings, compatibility settings and both existing crons are unchanged.
- No migrations, Pages release or import/provider configuration changes.
- Browser verification used the local production bundle and synthetic data.
  Direct production-site navigation is outside this environment's network
  allowlist; production verification used the Cloudflare API.
