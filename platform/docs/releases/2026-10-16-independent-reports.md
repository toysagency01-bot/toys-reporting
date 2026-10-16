# Independent reports and BSCLINIC recovery

“Add result” previously opened the singleton `weekly-main` editor. Publishing SMM therefore replaced the current Meta publication; deleting that item hid both versions. The earlier display-only QA did not cover adding a second report.

New reports now receive their own UUID logical key. Add opens an empty form; Edit and Continue draft select a specific report. Reports from different channels or the same channel and period coexist. Each has independent versions, comments and deletion. Creation is deferred until first save, is retry-safe, and a retired UUID cannot be recreated by a stale initialization request. The old `weekly-main` remains readable and editable for compatibility.

The report collection reads only current publications and latest drafts in two project-scoped queries. Viewers never receive drafts or internal item metadata. Published screenshot authorization covers all active report items; private draft screenshots remain protected. No schema migration is required.

## Recovery

BSCLINIC Meta publication `4e114f2c-76dd-4b0a-a55a-d06f5a13f6dd`, dated 2026-09-15 to 2026-10-15, was preserved in archived history after it was replaced by SMM and the item deleted. Restore it into independent key `weekly-ac5669f9-7bf1-5273-9e54-e3fe5514be3f`, preserving the 690-character summary and every original block byte-for-byte. Original archived versions and deletion records remain untouched. Record the source revision in a publication event and verify the copied blocks against it. Do not republish the deleted SMM placeholder or earlier test report.

## Validation

- All 150 recovery tests passed, including independent channel publications, draft privacy, per-report comments, scoped deletion, surviving neighboring reports and stale-create rejection.
- Four browser report scenarios passed: drafts/publication/comments/screenshots, deletion, full-text/empty-field display, and adding/editing/deleting SMM alongside Meta and Google.
- Three adjacent browser scenarios passed: client viewer, durable draft workflow and navigation caching.
- Desktop/mobile report list screenshots inspected. Browser QA uses local synthetic data; production recovery is verified through D1 readback.

Rollback Worker: `d58c8bfc-0e50-4b0c-ac46-c7d84635b647`. Rolling back the UI hides independent reports from its singleton view, but does not delete their data.
