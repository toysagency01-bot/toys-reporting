# Daily master reviews — 14 October 2026

The agency master now shows a saved morning review for every active project, with
red urgent findings, orange attention items, green stable projects and gray
insufficient-data cases. Projects are sorted by urgency, with filters and review
history. Expanding a project shows provider/account-local dates, metrics, named
campaign → group → ad findings, recommendations, confidence and the next check.

The engine implements the supplied TOYS Media-Buyer diagnostic rules. It reads
canonical D1 snapshots and CRM status events and does not call an LLM or change
advertising. A complete run is scheduled for 09:30 Asia/Tbilisi using the existing
Worker trigger. Partial failures have bounded retries and never erase the last
published review. Migration 0020 adds the run/output tables and a CRM event index.
See `docs/DAILY-REVIEWS.md` for data semantics, thresholds and operational details.

The first complete review covers all 11 active projects: 6 attention, 3 insufficient
and 2 stable, with no urgent project-level warnings at generation. Inactive/draft
projects are excluded. The closed-day cutoff respects each account's timezone.
Review purchase totals exclude historical branches with no activity in the selected
window; genuinely missing active purchase outcomes remain unknown. The bootstrap
review was recomputed after verifying this case against Karlovarska's stored data.

Validation: full recovery suite (109 tests) and browser suite (40 scenarios) passed.
The subsequent purchase-coverage correction passed all 13 daily-review tests,
including its new regression case. Read-only production checks confirmed complete
snapshots for every configured source. The first review and corrected purchase
coverage were read back from D1. Desktop/mobile, dark/light, filters, history,
escaping, cached navigation, failed-request retry and client isolation were checked.
The reports hostname is not directly reachable under this environment's network
policy; browser validation was local, with deployed code verified via Cloudflare API.

Active Worker: `6492b113-dff4-42a4-baf7-0397f67ea7f5` (100%).
Pre-feature rollback Worker: `def0cd4d-7c8e-40a6-ba06-ce408aef5db6`.
Rollback does not require dropping the new tables. Existing bindings, credentials,
Cloudflare Access, Pages gateway, import cron expressions, protected Cloud Run and
PROFKIT Sheets settings were preserved. No client communication was sent.
