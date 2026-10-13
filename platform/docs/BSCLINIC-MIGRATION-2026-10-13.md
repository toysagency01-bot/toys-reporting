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

- Worker: `8a6c8327-7c7c-4bb9-9701-04bebc94b4a5` at 100%.
- Live Worker SHA-256 matched the tested local bundle:
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
