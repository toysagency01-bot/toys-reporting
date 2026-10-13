# BSCLINIC migration — 13 October 2026

Only BSCLINIC is migrated in this release. Taycher and the other requested
projects remain pending the user's review. Existing Karlovarska Sul and PROFKIT
integrations, Cloud Run services and source Sheets were not changed.

Published board: https://reports.toys-agency.com/bs-clinic-a5b4/

## Data and materials

- Project `prj_bs_clinic_a5b4`, Meta account `1754897661265056`, CZK.
- Meta's account metadata verified `Europe/Prague`; the new board's Today and
  initial seven-day period use that timezone. Original archive provenance keeps
  the source workbook's timezone.
- All 3,865 source advertising records, 18 September 2025–12 October 2026,
  were sealed in D1 after exact fact readback reconciliation.
- 51 business source sheets are privately archived in D1 with compressed,
  hashed pages; 44 material sections and two weekly reports are on the board.
  Contact/lead sheets were excluded from this dashboard migration.
- Source rows with identical date and campaign names but different metrics keep
  distinct source-row identities; campaign IDs were not invented. Direct API
  coverage replaces complete recent dates instead of adding to legacy totals.
- One reversed period in a legacy report is labelled as source text. Two
  single-digit date headings are normalized for presentation. 71 erroneous
  formula cells in the monthly report display “Нет расчёта в источнике”. The
  original CellData/formulas remain intact in the private archive.
- Google Ads had no source rows and is not presented as a connected channel.

## Direct import

The first monthly Meta requests timed out. BSCLINIC now requests the same
30-day range in seven-day chunks, with independent pagination and a 90-second
overall deadline. The account snapshot is saved atomically only after every
chunk succeeds. Existing projects retain their previous adapter settings.

First successful import: `2026-10-13T12:48:04.427Z`, all 30 dates from
14 September to 13 October. Existing day/night scheduling remains unchanged:
20 minutes during the day and hourly from 00:00–09:00 in Asia/Tbilisi.
The board reads D1; opening it does not initiate a Meta or Sheets report query.

## Verification and limitations

- 65 API/model/Worker tests passed, including partial import rejection,
  account metadata verification, draft scope isolation, and chunk boundaries.
- Five relevant Chromium scenarios passed: BSCLINIC channels, original
  Karlovarska/PROFKIT boards, fonts and client CRM navigation.
- A separate local browser check used the actual imported records: materials
  rendered, CRM switched without a document reload, no JavaScript errors, and
  no horizontal overflow at 390 pixels. Sheet requests were absent.
- SELECT-only checks against live D1 confirmed complete fresh advertising
  coverage, three ranked creatives, and rejection of public CRM access.
- Two of the top three creatives had cached thumbnails at the first import;
  no missing preview is represented as a successful image load.
- CRM uses the platform's existing functionality. Make intake, R2 creative
  uploads and the previously unfinished client OTP rollout were not enabled
  by this migration.
- This environment cannot visit the public report host. Production deployment
  and API/data checks are confirmed; public-host browser verification is left
  to the user's requested approval step.

## Deployment and recovery

- Migration Worker: `8a6c8327-7c7c-4bb9-9701-04bebc94b4a5`.
- Migration Worker SHA-256 matched the tested local bundle:
  `03d421a9958e76c6cc862500b203cc64348347098d8f0b9f9cf14a6727b9db6f`.
- Pages gateway: `c19b88b4-475a-4d54-b6b4-515f62137377`, production success,
  including the reports.toys-agency.com domain.
- Data release: `rel_bs_clinic_a5b4_ef665b84026e94aa59300eaa`.
- Original pre-migration Worker: `7e4b297f-586e-4f6b-a9ce-bddbb1249966`.
  Pre-publication Worker with chunked imports: `d573ae00-4c2d-45df-b5eb-8b90959c2108`.

Raw captures, readback artifacts and browser screenshots are outside Git under
`/workspace/toys-bsclinic-migration-20261013`. The preparation/import scripts
are resumable, reject another existing release, and preserve other projects.
Run `node scripts/build-pages-hotfix.mjs` before deploying the Pages gateway;
it now bundles the shared project registry. Do not use the old static Pages
build command, which would replace unrelated site assets.

## Independent Meta reconciliation — 13:16 UTC

The migration checks above did not independently compare imported ad rows to
Meta's account report. That gap is now covered by an optional account-level
reconciliation, enabled only for `int_bsclinic_meta` with
`reconcileAccountTotals: true`. Other integrations and their attribution
settings are unchanged.

The live import requested a separate `level=account`, daily Meta Insights
report for 14 September–12 October 2026, Europe/Prague, using the same API
defaults and `lead` action as the ad import. All 29 completed dates matched
individually with exact decimal arithmetic, including zero-activity dates.
Independent SELECT-only readback then confirmed the same values in D1's
normalized daily snapshots, timestamp `2026-10-13T13:16:02.296Z`.

| Metric | Independent account report | Imported ads / D1 | Difference |
| --- | ---: | ---: | ---: |
| Spend, CZK | 87576.42 | 87576.42 | 0 |
| Impressions | 478125 | 478125 | 0 |
| Clicks | 13128 | 13128 | 0 |
| Leads (`lead`) | 585 | 585 | 0 |

The 13 October snapshot contains 1349.87 CZK, 6451 impressions, 199 clicks
and 16 leads as of the import. Today is excluded from the completed-day
reconciliation because the account changes between requests.

This verifies API account totals against imported details and stored data.
It does **not** verify a user's unobserved Ads Manager column or attribution
selection, nor the pre-14-September historical source against Meta. API
attribution and action-report-time defaults remain explicit in the audit;
`adsManagerSelectionVerified` is false. No blanket 100% Ads Manager agreement
is claimed.

Subsequent BSCLINIC imports persist an independent audit in `sync_runs`
(`meta-account-reconciliation`). Differences or audit errors record a warning;
they do not replace advertising data or falsely fail an already committed
snapshot. Audit fetching has an 18-second cap within the existing overall
import deadline. Ordinary imports without the opt-in flag make no extra
account-report request.

- 13 focused tests passed: reconciliation, direct imports and Worker runtime.
- Active Worker: `8d00c8ee-ae9d-44c4-89c5-8089498c79d7` at 100%.
- Live Worker bytes match the tested bundle, SHA-256:
  `05495b0413252f12e08f64268ea6a78baba4c0866619aa42dd8695ad46426861`.
- Worker rollback: `8a6c8327-7c7c-4bb9-9701-04bebc94b4a5`.
- Full private evidence: `prepared/account-reconciliation.json`,
  `prepared/account-reconciliation-d1.json` and
  `prepared/audit-worker-verification.json` in the artifact directory above.
