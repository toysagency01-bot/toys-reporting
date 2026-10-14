# Campaigns, groups and ads — 14 October 2026

The Campaigns section now exposes the saved campaign → group → ad hierarchy.
Desktop rows expand in place; mobile opens one level at a time with breadcrumbs.
Search includes descendant names, sorting uses the selected metric, and each
level loads in pages of 50. Opened levels reuse an in-memory 20-minute cache.
The existing daytime/nighttime refresh schedule also refreshes visible levels;
failed refreshes retain displayed rows. Period changes cancel pending requests.

`GET /api/v2/projects/:slug/campaign-browser` accepts `from`, `to`, `provider`,
`parent`, `q`, `sort` and `offset`. It uses the existing project dashboard access
policy and returns explicit presentation fields, with project/account/path-scoped
opaque keys. Private hierarchy and CRM routes retain their existing authorization.

Metrics use each node's own daily facts. Parent and child totals are alternative
levels; accounts and currencies are not merged by name. Uncovered published
history remains separately labelled, with no fabricated groups. The replacement
of history follows the overview's coverage rules, including multi-account gaps.
Unknown metrics remain unknown. Meta purchase value and ROAS are derived from
explicit outcomes only when child coverage reconciles with the parent.

`GET /api/v2/projects/:slug/campaign-browser/:key/creative` opens any saved ad
in the selected project's hierarchy. Meta uses the existing original-media/copy
viewer and cache, including ads outside the top-three ranking. The Google
producer currently supplies ad type and destination only; the viewer explains
missing text/media. Unnamed Google ads use the last six ID digits as a label.
Performance Max asset groups are absent from the current producer: campaign
totals stay visible with an explanation instead of invented child rows.

No imports, Cloud Run services, Sheets, database schemas, project registry,
authentication settings or Pages routes changed.

Validation:
- All 27 recovery test files passed. The two Cloudflare-runtime tests needed
  local network permission for Miniflare and passed when rerun with it.
- Seven hierarchy tests cover alternative totals, missing values, same-name
  accounts, currency separation, pagination, history coverage, project scope,
  Meta ads outside the ranking and accepted Google metadata scope.
- All 34 browser scenarios passed; an additional cancellation/return-to-period
  regression passed together with the two hierarchy browser scenarios.
- Read-only verification against current D1 data succeeded for all 11 published
  projects, including Meta and Google child routes and Google ad destinations.
  Wedoprofi had no activity on the checked date (14 October).
- Browser captures and deployment evidence are outside Git in
  `/workspace/toys-campaign-browser-20261014`. Browser tests ran locally; this
  environment cannot directly request the reports domain.

Active Worker: `9c4c0016-fdbd-49a3-a9e9-cb08db1d71a5` (100%).
Rollback Worker: `20bc7f27-fbcf-4e39-b38e-5a382f7ed6d4`.
