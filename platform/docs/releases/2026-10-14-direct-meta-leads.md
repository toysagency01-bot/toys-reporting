# Direct Meta Lead Ads setup — 2026-10-14

Published a master-only direct connection workflow, verified subscription
readback, signed delivery improvements and exact-ID deduplication against
historical CRM cards. See [configuration and activation state](../DIRECT-META-LEADS.md).

This release prepares activation; it does not claim that HOUSEVIP or AMKLINIKA
has received a real direct lead. The owner's App ID and AMKLINIKA page identity
are still required. No Meta subscription or CRM project configuration was
changed during deployment. No CAPI activation or historical backfill was run.

- Validation: 127 recovery tests and 47 browser scenarios passed.
- Real D1 reads confirmed mapped pages, credential presence, provenance and
  pending activation. Graph responses and contacts in automated tests were
  synthetic. Direct Graph/reporting-host access is outside the executor's
  network policy; the owner can complete setup through the master UI.
- Active Worker: `66a8d640-fc91-41b5-be87-312aabcea6fe` (100%).
- Previous/rollback: `5a007ee8-f7af-4c9b-9b6d-abb1d23ed322`.
- SHA-256: `04b35032607876e9b8f1b4b139dddd3d5ac2d75e4e4bb6c2bd49caddc3d42fc9`.
- Cloudflare readback matches the tested bundle. Existing bindings, compatibility
  settings and crons are preserved. No database migrations or Pages release.
- Advertising imports, Cloud Run and protected source spreadsheets are unchanged.
