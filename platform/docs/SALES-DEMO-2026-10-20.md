# Sales showroom — NOVA Business Services · DEMO

Prepared locally on 20 October 2026. **Not imported or deployed to the hosted platform.**
The existing Cloudflare API credential belongs to the other chat's cloud
environment and is unavailable to this local session. No real client data was read
to construct this dataset; no hosted database or advertising account was changed.

## Dataset

- Period: 1 August–19 October 2026, Asia/Tbilisi; October is partial.
- Five synthetic campaigns in Meta and Google, 400 campaign-day observations.
- 1,416 fictitious contacts at `example.test`, 822 qualifications, 203 sales.
- EUR 24,100 advertising cost; EUR 313,930 CRM revenue.
- CPQL EUR 29.32; advertising cost per sale EUR 118.72; revenue/spend 13.03×.
- Six published demonstration reports, split by channel, plus nine project tabs.
- Every sale has a lead, qualification/sale milestone, current amount and history.
- All contacts, businesses and results are explicitly marked as fictional.

These metrics are a demonstration scenario, not TOYS performance evidence or a
promise. Revenue/spend is not profit; other operating costs are not modelled.
No external integration, Meta account, Pixel or CAPI delivery job is created.
The demo is excluded from morning reviews and from aggregate agency financial
totals unless explicitly selected. Access remains private and project scoped.

## Reproduce and inspect

Run from `platform/` with the existing repository's Node dependencies installed:

```sh
python3 scripts/build-sales-demo.py
npm run unified:build
node --test recovery-tests/sales-demo.test.mjs recovery-tests/daily-review.test.mjs
node scripts/preview-sales-demo.mjs
```

Local preview: `http://127.0.0.1:4175/nova-sales-demo/`.
The preview uses an isolated in-memory database and synthetic local test
credentials; it does not accept or reuse real platform credentials.

Generated files: `dist/sales-demo/import.sql` and `manifest.json`.
The generator applies its SQL twice against the current schema, checks foreign
keys and exact financial totals, and refuses a project-name/ID collision with
non-demo data. It does not contact Cloudflare or import automatically.

## Hosted activation still required

1. Make the existing `CLOUDFLARE_API_TOKEN` available securely to this session.
   Do not place it in source, the generated archive, a URL or a chat message.
2. Read the active Worker/settings and D1 schema, and save recovery material.
   The current hosted platform uses `toys-agency-platform-staging` and D1
   `0539d3d9-844e-470e-af6e-ae256fe4c81f`, as recorded in the existing rollout
   scripts. Verify current bindings before writing; do not use the original
   production database from `wrangler.jsonc` or the fake local MVP database.
3. Import only the new `prj_nova_sales_demo` dataset. Keep CAPI disabled and no
   integrations attached. Reconcile the manifest after any partial import before
   resuming; do not overwrite existing records or client memberships.
4. Deploy the project registry in Pages and the built Worker. The existing
   release tooling verifies that Pages knows each registered project. Enable the
   project only in the private view/editor allowlists; do not publish it or grant
   new access to real client projects.
5. Verify the hosted dashboard, CRM card, six reports, nine project tabs,
   date changes, mobile layout, access controls and exclusion from client reviews.

Local verification completed: schema replay/financial reconciliation, 30 API and
regression assertions, dashboard display, CRM totals/card history and report list.
