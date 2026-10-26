# Faster campaign browsing — 2026-10-26

Opening campaigns previously fetched each expanded campaign, group and ad page separately. The campaign browser now requests a compact presentation dataset once per selected period and uses it for local expansion, pagination, search, sorting and provider filtering. The browser persists that response through its existing authorization-scoped cache. Saved data appears while an expired response refreshes in the background.

The dataset contains presentation fields only, capped at 2,000 rows and approximately 1.5 MB of serialized row data. It includes whole child levels in breadth-first order and explicitly marks complete parents. Missing levels retain the existing paginated API; searches of an incomplete dataset use server results so omitted descendants cannot disappear from search. Historical campaign rows, currencies, account separation and unknown metrics retain their previous meaning. Root history and advertising reads now start in parallel.

Background updates retain expanded levels and the number of rows already displayed. Retries force an actual read; access denial clears displayed campaign data and the existing browser cache. The UI displays the oldest available source update time in Asia/Tbilisi. Creative media loading and campaign write controls retain their existing behavior.

## Validation

- Full automated recovery suite: 258 passed after generating the missing local synthetic sales-demo fixture. Final focused campaign/cache/role/sales checks: 30 passed.
- Browser checks: 9 campaign scenarios, 8 campaign-control/audit scenarios and 6 sales-demo scenarios passed. Coverage includes desktop/mobile, pagination, period changes, cached reload, local search/sort, partial datasets, background refresh, retained rows, retry, revoked access and CRM updates.
- Equivalent browsing fixture: four hierarchy/page requests previously, one with the complete dataset; subsequent local search/sort and cached reload add no hierarchy requests. This is a request-count comparison, not a production wall-clock speed measurement.
- Compact dataset pages were compared with server pagination/search/sort across providers, accounts, currencies and offsets. Build, syntax and whitespace checks passed; desktop/mobile fixture screenshots reviewed.
- Public-host probes from this executor return HTTP 403, including `/login`; no authenticated production browser or production latency measurement was available.

## Deployment

- Active Worker `toys-agency-platform-staging`, 100%: `bfa34cf3-adea-43d1-8e5c-50693f037e48`.
- Rollback: `4a433d43-8372-4704-8a7c-f8d1ba614202`.
- Downloaded deployed Worker matches the tested bundle, SHA-256 `5138de291e8b7e3d88727e78230e24853b6419a3b941fd6a7d3217cf72602a05`.
- All 27 binding names/types, compatibility settings and both existing schedules preserved. Pages deployment remains `2cb3c127-4941-4c28-898d-225aed0666a0`. No database migration or configuration write.
- Ignored verification evidence: `platform/dist/campaign-release-before.json`, `platform/dist/campaign-release-verified.json`.
