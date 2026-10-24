# NOVA transition pulse and comparison contrast — 2026-10-24

Implementation: `8afdb88`. Scope remains the private `nova-sales-demo` project.

The upper section indicator briefly expands during a transition, with a passing glossy highlight and a fine refracted edge, then returns to its exact selected-tab bounds. Position, width, vertical scale and highlight state continue from their current visible values when another section is selected mid-transition. The existing 369 ms desktop timing is retained. There is no idle/hover pulse or repeating animation; reduced motion cancels movement and highlights. Channel, date and other lower selectors remain flat with their existing motion.

The previously deferred point 2 is now resolved: comparison percentages on the turquoise feature use an opaque pale chip, 12 px semibold type and dark teal/red text. Contrast against the chip is 6.77:1 for teal, 7.16:1 for red and 7.46:1 for neutral. Both themes use the same feature-chip colors; the light-theme general delta rule no longer overrides them. Original comparison values, arrows and cost-direction semantics are preserved.

## Validation

- Build, syntax and whitespace checks passed; all 233 automated recovery tests passed.
- Validated 25 distinct browser scenarios: 10 NOVA design cases, five touch/mobile cases, six existing sales-demo cases and four other-project isolation cases.
- The final full browser audit passed 24 cases; the remaining contrast case exposed a test-harness race reading styles from replaced metric elements. Style queries now read current elements atomically inside the page. A focused recheck passed both native-comparison parity and chip contrast cases (2/2).
- Pulse checks cover single-cycle swelling/highlights, exact settlement, interrupted motion without a position/size jump, no hover/idle animation, and reduced-motion cancellation in both themes. Lower indicators have no glass effect layers.
- Comparison checks cover 320, 360, 390, 768 and 1440 px in both themes, clipping, opaque chip fills and at least 4.5:1 text contrast. A local negative-state probe also verifies red text contrast; original positive/negative native comparisons retain their source classes and values.
- Reviewed screenshots of the transition peak in both themes and percentage chips on desktop and phone layouts. Browser evidence uses local Chromium fixtures and touch emulation; no physical iPhone/Safari validation was performed.

## Deployment

- Worker `toys-agency-platform-staging`, active at 100%: `89b7a3ed-741f-40f5-b0f2-5dd881bfc640`.
- Rollback version: `ed4285af-1be9-4186-b0c5-13e62f407b24`.
- Downloaded active bundle matches the tested build: SHA-256 `3e67b4197d56ae5ca6f1b61cdb57503014abddaed57b272444267856a86c1c28`.
- All 24 bindings and compatibility settings are unchanged. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and its project registry are unchanged. No data, schema, scheduling or access changes.
