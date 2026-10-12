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
then imports due accounts in parallel. Normal runs follow 20-minute slots from
09:00 to 24:00 Asia/Tbilisi and hourly slots from 00:00 to 09:00. Daytime failures
retry after 2, 4, 8, 16 and at most 20 minutes; overnight failures wait for the
next hour. Nighttime non-hour cron wakeups return before any advertising D1 query. Expired leases recover
interrupted runs. Refreshes re-read the most recent 30 account-local days to pick
up delayed attribution. Revisions older than that window need an explicit
backfill; automatic full-history reconciliation is not claimed.

`ads_import_status` records attempts, successful times, safe errors, next retry
and checked range. Provider freshness uses actual source receipt time, not the
moment a browser reads the database. Google deliveries are rejected as stale after the next scheduled refresh plus
20 minutes of delivery grace. Dashboard freshness allows 10 minutes after the
next scheduled refresh. Both use the source timestamp across the 09:00 transition. The agency screen surfaces failed/stale imports.

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

## Initial direct-import release

Cutover Worker: `ec9fc12f-3739-4874-b9a0-7b6faddf92fb` at 100%.
Both direct-import and direct-read bindings are enabled. Deployed module was
read back through Cloudflare and matches the local bundle byte for byte, SHA-256
`72390ddb721291b7392b531286990cc691f308d24e5710e1643ddf2ce577d873`.
Rollback to shadow import with legacy reads: `ff66474b-91d9-4503-80b7-904fa8bafcff`.

Post-cutover verification used a deliberately accelerated one-off due time for
the four successful imports. Subsequent runs return to normal 20-minute slots.
The actual NBU rate for October 12 was successfully stored from NBU API.

Final verification at 19:41:24 UTC: all four ordinary scheduled imports succeeded
in the 19:40 slot and scheduled their next attempt for 20:00 UTC. The independent
PROFKIT business job succeeded in 3.94 seconds and read only profkit_sales and
profkit_fx. All three SELECT-only live-D1 dashboard checks passed, including
today's USD/UAH rate, with external provider fetch deliberately disabled.
Final suite: 60 tests passed; 13 relevant Chromium scenarios passed across the
two browser runs.

## Night cadence release

Worker `7e4b297f-586e-4f6b-a9ce-bddbb1249966` is the night-cadence release.
Rollback to the previous 20-minute cadence: `ec9fc12f-3739-4874-b9a0-7b6faddf92fb`.
Bundle SHA-256: `eeb37480f7d1e184a6cf1a18afe9eada41e2cf4831af7eb8a9ce69cc067d8823`.

From 00:00 inclusive until 09:00 exclusive in Asia/Tbilisi, scheduled advertising
imports, PROFKIT business sync and FX refresh run hourly. From 09:00 until
midnight they run every 20 minutes. Advertising retries wait for the next hour
at night; existing CRM intake/CAPI delivery cadence is preserved. Nighttime
intermediate cron wakeups do not query or write the advertising tables.
Scheduled-event timestamps preserve the intended slot even if dispatch is late.
The reporting date still uses each advertising account's own timezone.

Client and master Home timers share the schedule, skip hidden pages and read
one minute after a scheduled slot. Freshness uses the next expected source
refresh plus bounded grace, avoiding false night alarms and handling 09:00.

The platform therefore performs 54 regular reporting cycles instead of 72 per
day (9 night cycles instead of 27). This is a cycle count, not a promise of 25%
lower account-wide D1 usage: CRM and Google receiver writes are separate.

The existing Google Cloud Scheduler still runs every 20 minutes until the owner
runs `cloudrun-reporting/set-cadence.py` in Cloud Shell. This environment has
no Google identity or outbound GCP access. The prepared script preserves the
Cloud Run service and delivery settings, validates job ownership, backs up old
settings, supports repeat execution and rolls back failed updates. It has not
been run against Google by this agent. Both customers in the shared producer,
Karlovarska and the draft AM Klinika, would follow the changed cadence.

Validation: 64 API/model/runtime tests, four Chromium scenarios (including the
night-to-day auto-refresh transition and CRM navigation), and three mocked
Google Scheduler configuration tests passed. Relevant browser scenarios were
rerun after clearing the master Home cache at each scheduled refresh.

Deployment verification: Cloudflare reports the night-cadence version at 100%;
the downloaded live module matches the local bundle byte for byte. SELECT-only
live-D1 checks passed for all three dashboards with external provider fetch
disabled. The hourly live cron has not yet reached its first nighttime slot.
