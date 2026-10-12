# Dashboard refinements — 2026-10-12

The original board now has no manual refresh control. Browser data refreshes on
open, after a period change, and every 20 minutes while visible; returning to the
page catches up if overdue. Refresh updates the native renderer without reloading
or replacing weekly drafts. Server import cron is `*/20 * * * *`; advertising
hierarchy cache lifetime is 20 minutes, including a check against fetched age for
older cache entries. Failed integrations retain usable data and remain visibly
unavailable; scheduling does not imply every upstream integration is healthy.

The custom date-range dialog supports keyboard navigation, Escape, ordered range
selection, a project-day “Сегодня” preset, and no future dates. Reporting-day
boundary is Asia/Tbilisi for these projects. Metric numbers use Golos Text 600.
Light mode uses `assets/toys-black` (the existing source SVG matching the supplied
black logo), transparent header treatment, and the SVG's brand color #26ddcc.

## Top three creatives

Single-channel projects show the block on Overview. For Karlovarska's two
channels, each block sits within the corresponding original channel container.
Switches select ROAS, sales, leads or qualified leads independently by channel.
Default: Karlovarska ROAS, Profkit sales, Housevip leads.

Only ad-level, period-matching records are ranked. Account/campaign/group totals
are not added to the ad totals. Shared creative references are combined only
within the same integration and currency. ROAS is attributed purchase value /
ad spend in the same account currency. Unknown values remain unknown; ranking
never silently substitutes CTR. Existing generic conversions are not relabeled
as sales or qualified leads.

Meta enrichment reads explicit `lead` and `omni_purchase` action events and
`omni_purchase` action value. Overlapping purchase event types are not summed.
The selected records' previews are read through the existing authenticated Meta
adapter; preview failures cannot discard metrics. The adapter does not invent
missing action events or images. Sales shown in this block are attributed sales
from the advertising account, not the independent business-sales total.
Google's current adapter does not provide the explicit outcome mapping needed
for this ranking; missing Google results are shown as unavailable.

## Prepared CRM formula (not connected)

`native/crm-attribution.js` is wired into the protected hierarchy response. Until
a real source and its coverage are configured, qualified-lead counts are null.
No CRM connector, credentials, fake leads, or remote schema changes were added.

Formula: count distinct CRM leads whose **first qualification event** falls
within the selected dates in the project's timezone, grouped by provider,
advertising account and ad ID. Repeat qualification/status events count once.
A lead first qualified before the period does not become a new qualified lead
when it re-enters that status. Unmatched leads are counted separately, never
assigned to a guessed campaign/creative. Personal lead fields are never queried
or returned to the board by this adapter.

Existing `leads` + `lead_status_events` tables are used. The future connector must
populate status history and this explicit attribution contract in metadata_json:

```json
{"adAttribution":{"version":1,"provider":"meta_ads","accountId":"123","adId":"456"}}
```

After verifying the CRM's actual pipeline/status mapping and full history, set
`CRM_ATTRIBUTION_CONFIG` keyed by project slug with:

```json
{"housevip-cxp7":{"qualifiedStatuses":["Квалифицирован"],"timeZone":"Asia/Tbilisi","completeFrom":"YYYY-MM-DD","throughDate":"YYYY-MM-DD"}}
```

These dates are assertions of complete CRM coverage, not defaults; the connector
must advance throughDate only after a successful complete sync. No count of zero
is emitted for uncovered periods. Internal lead IDs are deduplicated; the importer
must upsert by the schema's unique project/provider/external-lead key. IDs from
other accounts and projects cannot contribute to a creative's count.

## Validation

18 API/model/asset checks and 8 Chromium scenarios, including mounted Pages route,
actual Golos font rendering, 20-minute refresh, calendar/today, light logo, mobile
layout, two-channel placement, ranking switches and retained weekly workflow.
CRM tests cover deduplication, first qualification date, incomplete coverage,
unmatched attribution, account isolation and exclusion of personal identifiers.

## Deployment

Worker `toys-agency-platform-staging`, version
`f85cf5f4-c99d-4cd5-8c17-65847a3d15c9`, 100%.
Bundle SHA256: `bd2c2896fc03363c5d6237224607cfcc5dde4fd07612de8376c45d775a46a55c`.
Previous version: `bcb09d30-a5ac-4741-afa1-7b3144915e5c`.
Cron replaced `15 4 * * *` with `*/20 * * * *`; restoring code alone does not
restore the cron. Existing secrets, bindings, assets and database schema retained.
Authenticated production browser QA remains constrained by the environment's
site-access restriction; local mounted-route tests and deployed bundle readback
are separate checks, not a claim of real-provider end-to-end verification.

## Short public URL correction

The owner reported `/mvp/karlovarska-sul-k4rm/#section=overview&view=account`
still showing the unrelated static commerce shell. The initial refinements only
covered `/api/v2/projects/{slug}/content-project`. Both URLs now render the same
native board, and legacy section/view fragments map to the native navigation.
Release metadata explicitly routes the three supported project paths through the
Worker before static assets; existing assets are retained. Same-path query assets
work through the Pages mount without depending on a new gateway path.

Public short links use the existing public dashboard scope. Anonymous visitors
receive published content only; editor tools and advertising hierarchy requests
remain protected. A validated editor can use the existing tools. The tests cover
public scope rejection, no anonymous revision access, and the exact short-link
shape in Chromium for Karlovarska and Profkit.

Corrected release: `c1606094-4ee6-4f82-8fbf-96a145559b74` (100%).
SHA256: `893881cead8a0d3890f188ccd9379e351a04075d4275438ade50d774c6700973`.
19 API/model/asset checks and 8 Chromium scenarios passed.

## Pages entry-point correction after the unchanged-page report

The Worker-only release above did not correct the owner's Pages URL. The prior
test fixture invoked the Worker directly and missed the static delivery layer.
`pages-hotfix/_worker.js` now rewrites the three supported short project URLs to
`/api/v2/projects/{slug}/board` through the existing STAGING_MVP service binding.
Query assets use the same route. Existing API bindings and authentication remain
in place. Unrelated static GET/HEAD routes use the frozen previous Pages
deployment; credentials are stripped before this fallback request.

Worker version: `fb0823de-32a3-4ce7-88ba-fc3929345911`.
Worker bundle SHA256: `f1c2db3956edd308d192a6b541d59dceb1500c25442633693f53cd4d9e01191f`.
Pages production: `96dd2411-b276-4582-b0a7-e977ba453123`.
Cloudflare API confirmed success, the reports.toys-agency.com alias, and both
unchanged service bindings. Previous Pages deployment (rollback/static fallback):
`3c1b0ab9-f432-4134-83a6-5b0c89ecf421`. Previous Worker version:
`c1606094-4ee6-4f82-8fbf-96a145559b74`.

21 model/API/routing checks and 8 Chromium scenarios passed. Browser fixtures now
include the actual Pages wrapper and simulate an assets-first upstream that
returns the old HTML for non-API paths. Live-site visual verification remains
blocked by this environment's network policy; deployment confirmation is not a
claim of live browser verification.

To reproduce the Pages release, copy `pages-hotfix/_worker.js` to
`dist/pages-hotfix/_worker.js`, then run `wrangler pages deploy --project-name
toys-agency-dashboard --branch main --commit-dirty=true` from `pages-hotfix/` with
the configured Cloudflare account. Preserve the frozen fallback deployment.
The older generic `pages:deploy` command builds a different site and must not be
used to redeploy this hotfix.
