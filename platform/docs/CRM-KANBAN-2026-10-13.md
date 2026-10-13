# CRM dates, current deal metrics and wide kanban

The CRM opens with all arrival dates. Today, presets and the calendar filter
`leads.created_at` by inclusive calendar days in Asia/Tbilisi. Historical timestamps
with offsets and UTC timestamps are compared and ordered as instants. Home keeps
its own advertising period when switching to and from CRM.

The board response includes counts and revenue for the same arrival-date, search
and status filters as the cards, including leads beyond the first 25 in each stage.
Qualified means currently in Qualified; sales means currently in Sale. Revenue
sums the current amount of those sales, separately by currency. Moving a sale out
of Sale removes it from the board's sales and revenue. Editing its amount or
currency updates the current deal without rewriting the first conversion event.

The existing `crm_lead_state.sale_value` and `sale_currency` fields now store the
current deal amount within the versioned status-write transaction. Migration 0018
backfills only previously uninitialized amounts from existing first-sale milestones;
it creates no columns and changes no lead statuses. The production backfill changed
zero rows. Historical advertising CRM summaries and CAPI milestone/deduplication
semantics remain unchanged.

Cards cannot shrink inside long columns: name and phone remain visible before
opening. Historical Meta sources have the concise label Meta below the contacts.
Desktop CRM uses the width available beside the sidebar. When stages overflow,
a visible slider and arrow buttons above the board support mouse and keyboard
navigation, independently of operating-system scrollbar visibility. Native touch
scrolling is retained. At 1920px all six stages fit beside the client sidebar.

Validation: API tests cover Tbilisi midnight boundaries, mixed timestamp offsets,
invalid ranges, pagination, totals beyond 25 rows, reversed statuses, edited sale
amounts and preserved conversion/delivery history. Six Chromium scenarios pass,
including 30 contacts in a single column, 1440/1920/390px layouts, final-stage
navigation, actual date filtering, current-status metrics, reload persistence and
cached Home/CRM navigation. The other recovery suites pass, including the two
workerd tests rerun with local networking enabled. All test contacts were local.

Live lead completeness was checked read-only: HOUSEVIP has 106 contacts, all with
names and phones. User changes to statuses are preserved. Imports, Cloud Run,
PROFKIT Sheets, Make activation and CAPI configuration were not changed.
Live browser access to the reports hostname remains unavailable in this environment;
the active release is verified through the Cloudflare API.

Worker release: `983e5bb5-6f75-4169-b921-73826217040b`.
Rollback Worker: `f7e3ef56-ff62-470f-91af-05f614fd1b79`.
The rollback can retain the sale fields and any backfilled values.
