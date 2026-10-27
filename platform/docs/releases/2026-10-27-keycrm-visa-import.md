# VISA Agency: KeyCRM autoimport and dashboard qualifications

The VISA dashboard now reads qualifications from KeyCRM through its existing
Worker and encrypted `KEYCRM_VISA_API_TOKEN` binding. The connector is enabled;
its first scheduled scan published 326 distinct cards on 27 October 2026 at
06:51:48 UTC (10:51:48 Tbilisi). The scan completed without an error.

## Verified mapping and behavior

The live API identifies pipeline `1`, with `Прогріти` = `31`, `Жовтий` = `29`,
and `Зелені` = `28`. The user approved the real spelling `Прогріти`, replacing
the originally supplied `Прогріті`. Names come from the API's `title` field.
Cloudflare requires manual redirect handling; unsupported `redirect: error`
was replaced and tested in the actual Cloudflare runtime.

The existing scheduler discovers the unique pipeline, requests the approved
statuses with verified filters and ordered pagination, and publishes a complete
contact-free generation. It checkpoints pages, fences concurrent work with a
lease, backs off on failure, and retains the last good generation. Requests are
spaced below KeyCRM's 20/minute limit. Completed scans are due again after ten
minutes; unfinished scans resume on later two-minute ticks.

One external card contributes one first-observed qualification. Its intake date
is interpreted in `Europe/Warsaw`; movements among the stages do not create
duplicates. Previously observed qualifications survive absence from later scans.

VISA uses KeyCRM as its exclusive qualification source. Native historical
contacts are not added. Dashboard/master summaries expose coverage and freshness;
the dashboard displays qualification-only cards. Unverified ad attribution stays
unavailable, including when older native attribution configuration is present.
Cached native ad-level values are removed instead of publishing false zeros.
Sales/revenue and provider-filtered qualifications remain unavailable.

## Live readback

SELECT-only verification used the final dashboard summary code against the
published working D1 generation, recomputing intake dates in Europe/Warsaw:

| Intake period | Observed qualified cards |
| --- | ---: |
| 19–25 October 2026 | 56 |
| 1–27 October 2026 | 159 |
| All published intake dates | 326 |

The 34 native contacts and zero native milestones were preserved. No CAPI jobs
exist for this project. KeyCRM records contain no names, phones, emails, UTM
payloads, or raw responses. The Worker secret was never extracted.

Historical coverage remains `observed_only`: cards that qualified and left these
stages before the first scan are not reconstructed. Ad-level source mapping is
unverified, so all qualifications are explicitly unmatched. The selected Meta
advertising conversion metric remains separate.

The unauthenticated production dashboard API returned HTTP 403; no login was
created or authorization bypass added. Live readback verified persistence and
the dashboard calculation, not an authenticated browser session.

## Release and validation

- Active Worker: `8a5f8e33-fa45-49de-bed3-d3ba7613af77` (100%).
- Prior original Worker before this task: `b47756c4-3648-4c57-adb4-2e19fc55bf75`.
- Migration: `0035_keycrm.sql`; only `keycrm_sync` and `keycrm_cards` were added.
- Full recovery suite: 272 tests passed, zero failed, after generating the local
  synthetic sales-demo fixture (never applied remotely).
- Final attribution precedence/cleanup changes: 25 relevant tests passed.
- `npm run unified:build` and `git diff --check` passed.
- `node scripts/verify-keycrm-readback.mjs` passed against working D1, read-only.

Operations and pause/activation commands are documented in
[`KEYCRM-OPERATIONS.md`](../../crm/KEYCRM-OPERATIONS.md).
