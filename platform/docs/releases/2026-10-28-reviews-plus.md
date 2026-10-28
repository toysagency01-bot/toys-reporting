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
