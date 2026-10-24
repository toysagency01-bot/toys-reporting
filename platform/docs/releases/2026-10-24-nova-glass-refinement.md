# NOVA glass and block refinement — 2026-10-24

Implementation: `26e4a31` (overview), then `34a2459` (remaining blocks and mobile visibility).

The NOVA overview now uses a neutral near-black background, quieter translucent metric cushions and untinted glossy navigation glass in both themes. The active glass surface slides for 720 ms and continues from its current rendered position when interrupted by another tab click; reduced-motion preferences still disable movement. The original branded Meta/Google channel buttons and period presets replace the plain select adapters. The existing date dialog remains connected to the native calendar, with consistent SVG calendar/chevron decoration. The main conclusion is emphasized between the KPI groups and chart.

After completing and checking the overview, the same surface, border, typography and button treatment was applied to the daily-chart controls, period summary, creative panels, campaign metrics, sales-funnel rows/outcomes, report cards/forms and project materials. Texts, metrics, data requests and calculations remain unchanged. Light-theme primary actions retain readable contrasting text.

A shared mobile flex rule previously kept the overview visible above other selected analytics sections. A NOVA-scoped inactive-overview rule fixes this without changing other projects. Browser checks now require exactly one visible analytics section and its heading in the viewport.

## Validation

- The overview checkpoint passed 14 browser scenarios before remaining-block styling began.
- Final build, syntax and whitespace checks passed; all 232 recovery checks and 15 browser scenarios passed.
- Both themes: 13 overview viewport widths (360–1520 px), no clipped KPI values, exact parity with the native metric output, visible CRM entry points, branded channel and native date controls.
- Motion: intermediate slide position, continuity after a second click mid-slide, final active-tab alignment, reduced motion and theme switching.
- Remaining blocks: all five sections at 1440, 768, 390 and 360 px in both themes; no document overflow, no clipped campaign metrics, expected funnel/report content and visible selected-section headings.
- Existing flows cover calendar, new-tab section navigation, reports/project materials, mobile/desktop CRM round trips, qualification updates and administrator-only demo access. Four real-project fixtures explicitly retain their previous layout and have no NOVA styles mounted.
- Visually reviewed neutral dark/light overview renders, campaign metric groups, light mobile funnel and dark mobile report cards. Tests used local Chromium fixtures and touch/viewport emulation, not physical Safari or a live authenticated browser session.

## Deployment

- Worker: `toys-agency-platform-staging`, active at 100%: `6f2541e0-e863-40f3-8172-7ff3ccb8abcd`.
- Rollback target: `b0b002a4-56c6-44b3-a3b0-50a4d655c523`.
- Downloaded deployed bundle matches the tested build: SHA-256 `8127ad0f823e909fc27e055315c22e1581aa4d4f1811c6c75a634aa344fdb3fd`.
- All 24 bindings and compatibility settings match the pre-release snapshot. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and project registry are unchanged and compatible. No migration, data import or access change.
