# VISA Agency: KeyCRM qualification import

Project: `visa-agency-qa3b` / `prj_visa_agency_qa3b`.
Existing Worker: `toys-agency-platform-staging`.
Encrypted credential binding: `KEYCRM_VISA_API_TOKEN`. Never export or log its value.

## Verified API contract, 27 October 2026

The credential successfully reads `https://openapi.keycrm.app/v1` from the Worker.
Pipeline/status endpoints return Laravel-style `data` plus pagination metadata.
Status names are in `title`, not `name`. The unique approved pipeline is `1`.

| Qualified status | ID |
| --- | --- |
| Прогріти | 31 |
| Жовтий | 29 |
| Зелені | 28 |

The user explicitly approved the actual spelling `Прогріти` on 27 October;
`Прогріті` from the original setup does not exist in this CRM.
Cards use `id`, `pipeline_id`, `status_id`, and UTC `created_at`.
Qualifications require the exact top-level card marker `utm_source=toys`.
Missing, different, uppercase or whitespace-suffixed values are excluded. Only
the approved literal `toys` or NULL is stored; arbitrary source values are not.
The verified request uses `filter[pipeline_id]=1`,
`filter[status_id]=31,29,28`, `sort=id`, `limit=50`, and a local page number.
The initial API filter verification reported 326 cards / 7 pages. This count is
an API observation, not a historical total for any selected reporting period.
Cloudflare supports `redirect: manual`; reject all non-success responses and
never follow provider-supplied URLs. `redirect: error` is unsupported in Workers.

## Scheduler and persistence

`crm/keycrm-sync.js` runs through the existing Worker scheduler. A scan resolves
all three exact titles in one unique pipeline, then reads only those stages.
Requests are spaced at least 3.1 seconds apart (below 20/minute).
Each invocation reads at most 16 card pages within a 90-second budget; remaining
pages resume on a later two-minute tick. A database lease prevents parallel ticks
from using the same key; the lease is fenced on each staged write/publication.
A completed scan is due again after ten minutes. Failed scans use exponential
backoff from two minutes to one hour and retain the last successful result.

Migration `0035_keycrm.sql` adds two isolated, contact-free tables:

- `keycrm_sync`: mapping, pagination checkpoint, lease, retry state, publication pointer.
- `keycrm_cards`: generation-scoped external IDs, status, intake date, and first
  qualification observation, plus the approved `toys` source marker. No names,
  phones, emails, arbitrary UTM values, or raw payloads.

Migration `0036_keycrm_source.sql` adds source verification to cards and scan
generations. Unfiltered legacy generations are unavailable to summaries until a
complete source-verified rescan is published. Unknown legacy sources remain NULL,
including absent cards retained from older snapshots. A partially scanned legacy
generation restarts, preventing mixed verification. Later source changes are
reflected when a card is observed; known own milestones retain normal absence
handling. Source gating applies only to KeyCRM qualification summaries.

Page rows and their checkpoint are committed together. Duplicate IDs, changing
totals, missing rows, mismatched scopes, or changed intake dates fail the scan.
Only a complete generation becomes visible, in the same transaction as its
publication pointer. The next scan cleans abandoned generations. A qualification
counts once across approved stages and later re-entry. If a card leaves the scan,
its previous milestone is retained with `present=0`; absence does not prove a
customer deletion. This connector does not write to KeyCRM, native contacts,
`crm_milestones`, delivery jobs, Meta CAPI, sales, or revenue.

## Dashboard semantics

`crm/service.js` selects KeyCRM as the exclusive qualification summary for VISA
when enabled. It never sums these records with the 34 native historical contacts.
Existing access checks protect private CRM routes and advertising summaries.
Counts use original `created_at` in project timezone `Europe/Warsaw`, including
DST, not the import date or last status-change date.

`coverage.historicalStatusCoverage` is `observed_only`, and `complete` is false.
The first scan cannot recover leads that qualified and left these statuses before
observation. Later completed scans retain previously observed qualifications.
The dashboard and master overview display this limitation and last successful
refresh, including stale/error state while retries run.

Ad attribution is unverified: `source_id` and arbitrary UTM strings are not ad
identities. All qualifications are reported as unmatched; ad-level qualifications
remain unavailable. A provider-filtered summary returns `qualified: null` rather
than fabricating zero or assigning all CRM records to Meta. Sales are null and
revenue is unavailable. Advertising conversions retain their existing source.

## Operations

Run from `platform` with the existing Cloudflare credential binding:

```sh
python scripts/rollout-keycrm.py status
python scripts/rollout-keycrm.py schema
python scripts/rollout-keycrm.py activate
python scripts/rollout-keycrm.py pause
python scripts/rollout-keycrm.py filter-toys
```

Activation requires the existing encrypted secret and recorded successful live
API/scope verification. Configuration updates use compare-and-swap and readback.
Schema creation and activation are separate; deploy the tested Worker before
activation. `pause` disables scheduled reads and KeyCRM summary selection without
deleting stored observations. Do not run the preparation `apply` command against
an active configuration: it deliberately refuses to overwrite differing settings.
Deploy the source-filter-aware Worker after applying `schema`, then use
`filter-toys` to record the approved criterion and request a complete rescan. The
command refuses to replace an active scan lease; retry after that scan ends.

Inspect only aggregates and `last_error`, never provider payloads or contacts:

```sql
SELECT state,last_good_at,last_error,next_page,expected_total,next_attempt_at
FROM keycrm_sync WHERE project_id='prj_visa_agency_qa3b';
```

Release through `scripts/release-unified.py`, which preserves secrets/assets and
checks the active version before switching it. Rollback to the recorded previous
version and pause the connector if necessary; do not delete qualification history.

## Validation

Run KeyCRM adapter, durable snapshot and Cloudflare runtime tests, then build:

```sh
node --test recovery-tests/keycrm*.test.mjs recovery-tests/overview.test.mjs
npm run unified:build
```

The full recovery suite also needs its local synthetic fixture generated with
`python scripts/build-sales-demo.py`; this command only writes local build files.
Never apply synthetic import files to the working database.
