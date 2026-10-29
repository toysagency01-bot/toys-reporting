# TYVER product analytics

Private dashboard: `/project-tyver/`. Requested Meta account: `762053572501853`.

The normal dashboard retains Campaigns, Funnel, Summaries and Project pages.
The product profile replaces Overview with spend, impressions, clicks, landing
page views, leads, registrations, trials, purchases, purchase value, costs,
click-to-registration, registration-to-trial, click-to-trial and ROAS. Campaign
and landing tables and the funnel use the same selected dimensions and dates.
The standard project setup can also select this analytics profile.

Dimensions use available source evidence:

- Language comes from explicit en/eng, ru/rus, uk/ukr tokens in campaign names.
- Campaign GEO uses explicit EU/CIS tokens, otherwise the ad set's targeting
  country set. It is NOT a country breakdown of delivered impressions/spend.
- Landing uses the creative URL (query parameters and fragments are stripped).
  quiz/warp tokens in ad names are a fallback only if no URL is available.
  Dynamic creatives with several URLs remain in a separate multiple-URL group.
- Unknown values remain in totals and have a visible filter option. Several
  account currencies are never added together. Dates use the account timezone.

Product clicks use the `link_click` action, matching the reference report; they
are separate from the generic dashboard all-clicks metric.

All event counts come from Meta Insights, with one alternative action key chosen
per event. CompleteRegistration and the observed TYVER custom pixel event `Trial` are
supported, with standard StartTrial alternatives. The Trial campaign selector
can reproduce the three named Trial campaigns in the supplied report. If no matching event is observed in the imported window, that metric
remains unknown, rather than claiming a zero for an unverified custom event.
Safe observed action-type identifiers are retained for scoped diagnostics;
credentials, provider error bodies and URL query strings are not returned.

Costs and percentages are calculated from totals. A zero denominator yields an
unknown ratio. Ad-attributed event counts are not a cohort of unique people;
registrations may exceed leads. No screenshot figures are imported as live data.
Historical landing and targeting labels use metadata available at import time.

## One-time rollout

The project is seeded once using `scripts/configure-tyver-project.py prepare`.
The source is read-only and uses the existing importer. Account metadata must be
verified before source facts are accepted (`verifyAccountMetadata=true`).
`confirm` records verified source metadata and adopts currency/timezone only
before the team's first settings edit. No permanent provisioning cron was added.
Existing disconnects are preserved by the setup script; users/roles, bank data,
secrets, sharing, messages and CAPI events are not changed or sent.

Tests: scoped API access, no-data and invalid-range handling, weighted totals,
simultaneous filters, unknown/ambiguous metadata, cross-account metadata rejection,
event alias deduplication, desktop and 390px mobile rendering.
