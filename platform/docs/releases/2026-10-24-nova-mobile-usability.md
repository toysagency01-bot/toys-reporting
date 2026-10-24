# NOVA mobile usability — 2026-10-24

Implementation: `4ee42b1`.

The desktop upper-menu indicator now runs at 369 ms instead of 480 ms (approximately 30% higher speed). Lower selectors retain their 480 ms motion. Indicators animate only compositor transforms, including interrupted slides, rather than width on every frame. Hidden selectors cancel their old animation and synchronize before reappearing. Mobile sections do not fade the entire panel on navigation. Native tap-highlight painting is disabled for the NOVA shell; visual review caught and removed a blue highlight flash across the calendar.

The mobile section control now opens an app-rendered dialog using the existing section links and bundled Golos Text font. The original native select remains hidden for the adapter contract. The menu retains native link targets, keyboard focus and Escape/outside dismissal. Mobile fields have a single inset focus boundary; form controls use 16 px text and touch controls have appropriate minimum heights.

The light calendar has a solid white background on both desktop and phone, with bounded height/scrolling on short screens. The mobile light bottom navigation is also opaque. Project subnavigation uses full-width, nonshrinking buttons in a horizontally scrollable strip; generic tables become full-width stacked rows without retaining desktop column widths. Task/status text wraps inside its available width.

The user explicitly deferred point 2. Comparison badges on the turquoise feature retain their previous background and color treatment; a browser assertion verifies the unchanged badge background.

## Validation

- Final build, syntax and whitespace checks passed; all 233 automated recovery checks passed.
- All 23 browser scenarios passed, including existing NOVA/sales-demo flows and four other-project layout/isolation scenarios.
- New touch audit: all five sections and every available project channel/subtab at 320, 360, 390 and 430 px in both themes; no overlapping subnavigation, narrow desktop table cells or document overflow. Report expansion, report-form fonts/focus, CRM search/card round trips, custom section-menu font/focus and Escape are covered.
- Actual touch-event/animation-frame sampling in Chromium verifies that lower indicators pass through multiple visible intermediate positions without disappearing. Existing interrupted-slide and reduced-motion checks pass.
- The calendar is solid white at 390 and 1440 px; date selection applies through the native workflow. Short-screen and rotation checks cover 320×568, 844×390 and 390×700.
- Visually reviewed mobile project material layout and opaque calendar screenshots, including removal of the native blue tap overlay.
- These checks used local Chromium fixtures and touch/viewport emulation. No physical iPhone/Safari validation was performed; a WebKit runtime is not installed in this environment.

## Deployment

- Worker `toys-agency-platform-staging`, active at 100%: `ed4285af-1be9-4186-b0c5-13e62f407b24`.
- Rollback version: `1a414486-91c4-442e-a5ac-c778298add90`.
- Downloaded active bundle matches the tested build: SHA-256 `e67f53fdf6da7d0e657f3fc683693780cdb4a2f7f1dd45b9eb702eec383e6f21`.
- All 24 bindings and compatibility settings match the pre-release snapshot. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and project registry are unchanged. No data, schema, scheduling or access changes.
