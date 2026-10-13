# CRM templates by niche and lead deletion

The project CRM now obtains its stages, ordering, colors and conversion meaning
from the shared catalog in `crm/pipelines.js`. No client component assumes six
stages or the literal sale label Продажа. `projects.settings_json.industry` selects
the niche; `crmTemplate` can explicitly override the template. Unconfigured
projects retain the general six-stage funnel.

HOUSEVIP uses `real_estate`, with the exact requested order:
Новый; Не удалось связаться; Связались; Квалифицирован; Подбор объекта;
Просмотр назначен; Просмотр проведён; Переговоры; Бронь / задаток; Сделка;
Отказ; Отложен; Неактуален.

Current statuses Квалифицирован through Бронь / задаток count as qualified.
Only Сделка counts as a sale and requires an amount and currency. Conversion
milestones and delivery IDs remain unique per lead and kind, so passing through
several qualified stages does not emit repeated qualification events.

Existing labels have explicit compatibility mappings at the API/query boundary:
В работе → Связались; Продажа → Сделка; Не подходит → Отказ; Потерян → Неактуален.
These mappings apply consistently to grouping, filters, pagination, returned
cards and revenue. Switching HOUSEVIP's niche does not rewrite lead rows, contact
data, versions or status history and does not enqueue historical conversions.

## Future property projects

Assign `industry: real_estate` when provisioning a real-estate project. The same
template works for any project ID; it is not selected by the HOUSEVIP slug.
Use `python scripts/configure-crm-industry.py PROJECT_SLUG real_estate` to preview,
then append `--apply`. It checks every existing stage has a mapping, preserves
unrelated settings, uses compare-and-swap for the settings write, and saves a
private settings backup outside Git. It also updates legacy `leadStatuses`.
Add future niches to the shared catalog with explicit qualification/sale meanings.

## Deletion

The kanban has a visible trash icon on each editable card, and the lead editor
has an Удалить лида button. Both use the same branded confirmation dialog and
versioned, idempotent, project-scoped DELETE API. Cancelling changes nothing.
After success, the lead disappears immediately and cached CRM/summary views are
invalidated. A concurrent edit causes a conflict rather than an unnoticed delete.

Migration 0019 adds `leads.deleted_at` and the active CRM index. Deletion is a
tombstone: source identity and history remain in D1 to prevent provider retries
from recreating the same lead. This is removal from the working CRM, not a hard
personal-data erasure feature. Deleted leads are excluded from board counts,
pagination, search, CRM summaries, ad attribution, agency totals and legacy lead
reads. Detail reads and edits return 404. A deletion audit records actor/time.
The transaction blocks pending CAPI jobs; the delivery worker also checks the
tombstone before dispatch. Already sent or in-flight Meta events cannot be recalled.
Repeated incoming messages do not append to a deleted lead.

## Verification and release

82 recovery checks and nine Chromium scenarios passed. Coverage includes all
13 stages, a different future property project, old-label compatibility, sale
validation, qualified stage progression, deduplicated conversion events, deletion
from both entry points, cancellation, mobile layout, summary updates, replay,
concurrent version conflicts, protected routes and tenant boundaries. General CRM,
30-card columns, cached Home/CRM navigation and native login also passed. All
test contacts and deletions were local; no live lead was deleted for testing.

Worker: `cbde50c0-b740-4fce-a92a-72a4f0319c11`.
Previous Worker: `983e5bb5-6f75-4169-b921-73826217040b`.
Migration 0019 is additive and must precede publication. Apply the HOUSEVIP
template after deploying the new Worker. Other projects' settings, imports,
Cloud Run, PROFKIT Sheets, Make and CAPI activation are unchanged.

Rollback warning: the old Worker ignores tombstones and real-estate stages.
Prefer a forward fix. Before any rollback, account for leads deleted or moved
after this release; never blindly restore an old snapshot of their state.
Published code/configuration are verified through Cloudflare's API. Direct live
browser access to reports.toys-agency.com is unavailable in this environment.
