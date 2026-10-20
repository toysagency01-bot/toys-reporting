# Private NOVA sales demo — 2026-10-20

URL: https://reports.toys-agency.com/nova-sales-demo/
Project: `prj_nova_sales_demo`, NOVA Business Services · DEMO.
Source package supplied by the user: `TOYS_Sales_Demo_2026-10-20.zip`.
Implementation commit: `4bfb723` on `codex/unified-dashboard`.

Worker `toys-agency-platform-staging`, active at 100%:
`fb3add46-6cb0-46b8-8da8-c3bb3ed91b4b`.
Previous Worker: `942c716c-13ad-42b7-8f06-7e5a2c5abf9f`.
Pages gateway: `2cb3c127-4941-4c28-898d-225aed0666a0`.

## Access and isolation

The shared registry marks the project `adminOnly: true` and `synthetic: true`.
The Worker enforces this before project handlers, including otherwise-public
published report reads. Shared authorization also enforces it before public
allowlists. Team/client grants cannot override the role restriction. The demo is
excluded from client/team project lists and from the access assignment selector.

The hosted project was imported as draft, reconciled, then activated only after
the private Worker was serving all traffic. It is present only in private
view/editor bindings; public view/material bindings do not contain its slug.
No memberships or integrations were created. CRM access mode is admin; CAPI is
disabled, CAPI kinds are empty, and there are zero delivery jobs.

Synthetic results are excluded from aggregate agency totals unless explicitly
selected, and excluded from review generation, historical review responses and
Telegram. The dashboard displays the synthetic-data notice and its fixed sample
period, with demo qualification/sale cost and CRM ROAS cards.

## Data validation

Period: 2026-08-01 through 2026-10-19 (Tbilisi).

- 400 campaign-day observations; EUR 24,100 spend.
- 1,416 fictional contacts, 822 qualifications, 203 sales, EUR 313,930 revenue.
- 6 published reports and 9 project tabs.
- 0 memberships, integrations or delivery jobs; CAPI disabled.

The reviewed generator validates schema relations, financial reconciliation and
idempotent SQL replay locally. `scripts/import-sales-demo.py --apply` uses only
insert-ignore statements for the synthetic dataset and keeps new projects draft.
It imports in bounded D1 batches and verifies exact hosted counts and sums. Counts,
statuses and project identities for the 16 pre-existing projects matched the saved
pre-import baseline after import.

## QA

- 192 unified tests passed, including privacy checks for team, client, anonymous
  visitors, explicitly assigned unauthorized users and mistaken public allowlists.
- Desktop 1440 px and mobile 390 px: dashboard totals, published reports, project
  content, CRM board, search, lead card, no page errors or horizontal page overflow.
- Browser checks also confirm exclusion from agency aggregate sums and denial of
  team/client HTML navigation. Shared Pages route/bundle tests passed.
- Hosted readback confirmed active versions, Pages registry, private-only bindings,
  active project, CRM admin mode, zero memberships/integrations/deliveries.
- Direct hosted-site navigation from this execution shell is unavailable under its
  network policy; browser QA exercised the built Worker through the same Pages
  gateway locally. Hosted configuration/data were checked via Cloudflare API.

## Rollback

First set only this synthetic project to draft. The old Worker does not know the
administrator-only registry flag, so do not roll it back while leaving the demo
active. If necessary restore the previous Worker and Pages gateway together.
Preserve the inserted demo records; never delete real project data to roll back.
