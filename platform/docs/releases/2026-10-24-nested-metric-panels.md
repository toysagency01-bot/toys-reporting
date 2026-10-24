# Nested dashboard metric panels — 2026-10-24

Dashboard metrics are grouped in rounded panels by funnel stage. Each panel contains up to four smaller rounded metric cards in a 2×2 grid. Statistic-label icons are hidden, including icons inserted during data refreshes. Existing metric nodes, values, native light/dark colors and source distinctions are preserved. Responsive layouts stack panels on phones without clipping values.

Implementation: `7991b16`, finalized by `9d564b2`. The subsequent user instruction to remove icons supersedes the pending website-based icon revision.

## Validation

- Grouped implementation: 232 automated checks and 83 browser scenarios passed across core flows, navigation, roles, campaign controls, monthly reporting and metric layouts.
- Final nested-card/no-icon revision: build, JavaScript syntax and whitespace checks passed; 11 browser scenarios passed (four project layouts, five demo scenarios and two CRM cohort scenarios).
- Visually reviewed desktop and phone screenshots, including dark demo panels and light commerce panels. Checked period changes, CRM refreshes, native metric IDs, source separation and the commerce stale-data guard.
- Browser validation used local built fixtures; it was not a live numeric audit.

## Deployment

- Worker: `toys-agency-platform-staging`
- Active version: `43208ee2-fd76-44bd-83cc-6000e0e5cc0d`, confirmed at 100% through the Cloudflare API.
- Bundle SHA256: `8c3fa595eb9f10f81a28ee55e9566ccd38a641f947021075420bbd581b444043`
- Previous version / rollback target: `924634d0-7fba-4950-8c5c-d58a97c4892e`.
- Rejected icon build `379459cb-04eb-472e-acf1-2c7f2fb9a02d` remains inactive.
- No database migration or gateway deployment required.
