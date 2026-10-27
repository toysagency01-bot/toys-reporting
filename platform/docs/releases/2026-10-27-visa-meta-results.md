# VISA: count the result selected in each Meta ad set

VISA's integration previously selected only `lead` for every advertising row.
The Ads Manager screenshot for 20–26 October instead shows several result types,
including 13 `invitee_meeting_scheduled` results in the GB consultation campaign.
The old importer returned zero when the selected result was a custom conversion.

`imports/meta-results.js` resolves the current promoted object for each observed
ad set, then selects its exact custom-conversion action ID or named standard
event. Alternate action names are fallbacks for the same event, never an additive
list. Generic lead, meeting, purchase and messaging events are not summed together
inside one ad set. Custom-conversion names are read from Meta for traceability;
the ad-set account is checked against the integration account. A shared custom
conversion is accepted only through that verified ad set's exact promoted-object
reference; its owner does not need to be the advertising account.
Metadata reads are bounded to three concurrent object requests and use the
existing fixed Graph API host, read-only credentials, redirect blocking and import
deadline. Missing identities, wrong accounts or unresolved custom events fail
the import and preserve the last successful snapshot.

Named custom pixel events require the separate Insights `conversions` field.
The importer and independent report now request it and select a named event from
`conversions` or its exact `actions` alias once. A generic custom-event bucket is
never used as a substitute for `invitee_meeting_scheduled`.

VISA alone enables `resultMode: adset_optimization`, with mapping revision
`meta-adset-results-v2`. Other projects retain their existing mappings. Standard
lead outcomes remain separate from generic advertising results and KeyCRM
qualifications. No advertisements, budgets, CRM records or CAPI events are changed.

For this mode, the independent arithmetic check requests ad-set-level daily
insights and applies the same verified event selection to each ad set. Financial
metrics and impressions retain their independent account-level report, so
group-level aggregation differences do not replace that existing account check.
Both are compared against ad-level rows for every completed local day. The durable
audit records `comparisonLevel: adset` and the event IDs/names selected for each
group, without storing credentials or raw provider errors. Existing account-level
reconciliation remains the default for other projects.

An explicit `refreshRequestedAt` in an integration permits its requested reimport
on a two-minute scheduler tick. Other projects still import only at their usual
slots. Requests are selected by integration, fenced by the existing lease and
consumed by a later attempt's start timestamp, so a request submitted during an
older in-flight import cannot be lost. Failure retries retain the normal
slot cadence. The one-time VISA request refreshes its rolling 30-day window.
VISA requests that window one local day at a time, with bounded concurrency and
independent retries for discrepant completed days, because a multi-day API reply
omitted spend and impressions on 26 October during live verification.

VISA summary, top-creative and campaign-browser URLs now include the new custom
event cache key. Earlier lead-only responses in browser storage are therefore
not reused after reloading the dashboard. Other projects keep their cache keys.

## Operations

After deploying through `scripts/release-unified.py`:

```sh
python scripts/configure-visa-meta-results.py status
python scripts/configure-visa-meta-results.py apply
node scripts/verify-visa-meta-results.mjs
```

The configuration script updates only the expected VISA integration/account and
prints selected mapping/status fields. The readback script uses SELECT-only D1
access, the actual snapshot reader and the dashboard advertising model. It checks
the screenshot's campaign/period, the exact meeting result, current period
freshness, and independent reconciliation for every requested day. It reports
unverified dates elsewhere in the rolling import separately. It creates no login
or authorization bypass.

## Validation

The recovery suite passed 285 tests. Focused tests cover custom results alongside
standard leads, duplicate aliases, wrong account metadata, missing custom events,
duplicate audit rows, scoped one-time refreshes, and the real Cloudflare runtime.
Builds and whitespace checks passed. Live readback results are recorded below.

## Live readback and remaining provider discrepancy

For 20–26 October 2026, the GB consultation campaign
`120248991944630056` now has **13** `invitee_meeting_scheduled` results.
Its daily counts are 2, 2, 0, 4, 0, 3, 2. All seven requested days pass independent
conversion and account financial checks. The database snapshot reader and
dashboard advertising model return the same 13; no value was patched manually.
The full account result count for this range is 54, including messaging results;
these are advertising outcomes, not unique CRM leads or KeyCRM qualifications.

The rolling 30-day import still has a provider discrepancy on **14 October**:
the independent report has one more impression and PLN 0.02 more spend than the
ad-level reply, including after daily retries. That day retains its last good
snapshot, and the importer retries at the next normal slot. No missing ad row,
spend or conversion was fabricated to force agreement. The global import warning
is retained. Independently verified requested periods such as 20–26 October are
shown as fresh; missing, outdated or failed audit evidence remains stale.

The original Worker before this correction was
`8a5f8e33-fa45-49de-bed3-d3ba7613af77`. Final active Worker:
`63c2eaa6-1657-49d7-aa55-3db86fd6d1cd` (100%).
