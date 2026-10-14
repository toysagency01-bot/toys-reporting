# Daily agency review

The master's Home screen displays a saved morning review of every active project.
The review uses the TOYS Media-Buyer decision rules captured on 14 October 2026
(`decision-rules.md` in the supplied Cloud Run source). This is a versioned,
deterministic diagnostic engine; it does not call an LLM or modify advertising.

## Schedule and data

The existing two-minute Worker trigger runs the review at 09:30 Asia/Tbilisi.
Review checks occur every ten minutes until 11:00, with at most four attempts for
partial/failed runs. No database work occurs outside these review slots. An atomic
claim and an eight-minute lease prevent duplicate cron invocations from publishing
competing reviews; expired claims can be retried. Publication uses one D1 batch.
A complete review runs once per day. Failures preserve the previous published data.

Each account uses the last fully closed local day at the 09:30 reporting cutoff.
For example, an America/Los_Angeles account may report one day earlier than Prague.
The daily baseline is the preceding seven complete days. Small daily samples widen
the diagnostic window to seven days versus the previous seven when available.
The UI labels the actual comparison window on every finding. Currency/account
boundaries are preserved; campaign, group and ad totals are alternative levels.
Warnings explained by a child are not repeated at every ancestor.

Reads use canonical `ads_daily_snapshots` and integration configuration, including
account timezone and currency overrides. The newest closed-day snapshot must have
been checked after that day ended and within 90 minutes of generation. Missing
coverage, an import failure or mismatched scope suppress performance conclusions
for the affected account. The saved data remains available with explicit warnings.
The overview never calls live Meta/Google APIs or refreshes imports on page load.

CRM counts first qualification/sale status events on their occurrence date in the
CRM timezone, excluding deleted leads. They are distinct from current Kanban counts
and advertising conversions. Attribution requires an active source and an ad in its
stored hierarchy. Unmatched events stay separate. Revenue is grouped by currency.
No names, phones, emails, full lead metadata, or provider tokens enter review JSON.

## Interpretation

- Red: source failures or sufficiently evidenced major performance warnings.
- Orange: a measurable deviation or a data/attribution issue to investigate.
- Green: no threshold-triggering deviation, with enough results to assess trends.
- Gray: too little result volume or no advertising activity.

Rules cover CPA growth, spend acceleration, delivery stopping, spend without
results, CPM growth with stable CTR, CTR decline, post-click conversion decline,
and purchase ROAS decline when explicit purchase revenue is available. They use
observed baselines, not invented client targets. Thresholds are diagnostics rather
than permission to pause campaigns. Small samples lower confidence. Frequency,
recent edit history, margin and agreed targets are not available to this module,
so it does not assert creative fatigue, profitability or readiness to scale.
Generic Google conversions/value never become purchases or purchase ROAS.

## Access and storage

Migration: `migrations/0020_daily_reviews.sql`.
Tables: `agency_daily_reviews` (run state) and `agency_project_reviews` (saved output).
The normal daily write count is one run claim, one row per project and one run
completion, independent of dashboard visits. Incomplete runs have bounded retries.

`GET /api/v2/master/daily-review[?date=YYYY-MM-DD]` requires the existing master
editor authorization. Client and public sessions cannot read it. The response
contains the latest review, urgency counts and up to 30 available history dates.
Inactive projects are excluded at generation and on subsequent reads.
The master caches responses in memory for two minutes, retains existing cards on
transient errors, and retries while visible. CRM/client screens do not fetch reviews.

For a controlled bootstrap/recovery, call `runDailyReview(env, at, {force:true})`
with the normal D1 binding. `force` bypasses the time gate only: it does not bypass
completed-run idempotency, leases, or attempt limits. `generateDailyReviews(db,date)`
provides a read-only diagnostic run. Never clear completed records just to rerun a
review; use history as the audit trail for the snapshot observed that morning.

## Validation

The recovery suite covers local-day cutoffs, sample size, same-currency ratios,
hierarchy deduplication, missing versus zero data, explicit purchase ROAS, active
project selection, CRM event matching and deletion, leases, idempotency, failed
publication, bounded retry and master-only access. Browser tests cover colors,
history, cached navigation, escaping, retries, mobile overflow and client isolation.
