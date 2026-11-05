# Reviews Plus advertising connection

The active Reviews Plus project had its ordinary dashboard and materials but no
advertising integration or imported advertising snapshots. Its CRM connection
was also absent. Creating the project had not completed these connections.

Connected the user-specified Meta account `1004879622002632` through the existing
scheduled, read-only importer. Independent Meta account metadata established AED
and Asia/Dubai; those values were adopted only after the first successful import.
The browser period timezone now matches the account.

The importer selects the result event using verified ad-set optimization metadata
with a configured lead fallback, requests individual daily reports, and checks
completed-day results/expenses against independent account/ad-set reports.
The initial import completed at 2026-11-05T11:21:42Z, persisted 30 daily snapshots
for October 7–November 5, and matched all 29 completed local days. No campaign or
role changes were made. `scripts/configure-reviews-plus-ads.py` provides scoped
prepare, refresh, confirm and status commands.

The CRM partner connector is still unconfigured. The current managed environment
does not allow `reviews-plus.com`; its API has not been verified or imported.
Advertising conversions must not be represented as CRM qualifications or sales.
CRM credentials are not committed or included in these notes.

The subsequent CRM/GA4 request is not complete. The current environment's
confirmed policy still excludes the CRM host, and there is no GA4 connection,
Google runtime identity or Analytics credential configured. A GA4 property link
was requested. An optional read connector was offered for source inspection;
it has not been confirmed installed or authorized. Access granted to a Gmail
address alone is not platform API authorization. No CRM field schema or GA4
events have been verified yet. Before claiming lead-level attribution, inspect
whether the CRM stores GA4 client/session identifiers and UTM/campaign IDs;
aggregate GA4 counts alone cannot establish a match to a specific CRM sale.
