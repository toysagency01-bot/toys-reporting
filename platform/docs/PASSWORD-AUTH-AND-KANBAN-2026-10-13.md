# Native login and HOUSEVIP CRM

Published Worker: `e7a19e45-e923-49c2-b2fa-62a12591a6f0`.
Previous Worker: `f571c624-dc4b-417a-bc1f-d30ba99188ca`.

## Login

`/login` now accepts email and password inside the TOYS design. The owner issues
one-time, 24-hour activation/reset links in Master → Access. Clients set their
own password. Invitations are handed over by the manager; no automatic email
delivery is configured. Registration is invitation-only.

Passwords use the OWASP scrypt profile N=16384, r=8, p=5, independent random
salts and constant-time comparison. Work is capped at two concurrent password
derivations per isolate. IP and account rate limits are atomic in D1.

Only hashes of random session/invitation tokens are stored. Sessions expire
after seven days and use a Secure, HttpOnly, SameSite=Lax, __Host- cookie.
Password reset revokes existing sessions; disabling access revokes sessions
and invitations. Each protected request checks current account and project
permissions. Writes require same-origin requests; sign-out is POST.

Migration 0016 is additive. PASSWORD_AUTH_ENABLED=true disables the legacy
Cloudflare identity fallback in production. The old Access app and policies
are retained only at `/legacy-access-entry` on the Worker hostname for
configuration rollback; they intercept no platform URLs. Never restore old
Worker auth without also restoring Access settings from the private backup.

Bootstrap owner invitations and Access backups are stored outside Git in
`/workspace/toys-auth-private/`, with restrictive permissions. No passwords,
activation URLs, session tokens or live contact rows belong in this repository.

## CRM

The previous Access interception returned a login page where the embedded CRM
expected JSON. The client now also handles denied/non-JSON responses explicitly
and offers TOYS login without an automatic redirect loop.

CRM defaults to a six-stage kanban. Each column shows its complete count and
initially loads at most 25 cards, with pagination for the remainder. Search is
server-side. Cards show contacts, source, available budget and owner. Desktop
drag/drop saves through the existing versioned, idempotent CRM API. Keyboard
and mobile users can change the stage in the card. Sales require amount and
currency. Conflicting edits reload the current server state.

The published HOUSEVIP database was checked after release: 105 New and 1 In
progress, 106 total. This release does not enable Make intake or CAPI. Existing
milestone and delivery semantics are preserved.

## Verification and paused work

API coverage includes password setup/replay/expiry/reset, sessions, CSRF,
disabled users, project isolation, owner permissions, kanban counts/pagination,
escaped search and sale validation. Browser checks cover activation, login,
logout, private CRM, permissions, drag/drop persistence, sale validation,
mobile overflow and cached Home/CRM navigation. Password setup and sign-in also
passed in workerd with a real Miniflare D1 binding. Cloudflare API readback
confirmed the active version, password flag, Access destinations and lead count.
Direct live-host browser access is unavailable in the execution environment.

The seven-project import rollout is paused at the user's request. Its Meta
integrations are pending and the onboarding configuration is checkpointed
separately in commit 49c0953. Existing Cloud Run and PROFKIT Sheets are untouched.
