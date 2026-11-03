# CRM boards

Migration `0026_crm_boards.sql` must run before the Worker release. It is additive:
existing leads keep `board_id=NULL`, interpreted as the `default` (Основная)
board, and their current statuses and conversion history are untouched. The
primary board continues to use the project's configured niche template.

`GET /api/v2/projects/:slug/crm/boards` lists project boards and creation templates.
`POST` requires a scoped administrator/team identity, same-origin protections
and an idempotency key. TOYS' admin-only CRM policy applies to every board.
Clients retain their existing CRM permissions but cannot create boards. Board
membership is project membership, not a new department-level security boundary.

Each new board snapshots a validated stage list: 2–30 unique labels, a normal
first stage and one sale stage. Qualification and sales are explicit stage
properties, never inferred from column position. In **CRM → board name →
Настроить доску**, assigned team members and administrators select qualification
stages using **Квалифицированный лид** checkboxes. The same checkboxes appear
during board creation. A sale stage can also qualify when checked. The initial
intake stage stays ordinary, and exactly one sale stage is required.

Saving rules updates current board qualification counts without creating
historical milestones or CAPI jobs. With CAPI connected and qualification events
enabled, a new transition from an unqualified stage into a selected stage uses
the existing stable first-qualification milestone and deduplicated delivery.
Moving between selected stages does not create additional qualifications.
Existing historical milestones are retained when an earlier stage is unchecked.
External CRM import mappings and CAPI connection settings are configured
separately; these checkboxes describe native leads on this board.

Board editing supports renaming, reordering and explicit transfers before an
occupied stage is removed. Version checks protect concurrent lead and board
edits. It does not automatically migrate historical conversion events.

`?board=ID` scopes CRM rows, search, dates, pagination and current KPIs. Omission
selects the primary board for backward compatibility. Manual creation accepts
`boardId`; automatic intake always starts on the primary board. Provider retries
keep the existing lead's board and status. Each lead belongs to exactly one board.

PATCH on a lead accepts `boardId` plus an explicit destination `status`. Both
are validated against the same project and changed in the existing versioned
transaction, with a transfer entry in status history. The source identity and
qualification/sale milestone IDs remain attached to the lead, so transferring
between boards does not emit duplicate CAPI conversions. Project-level dated
advertising summaries still aggregate historical milestones across all boards.

Before publishing: run the recovery tests and `crm-boards.config.mjs`, plus
TOYS qualification and admin-restriction browser regressions. Production QA
must not create fake lead conversions. Verify migration, active Worker version,
project lead totals and existing CAPI configuration through aggregate queries.
