# TOYS CRM intake

Approved mapping on 2026-10-19:

- Project: `toys-agency-ctft` / `prj_toys_agency_ctft`.
- Meta ad account: `503232073666825`.
- Facebook Page: `104044671298332` (Toys.agency).
- App: `1115625427695947`.
- Dataset: `1036998279992732`.
- CRM access: administrators only, enforced by the API as well as navigation.
- Live start: 2026-10-19 00:00 Asia/Tbilisi.
- Requested history: 2025-10-19 to initial activation, including the activation day.
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
