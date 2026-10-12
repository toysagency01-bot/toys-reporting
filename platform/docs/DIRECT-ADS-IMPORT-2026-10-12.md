# Direct advertising import — 12 October 2026

Scope: the published HOUSEVIP, Karlovarska Sul and PROFKIT dashboards only.

## Root cause and change

The production Meta reader, creative viewer and CRM Graph calls used
`redirect: error`. Cloudflare workerd rejects this Request option before making
an HTTP request. The catch block reported `provider_unavailable`, incorrectly
suggesting an upstream outage. A regression test now runs the adapter in real
workerd and constructs a real Request before its synthetic response. Requests
use `manual`, and non-success responses are rejected without forwarding secrets
to a redirect destination. The initial repair was deployed as
`7a85ebd9-1992-4d3a-b2af-6d3498796ac4`.

The legacy Karlovarska Sheets job also rejected its source with `schema_mismatch`.
The saved error lacked the affected field; structured safe header diagnostics
were added. Its precise failing source cell was not established. Advertising
cutover removes that parser and the unrelated material-tab dependency from the
advertising ingestion path rather than treating a manual history restoration as
proof that the scheduler works.

## Source and persistence

- Meta Graph Insights -> existing Cloudflare Worker -> D1 daily snapshots.
- Google Ads -> existing authenticated Cloud Run importer -> D1 accepted
  batches -> canonical D1 daily snapshots. Cloud Run performs API authorization
  and delivery; no spreadsheet or Make stage is involved.
- Both direct readers validate project/account, currency, timezone, completeness
  and hierarchy before writing. Google totals use exact decimal addition.
- `ads_daily_snapshots` stores normalized provider-native days, including days
  with no activity. Its key includes organization, project, integration, account,
  timezone and currency. Separate account/campaign/group/ad levels are never
  summed together. No credentials or lead contacts are stored in these rows.
- Each 30-day refresh is one D1 transaction. Older snapshots cannot overwrite a
  newer checked timestamp. A failed provider page or database transaction leaves
  the last good period intact.

The scheduler wakes using the existing two-minute cron, claims an account lease,
then imports due accounts in parallel. Normal runs follow 20-minute UTC slots;
failures retry after 2, 4, 8, 16 and at most 20 minutes. Expired leases recover
interrupted runs. Refreshes re-read the most recent 30 account-local days to pick
up delayed attribution. Revisions older than that window need an explicit
backfill; automatic full-history reconciliation is not claimed.

`ads_import_status` records attempts, successful times, safe errors, next retry
and checked range. Provider freshness uses actual source receipt time, not the
moment a browser reads the database. Google deliveries older than 40 minutes
are rejected as stale. The agency screen surfaces failed/stale imports.

## Cutover and retained business data

`DIRECT_ADS_IMPORT_ENABLED=true` starts imports without changing dashboard reads.
`DIRECT_ADS_READ_ENABLED=true` then reads these three projects from D1 instead of
issuing advertising requests on browser navigation. The second flag also stops
all three legacy advertising Sheet jobs. Other projects retain their existing
behavior. The historical data release pointers and archived business materials
are preserved.

Older dates outside direct coverage use the frozen, previously reconciled
history. API data replaces only dates with confirmed coverage, including zero-
activity days. The client identifies mixed historical/API coverage. A partial
provider result never discards unrelated archived dates.

PROFKIT's actual business sales remain a separate source. Its scheduled job reads
only `InstashopSales` and `FxRates`, publishes only those streams using a pointer
compare-and-swap, and preserves advertising, materials, native revisions and
project configuration. It does not fetch MetaAds or weekly/content tabs. Actual
business sales must not be relabelled as Meta-attributed purchases.

USD/UAH conversion uses validated daily NBU rates, stored separately in D1.
Missing rates are requested directly from NBU; an unavailable rate does not
become a guessed value. Meta primary results are explicitly mapped per project:
HOUSEVIP leads, Karlovarska purchases, PROFKIT messaging conversations. Google
business-event classification and asset previews remain separate unfinished
features; generic conversions are not called leads or sales.

## Verification and limitations

First live scheduled run on 12 October: Google Karlovarska succeeded at 19:28:57
UTC, HOUSEVIP Meta at 19:29:00, Karlovarska Meta at 19:29:02, PROFKIT Meta at
19:29:04. Each saved 30 daily snapshots. HOUSEVIP uses Asia/Makassar, so its local
upper date was already 13 October; this is not a UTC-date error.

58 API/model/runtime tests passed before cutover, including transaction rollback,
retry recovery, no provider request from a dashboard read, scope isolation,
empty-day coverage, business-only parsing and the Cloudflare Request regression.
Nine relevant Chromium scenarios passed. Additional FX and exact-decimal tests
passed after their changes. Business-only sync was also exercised on a private
clone of the reconciled D1 history and requested no advertising Sheet.

The cloud workspace can access Cloudflare API, but not the public report or Meta
domains. Production confirmation is through D1 readback and Worker version
verification; local browser tests do not establish a real customer browser visit
or 100% Ads Manager UI parity. Full external parity still requires matching
attribution settings, timezone and metrics. Unexpected token revocation, provider
outages and account-wide D1 quota cannot be eliminated by code. Failure is kept
visible and previous successful data remains readable.

No billing plan changes, new client invitations, CRM contact import, R2 setup or
changes to the Cloud Run service were performed in this task. No external alert
recipient has been configured; health is exposed inside the agency dashboard.

Rollback: restore the previous Worker version to return to legacy reads. The
additive daily tables can remain; do not delete archived or direct data. To pause
new imports without rolling back the UI, disable DIRECT_ADS_IMPORT_ENABLED.

## Active release

Cutover Worker: `ec9fc12f-3739-4874-b9a0-7b6faddf92fb` at 100%.
Both direct-import and direct-read bindings are enabled. Deployed module was
read back through Cloudflare and matches the local bundle byte for byte, SHA-256
`72390ddb721291b7392b531286990cc691f308d24e5710e1643ddf2ce577d873`.
Rollback to shadow import with legacy reads: `ff66474b-91d9-4503-80b7-904fa8bafcff`.

Post-cutover verification used a deliberately accelerated one-off due time for
the four successful imports. Subsequent runs return to normal 20-minute slots.
The actual NBU rate for October 12 was successfully stored from NBU API.
