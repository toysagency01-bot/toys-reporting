# CRM rollout — 2026-10-12

Client CRM is a separate Home / CRM navigation item on each native client board.
`/mvp/api/v2/projects/{slug}/content-crm` is an authenticated project-scoped view.
An authenticated client can create leads and update status only in their assigned
project. Public reports contain aggregates, never contacts or conversations.
The agency view is `/mvp/api/v2/master/view` (and `/mvp/master/` when the Pages
routing deployment is active). Connection settings require the agency master role.

Implemented: approved lead statuses; optimistic concurrency; idempotent intake;
first qualification / first sale milestones; currency-separated revenue; durable
CAPI delivery with hashed contacts, stable event IDs, acknowledgement and retries;
Meta Lead Ads signed webhook and page-to-project binding; authenticated website API.
Keys for website APIs are sent in Authorization headers only. Tilda requires an
adapter that can authenticate submissions; direct unauthenticated forms are not enabled.

Instagram Direct and WhatsApp Business have a signed inbound adapter, project
bindings, contact/message deduplication and conversation storage. Neither integration
is activated. Existing personal messengers and the separate Telegram project are untouched.

Cloud Run discovery completed successfully at 2026-10-12T13:32:44Z: 25 pages with
tokens and 17 advertising accounts, no warnings. HOUSEVIP page 1342968218898825
and Karlovarska page 254968301032536 are bound to their corresponding projects.
Karlovarska CAPI is configured with its existing advertising account's sole dataset
438565052630502 and the encrypted agent credential. No production CAPI delivery
has been verified. HOUSEVIP has no dataset configured; PROFKIT and AM Klinika pages
were not returned by this discovery. Other pages remain unbound pending project mapping.

The owner has Make and prefers using it for incoming leads. Project intake now
accepts full Meta leads from Make at `/api/crm/ingest/{slug}/meta-lead`, using a
project-scoped Bearer credential, native lead ID, page binding validation and the
same deduplication identity as direct Meta delivery. See MAKE-CRM.md. Connection
settings show the endpoint and field mapping. Direct app webhook configuration
is optional when Make's native Facebook Lead Ads connection is used; page binding
from the UI no longer subscribes our app automatically. Private CRM setup also works
for draft projects without publishing their dashboards.

External setup still required: configure/extend the owner's actual Make scenarios,
generate their project intake keys in the protected settings and verify a real lead.
Configure remaining project CAPI datasets and map remaining pages. No production
Meta lead or CAPI delivery has been verified yet. R2/file storage remains deferred.

D1: account analytics on 2026-10-12 showed 84,328 writes in the reporting DB and
7 in the other DB. Immutable Google snapshots previously inserted every row again
when any metric changed. Migration 0014 stores each new page as JSON; a compatibility
view reads both formats. The current 1,353-row delivery uses 8 row pages. Pagination,
replay conflict checks, cross-page duplicate detection, exact readback counts and
all hierarchy metrics are preserved. Old snapshots were not rewritten or deleted.
The 20-minute reporting schedule remains. No paid plan was enabled.

Worker release: `3cbbc86a-2651-4c1a-896d-29e7b89b519e`.
Rollback: `02d51ef7-f035-4332-9f3a-9191471ba3ac` (CRM before Make intake).
Migrations 0012–0014 are additive and already applied. Encryption key was generated
once; do not replace it or stored credentials will become unreadable.

Validation: 38 recovery tests (explicit in-process runner), 16 Chromium scenarios, 3 mocked discovery tests,
and a syntax/guard check against the existing Cloud Run source patch. Browser
checks were local; live site domains are not allowed in this execution environment.

Pages publication was attempted three times and failed with Cloudflare's
`Failed to publish your Function. Got error: Unknown internal error occurred.`
Canonical Pages deployment remains `96dd2411-b276-4582-b0a7-e977ba453123`.
Its existing API forwarding already supports the client CRM and master view URL
above, so use `/mvp/api/v2/master/view` until the short alias deploy succeeds.
Worker deployment was independently read back from the Cloudflare API.
Existing 20-minute cron and new 2-minute CRM retry
cron were also read back. No test contacts were written to production.
The first real Google delivery using compact storage was verified at
2026-10-12T13:20:39Z: 1,353 detail rows stored in 8 compact pages.
