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

External setup still required: run the guarded Cloud Run discovery installer;
bind pages to their projects; configure Page/leadgen subscriptions and project CAPI
datasets; connect website servers to the project API. No production Meta lead or
CAPI delivery has been verified yet. R2/file storage remains deferred.

D1: account analytics on 2026-10-12 showed 84,328 writes in the reporting DB and
7 in the other DB. Immutable Google snapshots previously inserted every row again
when any metric changed. Migration 0014 stores each new page as JSON; a compatibility
view reads both formats. The current 1,353-row delivery uses 8 row pages. Pagination,
replay conflict checks, cross-page duplicate detection, exact readback counts and
all hierarchy metrics are preserved. Old snapshots were not rewritten or deleted.
The 20-minute reporting schedule remains. No paid plan was enabled.

Worker release: `02d51ef7-f035-4332-9f3a-9191471ba3ac`.
Rollback: `2911d7be-b82b-46b4-b0ac-4817d8250828` (previous dashboard plus new secrets).
Migrations 0012–0014 are additive and already applied. Encryption key was generated
once; do not replace it or stored credentials will become unreadable.

Validation: 36 recovery tests, 15 Chromium scenarios, 3 mocked discovery tests,
and a syntax/guard check against the existing Cloud Run source patch. Browser
checks were local; live site domains are not allowed in this execution environment.
