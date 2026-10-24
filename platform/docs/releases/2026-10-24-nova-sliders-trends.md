# NOVA sliders, revenue fitting and trends — 2026-10-24

Implementation: `bc360b5`.

The dark upper section selector now follows the user's rounded neutral-glass capsule reference. Glass is reserved for the header; channel, date-preset, chart-mode, project-channel and creative-ranking controls use flat moving indicators. The conclusion action and calendar trigger have plain fills. A shared slider preserves its visible position during interrupted transitions and respects reduced motion. Its duration is 480 ms instead of 720 ms (50% higher traversal speed), including the upper section menu.

NOVA revenue values shorten only when the full amount actually overflows its metric tile and its magnitude is at least 10,000. For example, 146,148.75 € displays as `146,1k €`; the exact native formatted amount remains in the title and accessible label. The full value returns when its tile has enough space. Original metric values/calculations remain untouched.

The metric presentation again retains the native percentage comparisons as separate badges, with turquoise/red result colors and the original inverted cost-direction logic. Badges are absent when the original renderer has no valid comparison; the maximum period does not manufacture a prior-period change. Badges on the turquoise lead surface use contrasting dark backgrounds.

Campaign presentation removes middle-dot separators and the empty history-dot decoration only for NOVA; provider data, names in storage, keys, search and other project interfaces remain unchanged. Funnel rows use distinct slim stage accents and downward connectors, without introducing proportional bars or changing totals/rates.

## Validation

- Final build, syntax and whitespace checks passed.
- All 233 automated recovery checks passed, including boundary/currency/sign tests for revenue shorthand.
- All 18 NOVA/sales-demo/project-layout browser scenarios passed. Added checks cover real overflow using a fixture amount of 146,148.75 €, exact accessible amount retention, restoration of the full value in a wider tile, flat control materials, shared 480 ms transitions, reduced motion, native trend text/classes/colors, maximum-period behavior and absence of campaign middle dots.
- Four additional general campaign browser regressions passed: desktop hierarchy/pagination, mobile breadcrumbs and cached drill-in, pending period reads, and cached searches. Total: 22 browser scenarios.
- Existing checks retain both themes, 13 overview widths, selected-tab visibility, native filters/calendar, new-tab navigation, CRM round trips, qualification updates and administrator-only demo access. Four other project fixtures retain their previous styling.
- Visually reviewed the reference-style dark capsule, flat lower selectors, stage-accented funnel and light-theme comparison badges. Browser tests used local Chromium fixtures and viewport/touch emulation, not physical Safari or an authenticated live browser.

## Deployment

- Worker `toys-agency-platform-staging`, active at 100%: `1a414486-91c4-442e-a5ac-c778298add90`.
- Rollback version: `6f2541e0-e863-40f3-8172-7ff3ccb8abcd`.
- Downloaded deployed bundle matches the tested build: SHA-256 `c81f171cafa04fd92b252bc645213fe62ed152c0e7a10c0398fe1f6189b7d717`.
- All 24 bindings and compatibility settings match the pre-release snapshot. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and project registry are unchanged. No database, import, scheduling or access changes.
