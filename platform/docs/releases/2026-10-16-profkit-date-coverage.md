# PROFKIT date coverage

The commerce dashboard defaulted to the first (archived advertising) generation's end, truncating independently refreshed business sales. Instashop's relative date controls also anchored to archived rows, and the header never reflected the direct advertising refresh.

- Default commerce range now covers all dataset ranges; explicit request/manifest ranges remain authoritative.
- PROFKIT relative periods and Maximum end on the current project-local date.
- Separate advertising/sales dates reflect available data. Partial business totals carry a coverage notice; incomplete-period ROAS and acquisition costs stay unavailable, and missing sales chart points are gaps.
- The corrected PROFKIT dashboard response has a new cache address so old truncated responses are not reused. Scheduled response caching remains active; reload does not fetch advertising again.
- Sheets, Cloud Run, import schedules, source records and access grants were not modified.

## Validation

- Read-only production D1 readback through the corrected commerce API code: default response includes sales through 2026-10-15; explicit 2026-10-12–15 returns four days and 56 sales. Direct Meta daily snapshots cover 2026-10-16 with successful import status.
- Unit suite: 32 test files passed initially; two runtime tests needed permission to open local network listeners, and both passed on rerun.
- Browser QA: admin/client PROFKIT, initial weekly route, Today/7-day/30-day/Maximum/custom periods, complete and partial sales, currency conversion, reload cache reuse, mobile overflow. Adjacent Karlovarska and shared calendar tests passed.
- Desktop/mobile screenshots inspected. Browser data is synthetic; production data check uses D1 read-only access, not an authenticated browser session on the production domain.
