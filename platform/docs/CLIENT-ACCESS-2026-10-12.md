# Client entry and accounts — 12 October 2026

The branded entry page is
[TOYS login](https://reports.toys-agency.com/mvp/api/v2/portal/login).
It uses the existing TOYS logo, bundled Golos Text and turquoise accent. The owner
requested removing the English platform label, eyebrow, three feature columns and
first-time-user explanation; headings and body copy were enlarged accordingly.
The entry page is server-rendered, contains no JavaScript and makes no external
font or image requests. Email verification is a separate Cloudflare Access step.

## Account workflow

1. Open [Master → Access](https://reports.toys-agency.com/mvp/api/v2/master/view#access).
2. Add a client's name and email; select one or more available platform projects.
3. Save, copy the invitation and send it through the team's usual channel. The
   application does not claim to send an invitation email automatically.
4. The client follows the common login link and confirms their own email with an
   OTP. First entry changes their existing invited account to active. Unknown
   emails are not registered automatically and receive no private project access.
5. One assigned project opens directly. Multiple projects produce a project
   picker. Agency masters open the master dashboard.
6. Edit assignments or disable the account from the same Access screen. Every
   protected request checks current D1 membership, so existing identity sessions
   do not bypass a revoked grant. Previously downloaded content cannot be recalled.

Client permissions cover assigned CRM leads, published reports, project materials,
comments and creative review. Clients cannot upload agency creatives, edit report
revisions, manage integration credentials, grant access or open the master API.
Client weekly views now render the published report without asking for the agency
revision editor. Existing public reporting links remain public read-only reports.

Available platform projects: HOUSEVIP (`housevip-cxp7`), Karlovarska Sul
(`karlovarska-sul-k4rm`) and PROFKIT (`profkit-instashop-r4vk`). Other projects are
not silently published. Client roles cannot be used to grant agency roles.

## Identity and authorization

Cloudflare Access establishes email ownership. RS256 signature, issuer, audience
and expiry are verified server-side, including cookies on public board documents.
The Worker independently enforces project memberships for the verified identity.
Master eligibility still requires both agency and master email configuration.
New access writes enforce same-origin JSON, an idempotency key, optimistic version
checks and an atomic D1 claim covering memberships, audit and replay receipt.

The proposed client Access policy allows an email identity only after OTP, with
all private authorization retained in D1. The automatic approval reviewer rejected
applying this broader identity policy without an explicit scope confirmation.
That confirmation was requested; the broader policy has NOT been applied.
The existing exact-owner policy remains intact. No bypass policy is introduced.

## D1 limit and automatic preparation

The migration request returned Cloudflare error 7500: daily free-tier row writes
exhausted. Read-only verification confirmed the two new user columns and replay
table are absent; production currently has zero user rows. No client accounts,
test contacts or invitation emails were created in production.

Migration 0015 is additive. The deployed existing `*/2 * * * *` scheduled handler
will attempt it after **2026-10-13 00:00 UTC / 04:00 Tbilisi**, with recovery from
partial DDL and repeat-safe checks. Until schema readiness is confirmed, the
Access screen explains the temporary unavailability and disables account creation.
Successful future migration is not claimed as already verified.

Operational commands from `platform/`:

```sh
python scripts/configure-client-access.py schema
# Adds protected entry destinations; preserves all current identity policies:
python scripts/configure-client-access.py entry
# Requires the explicit user approval requested in this chat:
python scripts/configure-client-access.py access
python scripts/configure-client-access.py verify
```

The original Access app/policies are backed up locally in ignored
`dist/client-access-backup.json`. This backup contains configuration, not a new
credential. Do not add private Access configuration to Git.

## Validation and release

46 API/model cases and 24 Chromium scenarios passed across the final relevant
runs. Coverage includes genuine signed synthetic Access tokens, wrong audience,
expired and forged tokens, cross-project/master denial, stale updates, idempotent
creation, revocation with a retained token, quota-deferred setup, mobile layout,
native board parity and the full create/copy/disable UI flow. All test identities
and data remain local. Real OTP email delivery is not verified from this environment.

Worker `6445efdc-ad13-43fa-9a45-e0030d73405e` is active at 100%, with its module
downloaded through Cloudflare API and matched byte for byte to the tested bundle:
`faf6911d16e9db0833322f8d0c2e60da1de4c00e0814ce7de614a232abfcc4d0`.
Rollback Worker: `ba9efebe-f9c7-40f4-9582-be7c97099ae8`.

The common account navigation also updates these published pages:

- [HOUSEVIP](https://reports.toys-agency.com/mvp/housevip-cxp7/)
- [Karlovarska Sul](https://reports.toys-agency.com/mvp/karlovarska-sul-k4rm/)
- [PROFKIT](https://reports.toys-agency.com/mvp/profkit-instashop-r4vk/)

If rolling back the Worker after approving the broader Access policy, first remove
that client identity policy or restore the backed-up Access policies. The old
Worker does not read the new D1 client grants. Keep the additive migration data.
