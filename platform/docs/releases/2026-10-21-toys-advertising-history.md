# TOYS Agency advertising history recovery — 2026-10-21

TOYS Agency's current-day figures were correct, but historical advertising spend,
impressions and clicks were understated. Successful multi-day Meta responses had
replaced complete daily snapshots with incomplete values. Reconciliation recorded
warnings but did not prevent publication. At 05:00 UTC, the independent account
and ad reports both showed USD 612.65 for 2026-09-22 through 2026-10-20. Later
imports reported zero account spend and only USD 92.28 at ad level for that range.
The CRM calculations were unaffected.

The TOYS integration now requests one day per insights window instead of seven.
The scheduled 16:20 UTC run recovered its historical campaign/group/ad hierarchy
in D1. Snapshot data at 16:21 UTC produced:

| Period | Spend USD | Impressions | Clicks | Leads |
| --- | ---: | ---: | ---: | ---: |
| October 21 | 32.71 | 4,954 | 181 | 9 |
| October 15–21 | 117.81 | 11,494 | 316 | 22 |
| September 22–October 21 | 645.68 | 77,841 | 1,479 | 61 |

These are observed snapshot totals, not promises that live Meta numbers remain
constant. The last recovery run preceded the new account-check fallback: its
multi-day account audit still disagreed. The next scheduled run will independently
retry discrepant account days; successful publication requires exact daily
agreement. No direct live-site browser access or manual Ads Manager comparison is
claimed.

Daily insights windows now use independent pagination parameters and at most
three concurrent requests. For single-day imports, account reconciliation retries
only discrepant days, within the existing timeout and at most three concurrent
requests. A retry is accepted only if every checked metric agrees. Discrepant or
unverified historical days preserve their saved snapshots; matched days and the
current live day can still update. A blocked historical publication records
`account_reconciliation_mismatch` and waits for the normal scheduled retry.

Period shortcuts now include today using the project's calendar, consistently
with the TOYS initial seven-day range. Monetary displays retain cents. Overview,
master summaries, campaigns and creatives use a new advertising cache query key,
so prior incorrect cached responses are not reused after loading the new UI.
The header follows the latest loaded advertising date. No CRM statuses, milestone
dates, CAPI delivery or advertising campaign state changes were made.

Validation:

- 215 automated tests passed, including exact reconciliation, failed daily retries,
  preservation of an existing historical hierarchy, current-day updates, scheduled
  retry cadence and real Cloudflare request semantics for daily windows.
- Two desktop/mobile period tests and five cache/render/CRM regression scenarios
  passed. Screenshots were inspected.
- Local built-Worker/Pages browser QA using captured non-contact TOYS advertising
  data matched D1 totals for today, seven days, thirty days and maximum, on both
  desktop and mobile, including reload. This was local QA, not a production-site
  browser session.
- Cloudflare readback confirmed the release at 100% and the Pages registry.

Worker: `06dd9861-4854-4422-abea-12b76ca22fce`.
Rollback Worker: `203eb8bb-8e78-4339-91e3-01b4d6d1d9a3`.
Worker SHA256: `170c16effae185fdf3d409ca7e81ca2a115d07dedf3740d176ffc41dce7395ef`.
Source implementation: `f11a700`.
No schema migration. TOYS integration `int_toys_agency_meta` retains its account,
currency, timezone, credentials and cadence; only `insightChunkDays` changed to 1.
Private capture and configuration backup remain outside Git under `/tmp`.
