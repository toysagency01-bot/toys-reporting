# AM Klinika lead requests and comments — 2026-10-16

Imported comments were buried in status history, while original form requests
were absent from the lead editor. The latest Sheets feedback also contained
changes and contact records that were missing from the previous migration.

The editor now presents the original request/service and a separate Comments
section, preserving full line breaks and escaping source text. The new-comment
input remains blank. History keeps its status entries; importing a comment is
labelled as such, without claiming a status transition. Responses from a previously
closed card cannot replace another card's comments.

A bounded read-only capture of AM Klinika's project workbook and original client
lead workbook was matched using stored feedback identities and Meta lead IDs.
The reconciliation added 11 comment events, restored nine contact-backed cards
(eight website leads and one Meta lead with a date recovered from the original
workbook), and added original requests/services to 71 cards. Existing comments,
statuses, ownership, sales and deletion state were preserved. There are now 72
cards. Of 71 nonempty feedback rows, 70 are linked; the remaining one refers to
`test test`, with no contact row in either source. It was not attached by guesswork.

No source workbook was edited. No advertising settings, conversion milestones
or CAPI deliveries were changed. Private captures, plans and backups remain
outside the repository under `/workspace/toys-amklinika-comments-20261016`.
The repository's reconciliation planner contains no contact data. Metadata updates
use compare-and-swap; event IDs are deterministic. Deleted contacts are preserved.

Validation:
- Actual-data local SQLite run preserved existing rows apart from request metadata;
  a second application and a newly generated plan produced no additional writes.
- Production D1 readback verified all new cards/events, all existing records and
  unchanged delivery/milestone/configuration records.
- 135 backend/unit checks and four relevant Chromium scenarios passed, including
  multiline imported text, HTML escaping, CRM editing and client navigation.
- Live-site browser access remains blocked by the environment's domain policy;
  Chromium used local fixtures. Active Worker bytes/bindings/crons are verified
  separately through the Cloudflare API.

Worker version: `3a5843ef-c71a-4861-a744-112b431e9230`.
Previous version: `32ce29c5-0f8b-4eca-8511-82e726a5f5d3`.
