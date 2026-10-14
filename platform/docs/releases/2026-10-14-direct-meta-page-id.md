# Direct Meta setup by Page ID

AMKLINIKA's owner-supplied Page ID is absent from the saved page discovery list.
The master connection form now accepts a numeric Page ID, resolves its page
token through the existing agent access and verifies page/app identities and
lead-read permission before connecting. Checking alone does not store a token,
map a page, or subscribe anything. A conflicting project assignment is rejected,
including one made while the request is in flight.

The owner supplied app `1933678520679141` and AMKLINIKA page
`1069830429555541`. These and HOUSEVIP page `1342968218898825` are saved as
draft setup identifiers in the two projects, preserving their other settings.
The UI prefills them. A replacement App Secret remains in the password field
after a successful check so activation uses the same credential; it is cleared
after successful activation and never persisted in browser storage.

- Validation: 131 backend/runtime tests and 48 browser scenarios passed.
  New tests cover targeted discovery, missing permissions/identity mismatch,
  concurrent page ownership, master-only defaults and the browser setup flow.
- Worker version: `66e6abd4-ee8c-4f02-8d6c-9362058927eb`.
- Rollback version: `66a8d640-fc91-41b5-be87-312aabcea6fe`.
- No schema, advertising import, Cloud Run, CAPI activation, or cron changes.

Live activation is still pending. This executor can reach Cloudflare's API but
cannot reach Graph API or the reporting host; no network workaround was added.
The owner must initiate **Подключить напрямую** in each project's master CRM
connection settings, then submit a Meta test lead and confirm its arrival.
Synthetic tests and successful deployment are not proof of production delivery.
