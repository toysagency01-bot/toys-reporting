# Clean platform URLs — 12 October 2026

The owner confirmed that the `/mvp` links had not been shared with clients and
authorized removing the prefix. Current published platform addresses are:

- Entry: https://reports.toys-agency.com/login
- Agency: https://reports.toys-agency.com/master/
- HOUSEVIP: https://reports.toys-agency.com/housevip-cxp7/
- Karlovarska Sul: https://reports.toys-agency.com/karlovarska-sul-k4rm/
- PROFKIT Instashop: https://reports.toys-agency.com/profkit-instashop-r4vk/

The other active projects still use their existing GitHub Pages reports. This
release does not publish additional projects or change their data/configuration.

## Routing and access

Pages maps the three root board paths, `/login` and `/master/` to the existing
platform API through its service binding. This deliberately avoids the old static
assets that would otherwise shadow the current board. Root `/api/v2`, `/api/ui`
and `/api/crm` requests reach the same platform. Other existing `/api` routes
retain their previous production binding.

All generated navigation, session redirects, project-picker links, invitation
links and connection instructions use the clean paths. Existing `/mvp/api` calls
remain accepted for Cloud Run/scheduled ingestion already configured elsewhere;
they do not generate client links. The old board aliases also remain accepted.

Before publishing routes, `configure-clean-routes.py apply` mirrored the existing
Cloudflare Access protections onto root paths. Readback confirmed the same
audience, policy IDs and rules. No identity-provider or permission expansion was
part of this release. Project authorization is still checked by the backend.

The previously documented OTP-provider setup and D1 migration remain pending;
see [Client access](CLIENT-ACCESS-2026-10-12.md). Clean URLs do not claim to resolve
those separate account-activation prerequisites.

## Deployment and verification

- Production canonical Pages: `74cb1447-6ab6-4d65-b61b-1b82c6062b10`, status
  `success`, attached to `reports.toys-agency.com`, verified through Cloudflare API.
- Active Worker: `a9ac5985-bdb8-406e-8a34-f0b3b02577f2`, 100% traffic.
- Worker module downloaded from Cloudflare and matched byte for byte to the
  tested bundle; SHA-256:
  `4beb22e9bc50c15dd0f0928c4e3817db924e7065f7f00ed27e057285e0a1e358`.
- 48 API/model cases and 24 Chromium scenarios passed. Browser tests now use the
  actual Pages router for all requests, including clean login, master and boards.
  Tests cover authorization, CRM navigation, query assets, session redirects and
  preservation of POST bodies/credentials for existing ingestion endpoints.
- No production contacts or database writes were needed for the route change.
  Live browser checks are unavailable because the environment permits the
  Cloudflare API but not the report domain; browser verification was local.

Pages was published and confirmed canonical before the new Worker emitted clean
links. Rollback Worker: `6445efdc-ad13-43fa-9a45-e0030d73405e`; previous canonical
Pages: `96dd2411-b276-4582-b0a7-e977ba453123`. If both must be rolled back, roll
back the Worker first. Access backup is local, ignored
`dist/clean-routes-access-before.json`; keep the protections while either clean
route is in use. No database rollback is required.
