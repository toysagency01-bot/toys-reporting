# TOYS AGENCY onboarding and advertising reconciliation

Released Worker: `37e09c18-f48e-42f1-94b7-e50d6fa8e64e`.
Previous Worker: `fc01d849-964c-4837-acf0-fe63de894178`.

TOYS AGENCY is active at `/toys-agency-ctft/`, with Meta account
`503232073666825`, USD, Europe/Moscow, and a first release prepared from the
scheduled direct import. The sealed baseline contains 60 campaign/day
observations and 240 facts; readback hashes match. Normal reads use daily D1
snapshots. No spreadsheet was added. The project is in the private viewer/editor
scopes and is absent from both anonymous public scopes. Browser navigation to a
private board redirects to login; API and asset requests retain explicit errors.

## Verification on October 16

The scheduled run completed for all 12 Meta integrations between 11:41 and 11:42
UTC. Each stored 30 local daily snapshots, September 17–October 16.

Independent account-level Meta reports matched ad-level sums for every completed
day, September 17–October 15: **12 accounts × 29 days**. Metrics checked:
impressions, clicks, spend, the configured primary conversion event, leads,
purchases, purchase value, add-to-cart, and checkout. Action aliases use fallback
precedence, not addition. Money comparisons use exact decimal arithmetic.

Accounts checked: HOUSEVIP, AMKLINIKA, Karlovarska Sul, PROFKIT Instashop,
BSCLINIC, Taycher, Europisol, Monorey, MurMur, VISA Agency, WeDoProfi, TOYS AGENCY.

Monorey's preceding run differed by one impression and EUR 0.01 on October 15.
The next scheduled run matched without manual corrections to provider data.

Additional readback checks:

- All current Meta snapshot hierarchies aggregate consistently across accounts,
  campaigns, groups, and ads. D1 snapshots match the captured reconciliation.
- The dashboard API and frontend advertising model match the stored totals for
  every project and provider. Covered days replace historical snapshots without
  duplication. Verification forbids writes and provider requests.
- AMKLINIKA and Karlovarska Google snapshots match the accepted Cloud Run
  campaign rows for all 30 days, including currency, timezone and batch
  completeness. Cloud Run and spreadsheets were not modified.
- Confirmed Meta metadata replaced stale importer timezones for HOUSEVIP
  (Asia/Almaty), Karlovarska Sul (Europe/Prague), and PROFKIT (Europe/Kiev,
  equivalent to Europe/Kyiv). UI calendars now agree. HOUSEVIP and BSCLINIC
  project records were also aligned with their verified account timezones.

## Scope limits

This verifies Meta API account totals against API ad detail, not an unobserved
Ads Manager UI column/attribution selection. Today remains provisional, and
Meta may later revise attribution. History before September 17 was not audited.
Google was checked against authenticated delivered data, not independently
against the Google Ads API/UI. CRM-qualified leads and sales remain CRM facts;
they are not relabelled Meta conversion counts. HOUSEVIP display FX and PROFKIT
currency conversion remain separate from native-currency source reconciliation.

## Validation and operational records

- 138 unit/integration tests passed; build and diff checks passed.
- First-release importer verified locally before production publication.
- New board rendered with captured real data on desktop and mobile, no page
  JavaScript errors; provider requests blocked during the browser check.
- Actual D1 readback through the local Worker passed for all 12 projects.
- Cloudflare deployment, project activation and private scope bindings verified.
- Scheduled reconciliation remains enabled; mismatch results are recorded in
  `sync_runs`. Refresh cadence and cache-only dashboard reads are preserved.

Private captures, readback evidence, and pre-change configuration backups are
outside Git under `/workspace/toys-rollout-audit-20261016`. No credentials or raw
advertising captures are included in this commit. The first-release script is
`scripts/bootstrap-toys-agency.mjs`; opt-in SELECT-only verification is
`recovery-tests/verify-rollout-remote.mjs`.

Worker rollback alone does not revert D1 activation, integration settings or
metadata. Use the saved pre-change configuration if a data configuration
rollback is required; preserve daily snapshots and sealed generations.
