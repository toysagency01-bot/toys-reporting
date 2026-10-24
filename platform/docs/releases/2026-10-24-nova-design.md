# NOVA-only dashboard design — 2026-10-24

Implementation: `9d8b01f`.

The selected client-dashboard composition now runs in the private `nova-sales-demo` cabinet: a turquoise lead block with pure-black figures, individual metric cushions inside advertising and CRM-sales groups, matching dark/light themes, a visible desktop CRM link and persistent mobile CRM navigation. The native section menu now sits in the top header with a translucent glass indicator that slides between sections. Reduced-motion preferences disable its movement and the content entrance animation.

Both the bootstrap gate and the adapter require the exact NOVA slug. Styles are injected only there and are scoped to the NOVA class. Other project dashboards and the master account retain their existing interface. NOVA remains administrator-only.

The presentation reads the existing rendered metric groups, preserves their original IDs/source parents for native calculations and summary observers, and removes comparison badges from the display values. The compact channel/period selects dispatch the native controls. Calendar, report editing, campaign drilldown, CRM status changes, theme persistence and browser section links retain their existing handlers. There is no additional metric API or calculation path, database migration, project registry change or Pages deployment.

## Validation

- Build, JavaScript syntax and whitespace checks passed.
- All 232 automated recovery checks passed.
- All 13 browser scenarios passed: 3 new NOVA scenarios, 6 existing sales-demo scenarios, and 4 existing project-layout scenarios with explicit NOVA-style isolation assertions.
- Both themes were checked at 13 viewport widths (360–1520 px) for page overflow, clipped values, pure-black lead figures and visible CRM navigation.
- Browser flows cover data parity with native metric output, channel/period controls, calendar, all section tabs, glass alignment/animation, reduced motion, theme changes, desktop/mobile CRM round trips, a qualification update propagating to cached dashboard data, and opening a section in a new browser tab.
- Visually reviewed dark desktop and light phone renders, including the mobile block ordering. Final NOVA scenarios passed again after restoring native dropdown arrows.
- Browser checks used local Chromium fixtures and touch/viewport emulation, not physical Safari or an authenticated live browser session.

## Deployment

- Worker: `toys-agency-platform-staging`.
- Active version at 100%: `b0b002a4-56c6-44b3-a3b0-50a4d655c523`.
- Rollback version: `c2fb8a0b-6350-46f5-990a-84cc5121974c`.
- Downloaded deployed bundle matches the tested local bundle: SHA-256 `03160fb9bb17be5692bc660dcd74eb97aaead0b5422bbac703312b3be70ac24d`.
- All 24 bindings and compatibility settings match the pre-release snapshot.
- Existing Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and its project registry remain compatible and unchanged.
