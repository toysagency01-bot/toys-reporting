# Readable campaign hierarchy — 2026-10-26

Campaigns, groups and ads previously used similar nested rounded cards, with a separate box around every metric. Long lists made parent relationships hard to follow. Campaign sections now have a teal heading, groups use a subdued blue heading, and ads use compact divided rows. Indentation, level labels and child counts make the hierarchy explicit without relying on color alone. Metrics share aligned columns and no longer have individual frames. Full names wrap, and delivery statuses remain visible as text badges.

On desktop widths of at least 1280px, the metric header, current campaign and current group stay visible during page scrolling. Group placement uses the actual campaign header height, including wrapped names and management controls. Smaller desktop widths retain horizontal table scrolling. Mobile retains drill-in navigation, a full parent summary, compact filters and three-column metrics. The new “Свернуть всё” action resets the displayed hierarchy without another request and returns keyboard focus to search.

Campaign loading, API calculations, authorization and campaign write confirmation retain their existing behavior. The previous bundled-data optimization remains active.

## Validation

- 26 focused campaign-model/API, response-cache and native-asset tests passed. Build, JavaScript syntax and whitespace checks passed.
- 28 browser checks passed: three new hierarchy/alignment/scroll/mobile checks, nine existing campaign-loading checks, eight campaign-control/audit checks and eight relevant design/project/demo checks.
- Reviewed dense eight-campaign fixture screenshots in dark/light themes, scrolled desktop context and mobile. Verified metric-column alignment, distinct level backgrounds, compact rows, sticky group position, collapse behavior and unchanged one-request browsing. Existing project tests include commerce metrics, other project dashboards and private demo CRM refresh.
- Screenshots use synthetic Chromium fixtures; no authenticated production browser or physical Safari verification.

## Deployment

- Active Worker `toys-agency-platform-staging`, 100%: `1f24d571-8387-42b3-a2a2-5a69a36b156e`.
- Rollback: `bfa34cf3-adea-43d1-8e5c-50693f037e48`.
- Downloaded deployed Worker matches the tested bundle, SHA-256 `f6c9c9f2496ad91bd972eaaee95b185234c20f9fd50f4e1d76bb66ad30f0fcdc`.
- All 27 binding names/types, compatibility settings and both existing schedules preserved. Pages deployment remains `2cb3c127-4941-4c28-898d-225aed0666a0`. No database or configuration changes.
- Ignored evidence: `dist/campaign-ux-release-before.json`, `dist/campaign-ux-release-verified.json`, `dist/campaign-ux-*.png`.
