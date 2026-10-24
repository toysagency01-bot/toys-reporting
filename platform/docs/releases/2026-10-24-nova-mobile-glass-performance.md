# NOVA mobile glass and desktop navigation performance — 2026-10-24

Implementation: `eed193c`. Scope remains the private `nova-sales-demo` project.

The turquoise feature's percentage badges are restored to their previous dark background, padding, size and colors, as requested. Native values, arrows and cost-direction semantics are unchanged.

On mobile, channel and period selectors, project channel/subsection selectors and Home/CRM navigation now use the same one-shot glass pulse as the upper navigation. The bottom selection follows the existing Home/CRM state without replacing links or navigation handlers. Switching viewport widths adds/removes effect layers and hides the bottom indicator on desktop. Reduced motion cancels every indicator/highlight animation. Desktop lower selectors remain flat. The mobile dark glass palette matches the existing upper capsule.

## Desktop performance

- The moving upper lens no longer applies a live backdrop blur; the stationary capsule retains the glass treatment. Movement and pulse use compositor transforms; highlights use transform/opacity on cached layers.
- Pointer lighting is coalesced to one update per frame and suspended during movement. Removed the simultaneous whole-panel fade/translation. Revenue fitting is cached by tile width and invalidated when values/nodes or loaded fonts change, avoiding unnecessary text writes and layout reads during navigation.
- Chromium LayerTree inspection confirms accelerated transform animation and a `will-change: transform` compositing hint on the upper indicator.
- Compositor `DrawFrame` samples restricted to eight actual upper-menu animation windows measured 59.89–61.05 FPS in dark and 60.37–60.81 FPS in light, consistent with nominal 60 Hz. Median frame gaps were 16.59–16.69 ms; the largest per-window 95th percentile was 18.07 ms.
- Whole-page main-thread RAF sampling is a different measure: it showed about 55.3 FPS in the first dark run and 59.7 FPS in light, including occasional page-rendering tasks. This release does not claim a guaranteed 60 FPS floor for every device or all page rendering. Measurements used local headless Chromium, not the user's physical browser/GPU.

## Validation

- Build, syntax and whitespace checks passed. All 233 automated recovery tests passed.
- Validated 26 distinct browser cases, including four other-project isolation cases and full mobile section/project audits in both themes. The full audit passed 25 cases; the new case required selector corrections for multiple project buttons and CRM shadow-root IDs. Its focused recheck passed.
- Final focused audit passed 3/3: upper pulse/interruptions/reduced motion, exact former badge styling, and mobile pulses across channels, dates, project tabs and Home/CRM, including desktop resize behavior. Visually reviewed light/dark mobile layouts.
- The opaque calendar and existing data, report, filter, CRM and native link workflows continue to pass. No physical iPhone/Safari testing was performed.

## Deployment

- Worker `toys-agency-platform-staging`, active at 100%: `8e610511-65c0-4e6e-a68e-974b7fb64e63`.
- Rollback version: `89b7a3ed-741f-40f5-b0f2-5dd881bfc640`.
- Downloaded active bundle matches the tested build: SHA-256 `6dd4cf5cd9499b06228e27fb6d2eb0eea5313015898b7029e25bacc18b4c9f6b`.
- All 24 bindings and compatibility settings are unchanged. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and registry are unchanged. No schema, data, scheduling or access changes.
