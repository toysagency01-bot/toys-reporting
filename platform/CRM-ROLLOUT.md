# CRM rollout — 2026-10-12

Client CRM is a separate Home / CRM navigation item on each native client board.
`/mvp/api/v2/projects/{slug}/content-crm` is an authenticated project-scoped view.
An authenticated client can create leads and update status only in their assigned
project. Public reports contain aggregates, never contacts or conversations.
The agency view is `/mvp/api/v2/master/view` (and `/mvp/master/` when the Pages
routing deployment is active). Connection settings require the agency master role.

The owner requested applying the ready changes to currently published projects
and deferring Make setup. All three public platform boards are enabled for CRM:
HOUSEVIP (`housevip-cxp7`), Karlovarska Sul (`karlovarska-sul-k4rm`) and
PROFKIT Instashop (`profkit-instashop-r4vk`). The published allowlist, data-release
pointers, dashboard-config pointers and deployed Worker bundle were read back;
the missing PROFKIT CRM settings were initialized at 2026-10-12T13:57:15Z.
Existing CRM configuration and CAPI credentials were preserved. Other projects
were not newly published. Incoming Make scenarios are explicitly deferred.

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

Worker release: `6445efdc-ad13-43fa-9a45-e0030d73405e`.
Rollback: `ba9efebe-f9c7-40f4-9582-be7c97099ae8` (before branded entry and client access).
Migrations 0012–0014 are additive and already applied. Encryption key was generated
once; do not replace it or stored credentials will become unreadable.

Validation: 46 recovery tests (explicit in-process runner), 24 Chromium scenarios, 3 mocked discovery tests,
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

October 12 cache/navigation repair applies to all three published client boards:
HOUSEVIP, Karlovarska Sul and PROFKIT. The dashboard and authenticated CRM now
remain mounted when switching sections; browser history, selected period and CRM
filters survive the round trip. CRM reads use a bounded, project/query-scoped
60-second memory cache, shared requests and immediate invalidation after writes.
No lead data is persisted to localStorage or a shared HTTP cache. CRM updates its
visible list in the background; advertising retains the 20-minute schedule.
The direct protected `content-crm` URL opens the same client shell.

Provider refreshes run in `waitUntil`, coordinated by the existing D1 leases.
Requests return last-good data immediately and the browser polls a pending refresh
with bounded backoff. Worker isolates no longer retain request-owned provider
promises across requests. Meta insight requests are capped at 18 seconds and preview
requests at 6 seconds, within a 25-second adapter deadline; missing previews do not
discard statistics. The date selector has a single border. Verification includes
blocked-provider concurrency, stale cache recovery, writes invalidating the CRM
cache, zero data requests on a quick section round trip, browser history and mobile
layout. Live Meta/browser verification remains unavailable under the environment's
network policy; the active deployment is verified through the Cloudflare API.

The subsequent UI performance release preserves chart instances, batches native
renders, defers closed campaign detail DOM and caches project materials and recent
report/approval views. Existing styles and 20-minute advertising refresh remain.
See [the performance audit](docs/UI-PERFORMANCE-2026-10-12.md) for reproducible local
measurements and limitations. The active Worker version and exact bundle hash were
verified through the Cloudflare API; no migration or production test data was needed.

Branded entry and master-managed client grants are described in
[Client access rollout](docs/CLIENT-ACCESS-2026-10-12.md). Migration 0015 is pending:
D1's daily write allowance was exhausted, so the existing scheduled handler will
retry after 2026-10-13 00:00 UTC. Client creation remains visibly disabled until
schema readiness. The broader verified-email Access policy awaits explicit owner
confirmation; existing owner authentication remains in force.
