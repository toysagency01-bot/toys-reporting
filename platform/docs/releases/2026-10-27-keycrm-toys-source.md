# VISA CRM qualifications: exact utm_source=toys cohort

The KeyCRM account contains leads from multiple agencies. VISA's qualification
summary now counts only cards with the exact top-level `utm_source` value `toys`.
This criterion applies to CRM qualifications; advertising result selection keeps
its separate source. Missing tags, other values, `TOYS`, and `toys ` are excluded.

The read-only adapter normalizes only the approved literal `toys` or NULL; no
other source values, contacts or raw payloads are stored. A scan still verifies
all pages of the approved qualification stages, so provider pagination totals
remain meaningful. Filtering is enforced in the durable summary and pure total
calculator after deduplication by external card ID.

Migration `0036_keycrm_source.sql` adds the marker and scan verification stamps.
Legacy rows default to unknown, and unfiltered generations are unavailable until
a complete source-verified generation is published. A legacy in-progress scan
restarts rather than mixing pages with unknown sources. Previously observed
absent cards count only when their source was already verified; unknown legacy
milestones cannot inflate the filtered result. Observed source changes are
reflected in later scans.

The Worker and project configuration record `utm_source=toys`. The dashboard
shows `Источник: toys`; VISA's CRM browser cache key was revised to prevent reuse
of earlier unfiltered totals. Intake dates, timezone, approved status IDs and
first-observed milestone deduplication retain their existing meaning.

## Live validation, 27 October 2026

The complete scan published at **07:47:45 UTC / 11:47:45 Tbilisi**:

| Scope | Qualified cards |
| --- | ---: |
| All cards scanned in the approved statuses | 326 |
| Exact `utm_source=toys`, all received dates | 5 |
| Exact `utm_source=toys`, received 20–26 October | 5 |
| Exact `utm_source=toys`, received 1–27 October | 5 |

The source stamp is `utm_source=toys`, synchronization is `ready`, and the error
is NULL. SELECT-only readback through the actual dashboard summary code confirmed
both reporting periods and freshness. The 321 cards without an exact match do
not contribute. Earlier unfiltered qualification totals are superseded.

289 recovery tests passed, including exact/missing/foreign markers, migration of
legacy generations, old absent cards, observed source changes, partial-scan
restart, and safe publication. The unified build and whitespace checks passed.

Active Worker: `2ddcbbb5-630b-48f4-8ff4-1e056af138b1` (100%). Prior Worker:
`63c2eaa6-1657-49d7-aa55-3db86fd6d1cd`.

Operational commands from `platform`, after deploying the filter-aware Worker:

```sh
python scripts/rollout-keycrm.py schema
python scripts/rollout-keycrm.py filter-toys
python scripts/rollout-keycrm.py status
node scripts/verify-keycrm-readback.mjs
```

Apply the additive schema before deploying the new Worker. `filter-toys` records
the criterion with compare-and-swap and requests a complete rescan; it does not
replace an active lease. Historical status coverage remains observed-only.
