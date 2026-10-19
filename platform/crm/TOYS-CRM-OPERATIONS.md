# TOYS CRM intake

Approved mapping on 2026-10-19:

- Project: `toys-agency-ctft` / `prj_toys_agency_ctft`.
- Meta ad account: `503232073666825`.
- Facebook Page: `104044671298332` (Toys.agency).
- App: `1115625427695947`.
- Dataset: `1036998279992732`.
- CRM access: administrators only, enforced by the API as well as navigation.
- Live start: 2026-10-19 00:00 Asia/Tbilisi.
- History was initially deferred. The user subsequently authorized Page history
  from **2026-09-01 00:00 Asia/Tbilisi** to the start of this backfill.
  The earlier full-year request remains deferred; do not extend this window.
- CAPI: `QualifiedLead` only. Sales still count in CRM but do not emit CAPI events.

## Credentials and activation

`META_ADS_ACCESS_TOKEN` remains the advertising import credential. The separate
`CRM_META_ACCESS_TOKEN`, when present, is used to obtain a Page token. It must
belong to the approved app, with Page access, `leads_retrieval`,
`pages_manage_metadata`, and the existing Page/ad read permissions. Secrets are
stored in Worker secrets or encrypted D1 columns, never in source or diagnostics.

Run `python scripts/configure-toys-crm.py status` for aggregate progress, without
contacts or credentials. The `activate EXPECTED_WORKER_VERSION` operation is
idempotent and refuses incompatible existing mappings. Never reset import
cursors to retry a permission error. The admin's **Retry** control resets the
source retry time, preserving progress. Normal retries back off to one hour.

## Delivery and reconciliation

The signed webhook writes durable lead IDs before acknowledging receipt. Live
leads must match the configured ad account. Historical leads are Page-scoped,
as requested, and can include organic leads or previously used accounts. Meta
lead ID deduplicates webhook, historical import, and reconciliation deliveries.
Existing statuses and deleted leads are preserved. No historical qualification
or sale events are invented by import.

The two-minute CRM scheduler processes bounded pages and stores pagination
cursors with queued IDs in the same D1 batch. Discovery repeats every six hours;
each form is periodically reconciled with a one-day overlap, independently of
the advertising refresh schedule. CAPI/live deliveries have priority over the
historical backlog. Delivery failures remain inspectable and retryable.

Migration `0025_crm_meta_history_opt_in.sql` makes historical retrieval opt-in.
Disabling history also discards historical scan cursors on the next scan and
enforces the live cutoff/account on previously queued deliveries. Do not enable
history for TOYS outside the newly approved September window without renewed authorization. The source was paused while its
CRM credential was unavailable; resume only with this migration and Worker deployed.

`scannedForms` means the API pagination completed, not that a full year was
available. Meta retention and source permissions can limit available history;
older exports must be reconciled separately. Do not claim historical completeness
based on an empty response or a successful cursor scan.

## CAPI verification

Setup checks that the chosen dataset belongs to the configured ad account, then
stores the encrypted credential. A configuration success is **not** a confirmed
conversion delivery. A real status change creates one stable event ID per lead
and milestone. Only `events_received: 1` marks delivery as sent; expired events,
deleted leads, pre-connection milestones, and disabled event kinds cannot send.

Use Events Manager's test-event mode with a user-provided test code for a
synthetic end-to-end check, or inspect a genuinely qualified lead's acknowledgement.
Never fabricate a production conversion. Dataset/event mapping and the campaign's
conversion-leads optimization goal must also be checked in Meta before claiming
that ad delivery is optimizing for CRM quality. This rollout does not edit campaigns.

Observed initial blocker: the existing ad token has `ads_read`, `ads_management`,
Page read access and other scopes, but lacks `leads_retrieval` and
`pages_manage_metadata`. Meta returns code 200 on reading form leads. CRM privacy
and CAPI configuration can be enabled while intake waits for the CRM credential.

## Live activation verified 2026-10-19

Worker `adee1d40-4bbd-40ec-971b-98ed35f3f75d`, source code `618502a`.
After the administrator granted Page management access to the system user,
Meta confirmed both the app callback and the Page `leadgen` subscription.
`connected_at=2026-10-19T09:22:17.000Z`, source state `ready`, no source error,
Page `subscribed=1`, `history_enabled=0`, CRM access `admin`. Discovery found
41 forms. Reconciliation is incremental; this is not a claim that all forms
have been scanned or that a webhook lead has already arrived. At activation
there were no delivered lead jobs and no imported TOYS leads. Verify the first
real/test lead through Meta's Lead Ads testing tool, without creating a fake
production CAPI qualification. Older stored diagnostics are timestamped failures
from before the Page permission was fixed, not the current connection state.

## September history backfill

Use `python scripts/configure-toys-crm.py import-history 2026-09-01 EXPECTED_VERSION`.
This pauses only the scanner, resets form cursors to the explicit new window,
and resumes it with history enabled. Existing leads, statuses, deletion markers,
and signed webhook intake remain intact. Repeating the same start date resumes
without resetting progress. The scheduled scan processes up to 20 form pages
within a 60-second budget, then drains up to 50 jobs within 120 seconds. Live
and CAPI jobs remain ahead of historical jobs. The webhook's short drain is unchanged.

Backfill completed 2026-10-19 after the 09:38 UTC scan: 41/41 forms fully
paginated, 50 unique Meta lead IDs delivered and present in CRM (49 new cards
plus one pre-existing live-day card), zero pending/error/blocked deliveries.
All cards have a name and at least a phone or email. No records precede the
approved September cutoff, no unmatched delivered IDs, and no CRM milestones
were created. Earliest lead returned was 2026-09-09T07:33:24Z. This verifies
all data returned by Meta for the requested period, not data Meta may no longer
retain. Runtime/UI validation: 162 unit/runtime tests and two admin CRM browser
tests passed before this backfill deployment.

## TOYS sales pipeline

Project setting `crmTemplate=toys_agency` selects the user's 15-stage pipeline
in `crm/pipelines.js`, without changing any other project's template. Old general
labels remain visible through aliases (not a rewrite of status history). Newly
ingested leads use the selected template's first stage, `Новые`. Stages from
`Квалифицирован` through `Согласование договора` retain qualification and use
the same deduplicated qualification milestone. `Успешно реализовано` requires
an amount/currency and counts as a sale. Deferred, junk and lost stages are
not currently qualified or sold. TOYS remains admin-only and qualification-only
for CAPI; enabling the template creates no conversion events.
