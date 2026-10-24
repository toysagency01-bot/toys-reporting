# Mobile dashboard and master navigation — 2026-10-24

Implementation: `ed9609c`.

Mobile project headers now place the logo, theme toggle and account control in one row, with the complete project name below. The native section selector uses a compact shared container, clear chevron and a 16px input font. Touch controls retain at least 44px targets. Metrics appear before the summary and creative panels on phones; desktop metric placement and existing theme colors are preserved.

The mobile master menu places secondary destinations in a native “Ещё” disclosure with complete labels. It closes on selection, outside click and Escape, highlights the active secondary section, and follows existing role visibility. Original desktop menu nodes and order are restored when switching to desktop width. Project overview destination links use two columns on phones.

Removed calculation disclosures from project dashboards, master overview and monthly summaries. Calculation and data-attribution logic is unchanged.

## Validation

- Build, JavaScript syntax and whitespace checks passed.
- 232 automated checks passed.
- 80 distinct browser scenarios passed across general regression (55), compact project layouts (4), sales demo and touch-phone flow (6), master overview/navigation (4), monthly reports (3), platform roles (3), section navigation (3), and CRM cohort attribution (2).
- Repeated the affected master, role, demo and cohort suites after refining desktop restoration; repeated all six demo cases after the final selector styling.
- Visually reviewed dark/light project dashboards, touch-phone screenshots, mobile master menus and the restored desktop menu. Checked widths 360, 390 and 430px, larger layouts, native section changes, menu closing, permission visibility, data refreshes and absence of the removed disclosures.
- Browser checks used Chromium with local built fixtures, including mobile/touch emulation; these are not physical Safari-device tests or a live numeric audit.

## Deployment

- Worker: `toys-agency-platform-staging`
- Active version: `bad15e1b-851d-4dd0-b81d-e37f56b6b390`, confirmed through Cloudflare at 100%.
- Bundle SHA256: `2258437fe306405b5349e60b532c2ff873cef84251da8792216f928a3a75b97d`
- Previous version / rollback target: `43208ee2-fd76-44bd-83cc-6000e0e5cc0d`.
- No database migration or gateway deployment required.
