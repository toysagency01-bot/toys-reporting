# Google Ads reporting delivery — 2026-10-12

Prepared from the owner-supplied Cloud Run source archive, not a replacement
service. The existing service contains Google Ads account/campaign reads but no
daily hierarchy producer or delivery to the platform's authenticated receiver.

## Changes

- `reporting.py`: date-segmented campaign, ad-group and ad queries via the existing
  Google Ads client and runtime service identity. No campaign mutations. Includes
  removed entities with historical delivery. Reads all searchStream chunks,
  preserves decimal strings and micros, rejects malformed/partial data.
- Delivers the existing `toys-google-ads-readonly-hierarchy/1` contract in 200-row
  pages with deterministic snapshot IDs, bounded retries and verified final
  acknowledgements. Business conversions remain generic conversions, not inferred
  leads/sales. This does not implement PMax asset-group creative reporting.
- `server.patch`: adds only `/scheduled/google-reporting`. Existing scheduled-secret
  authentication is retained for installation checks; Scheduler uses a Google-signed
  OIDC token for this service and the exact allowlisted runtime account. Issuer,
  signature, audience and expiry are verified by google-auth. The audience is the
  service base URL, matching native Cloud Run IAM validation.
- Regular delivery covers the latest 90 days, including Today in each customer's
  timezone, every 20 minutes. First installation backfills 2026 in monthly windows.
  Customer allowlist matches the existing receiver: Karlovarska 2662445825 and
  AM Klinika 9632942627, MCC 7753894623, Google Ads v25.

## Installation behavior

Run `python3 install.py` from this package in the owner's Cloud Shell. It checks
that the service image and identity still match the supplied archive, downloads
that exact GCS object generation into a private directory under the user's home,
checks its SHA256, applies the patch and adds the producer. Existing credentials
are read only inside Cloud Shell; no credential values are logged or packaged.

A source deployment creates a tagged candidate with no primary traffic. The
candidate must deliver accepted snapshots for both customers before promotion.
Existing environment variables, secret bindings and other service endpoints are
preserved. The request timeout is raised to 900 seconds for the initial backfill.
The script grants the existing runtime identity `roles/run.invoker` on this service
and creates/updates only `toys-google-reporting`, using OIDC rather than a secret
in Scheduler configuration. Another endpoint under that job name is not overwritten.

A rollback file records the original traffic split and a command to pause the new
job. Runtime timeout/IAM changes are not reverted by traffic rollback. Installation
stops on failure; failures before promotion leave existing primary traffic intact.
A failure after promotion can leave the validated candidate active with incomplete
scheduling/backfill; the STOP message must not be interpreted as completed rollout.
Reruns against a changed service image intentionally stop for review.

## Validation and limits

65 Python service tests passed, including 19 producer/auth/contract tests; 3 installer
simulation tests passed. The real platform JS validator accepted both a multi-page
synthetic hierarchy and an empty snapshot. The patch applies cleanly to the exact
uploaded source archive. No live Google credentials were available in the agent
workspace, so deployment, Google Ads account permissions, production delivery and
Scheduler execution remain unverified until the owner runs the installer.

The platform receiver also refreshes the checked timestamp on a verified final
page replay, so unchanged metrics do not become stale after 20 minutes. It reuses
the accepted snapshot instead of duplicating historical rows. 29 platform
API/model tests pass, including unchanged replay and conflicting replay checks. Original source archives, existing secrets and campaign plans are
not included in the package or committed with it.
