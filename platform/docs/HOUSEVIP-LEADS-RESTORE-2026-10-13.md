# HOUSEVIP lead navigation and private history

The platform hid the original Leads button while leaving its legacy handler
pointing at a removed Sheets tab. That handler selected the first Meta tab
(the project plan). The button now opens the mounted CRM, and `#leads` and
`#meta/ЛИДЫ` resolve to the same authenticated screen. Viewer access retains
the button; contact access still uses the private CRM endpoint.

The original lead sheet contained 109 rows, including one four-row exact
duplicate. `restore-housevip-leads.py` restored 106 unique leads and both
feedback records. Source row identities, original timestamps, contact
preferences and budgets are preserved. Source timestamps use the workbook's
Europe/Moscow timezone. The historical `Связались` status maps to `В работе`
in the approved CRM workflow; the exact original status remains in history
and provenance. No historical CAPI events were queued.

All imported fields were compared with D1 readback. Three Chromium checks
passed: Leads/deep links, viewer navigation, cached Home/CRM transitions.
Worker `f3458d37-bcb7-4dae-bb5c-98228b2f87b8` was deployed at 100%, replacing
`8d00c8ee-ae9d-44c4-89c5-8089498c79d7`.

Private captures are outside Git in `/workspace/toys-rollout-20261013`.
This restores history only; ongoing lead intake through Make remains postponed.
