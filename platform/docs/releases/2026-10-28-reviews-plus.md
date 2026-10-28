# Reviews Plus — manual project setup

Created `prj_reviews_plus`, slug `reviews-plus`, as a private lead-generation
project in preparation (`draft`). Master → Reviews Plus → Карточка и запуск
shows the plan and eleven standard startup checks. The existing Drive folder
`1NYnhLPi-PtDsWbCVZfHATcI2jhwxvNDq` was reused; no duplicate or sharing changes.

Read only `План работы (Meta)` (gid 1573751154) from the user-provided project
spreadsheet `10_g5YlT2xDbpE1Bx-QX6FKT7Bl7tUZ2L2HX0HalD7uM`. Imported 27 tasks
into project_tabs and show them inside the preparation dialog. Dates without a
year are explicitly interpreted as 2026, matching the workbook creation date.
Work starts October 27; cold-traffic launch is planned for November 2. Recurring
and undated tasks keep their original timing. No other workbook tabs imported.

A disabled, project-specific manual source records provenance; it does not
change or enable the Forms intake source. Source links now resolve from each
card's own source record, rather than always opening the shared Forms sheet.
Existing Forms cards keep their original behavior. Plan data is escaped and
scrolls inside the mobile dialog. The table is a snapshot, not live synchronization.

Only the imported plan and folder checks are marked complete in the startup
checklist. The source's brief-complete status is recorded as a statement requiring
verification; the actual brief was not supplied. No advertising integrations,
client invitations, CRM/CAPI delivery, campaign launches or statistics created.
Currency, account timezone, budget, contact, product and geography stay unknown.
Existing project data and concurrent VISA changes were preserved.

Validation: 311 recovery tests passed; seven existing onboarding browser cases
and one new manual-plan mobile case passed. Final text-only adjustments passed
12 relevant unit cases. D1 readback verified type/status, exact plan JSON and
checksum, all eleven checklist entries, profile, folder and absence of ad data
or integrations. Browser checks used synthetic fixtures, not a production login.

Published Worker: `86d53f9c-756a-40de-b6c7-79f9c977f26a` (100%).
Previous Worker: `83c723f2-a774-4df3-97b5-4a9000821605`.
No new standalone dashboard route: this draft is opened through Master.
Private source snapshots and import receipt are outside Git.

## Project chooser correction

The portal session chooser previously filtered out every project missing from
the static dashboard registry, including prepared brief/manual project cards.
It now includes those preparation cards for administrators and assigned staff,
linking to the master project card with an explicit preparation label. Client
and unassigned-staff visibility is unchanged. No public dashboard registration,
role changes, membership changes or source-data mutations were needed.

Twenty-two relevant portal, authorization and onboarding tests passed, including
signed assigned-buyer/unassigned-staff/client chooser checks and exact navigation
links. Production D1 confirms the Reviews Plus preparation marker. Published
Worker: `54aea8ec-9540-45e8-a25a-36803539c689`; previous version:
`86d53f9c-756a-40de-b6c7-79f9c977f26a`.

## Replace preparation popup with the standard dashboard

User requested the normal dashboard and subpages, with the master task popup
removed for now. Reviews Plus now uses the shared project registry and ordinary
private `/reviews-plus/` board. Its existing plan (27 tasks) is preserved in the
normal Meta plan section. Standard Meta weekly/monthly source sections,
competitor analysis, creative brief and strategy, and Google monthly source
section start empty. Template advertising statistics are not imported.

The project is active as a dashboard, with an explicitly unconfigured, zero-row
source generation and no ad observations. Currency/account timezone remain
unknown. The generation storage clock is UTC, without claiming an account
setting. Default dashboard ranges now fall back to the requested source window
when no observed data exists. No source data is fabricated to boot the board.

Master no longer offers or automatically opens the task checklist for any
project. The separate administrator Forms-connection setup remains available.
Existing saved onboarding/brief data is preserved. Master and portal chooser
now link Reviews Plus to its ordinary board, with existing authorization rules.
Private editor/view allowlists add only this slug; public allowlists stay intact.

Validation: all 313 recovery cases passed; browser checks cover ordinary board,
Meta/Google subpages, source-plan date, master dashboard link, disabled popup,
assigned-buyer behavior and independent admin source setup. Production D1
readback confirms seven tabs, active status, unknown ad source and zero facts.

Dashboard rollout: Worker `a8236e02-3c6b-4ffe-9a91-65beefeb170e` at 100%,
previous Worker `54aea8ec-9540-45e8-a25a-36803539c689`. Pages gateway deployment
`4c435f2d` was published from registry commit `7abe400`; full deployment ID is
available through the release verification command. Downloaded Worker module
matches the local tested build. All 27 source-plan tasks remain intact.
Three Reviews Plus browser scenarios and three master-popup/setup scenarios
passed. The server's unauthenticated external HTTP probe received a Cloudflare
HTML 403 before the application route, so no authenticated production browser
session is claimed; route behavior is covered locally and Pages registry/Worker
activation were checked through the control plane.

## Meta-only navigation and complete source materials

Removed Google from this project's channel navigation and advertising selector.
The initial empty Google template tab was removed after checking it contained no
rows; its project channel was disabled and a new published config revision points
only at Meta. Other projects' channel navigation and source sheets are unchanged.

Read all six Meta source tabs through bounded connector ranges. Preserved the
plan and copied the remaining five pages, verifying each original source cell
against reconstructed raw D1 JSON. Source row counts: weekly 0, monthly 15,
competitors 59, creative brief 15, strategy 2. The source contains inherited
Czech/ecommerce strategy and reporting material; these are copied as project
materials only, with zero ad facts imported. The weekly source is actually empty.

The complete raw source remains stored separately from presentation JSON. Monthly
presentation includes a complete header before its original period row so all
columns and narrative notes render. Creative-brief presentation uses its actual
header and sections. Reviews Plus selects these prepared material payloads;
other projects retain their existing raw-payload behavior. A material-revision
cache key replaces previously cached empty page/catalogue responses.

Verified exact source-cell reconstruction after production writes, three project
browser scenarios, relevant unit/cache/gateway cases, and a local browser probe
of the actual D1 material payloads for competitors, creative brief, strategy and
monthly reporting. A synthetic monthly fixture guards against losing later
columns behind a single-cell period title. No authenticated production browser
session is claimed.

Published Worker: `996d31a1-989d-47ce-b179-12b1f13b0020` (100%).
Previous Worker: `a8236e02-3c6b-4ffe-9a91-65beefeb170e`.
Import/verification command: `scripts/import-reviews-plus-materials.py`, with
private connector snapshots and pre-import backup outside Git.

## Remove outdated monthly source content

At the user's request, cleared both presentation and raw content of only
`meta-monthly-source` in Reviews Plus. The tab remains available. Verified empty
payloads by D1 readback and confirmed all five other tab hashes are unchanged.
Bumped the project material cache revision so reloads do not reuse the removed
monthly content. Build and whitespace checks passed; no source spreadsheet,
advertising facts or other project data were changed.

Worker: `cf050f98-4725-4ae7-bcf0-943d386396b9`.
Previous Worker: `4308e327-0424-4281-a50e-2ed5f6b02ffc`.
