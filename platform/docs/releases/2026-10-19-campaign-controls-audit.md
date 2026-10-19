# Campaign controls and administrator change history — 2026-10-19

Source commit: `8a93c65` on `codex/unified-dashboard`.
Worker: `toys-agency-platform-staging` (production service).
Active version: `942c716c-13ad-42b7-8f06-7e5a2c5abf9f` at 100%.
Previous/rollback version: `eebd32ac-07e1-48b2-b432-e999141e658c`.

## Behavior

- Project dashboard → Campaigns → Management: administrators and assigned team
  members can pause/enable Meta campaigns. Clients cannot read the live control
  endpoint or issue commands. Google continues to be statistics-only: its existing
  receiver has no Google Ads write credentials. Cloud Run and Sheets were unchanged.
- Explicit confirmation uses a fresh Meta read, verifies campaign/account identity,
  and accepts only ACTIVE/PAUSED. Existing cached statistics remain scheduled reads.
  Rows retain imported statuses until refreshed or explicitly checked in the dialog.
- Durable operation reservation precedes the provider POST. Actor/project scope,
  current user access version, origin, expected status, idempotency and a global
  per-account/campaign in-flight lock protect the action. No automatic POST retries.
- Ambiguous outcomes remain locked. A subsequent read after two minutes reconciles
  the observed status; this is not evidence of who changed it outside the platform.
  Meta has no atomic compare-and-swap against external Ads Manager edits.
- Master → Change history is administrator-only, including detail API requests.
  Existing report revisions/publications/deletions/comments, CRM status changes,
  lead deletions, board creation, access changes and creative status events are
  aggregated with campaign operations. New manual lead creation has an actor;
  access writes now retain before/after assignments. No invented historical backfill.
- Filters: project, actor, category, date (Tbilisi). Pagination: 50 events. Expand an
  event for before/after, including complete stored report fields. Secret-bearing
  audit-log keys and raw Meta error bodies are excluded.

## Database / production checks

Applied additive migration `0028_campaign_control.sql` through the Cloudflare D1
API to database `0539d3d9-844e-470e-af6e-ae256fe4c81f`.

Read-only execution of the journal queries on production returned a 50-event page
and report content details successfully. This caught D1's five-term compound SELECT
limit; histories are grouped using materialized CTEs to stay within that limit.

After deployment, verified active Worker version, Meta credential binding names,
D1 binding and zero campaign operations. No production campaign was toggled.
Direct site/Graph verification from this shell is unavailable under its network
policy; provider behavior was exercised with synthetic responses, not real ad writes.

## Validation

- Unified suite: 190 passing tests before final rendering/query refinements.
- Final targeted campaign control / platform roles suite: 11 passing tests.
- Actual Workers Request/D1 runtime test with a synthetic Meta provider passed.
- New browser suite: 8 passing scenarios, desktop 1440 px, mobile 390/320 px.
- Existing campaign hierarchy, mobile navigation, morning review/cache regressions:
  6 passing browser scenarios.
- Visually inspected campaign confirmation and journal screenshots. Fixed narrow
  date filter overflow and centered the confirmation dialog.
- Covers stale statuses, unassigned/client denial, cross-origin denial, conflicting
  account identities, duplicate/concurrent requests, ambiguous timeouts, escaping,
  secret exclusion, filtering, pagination and focus restoration.

Rollback the Worker to the previous version if necessary; leave the additive table
and its audit records in place.
