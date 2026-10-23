# Original metric structure and light palette — 2026-10-23

Project dashboards show their original metric sets, labels and order immediately.
Lead-generation dashboards retain spend, impressions, clicks, CTR, results and
CPA in the native order; Instashop retains all 11 original cards. Commerce retains
its original per-channel advertising cards and the separate native sales funnel.
The original headline, period summary, CRM link and attribution explanation are
back in their original positions. Campaign lists show all of their original
columns in the original order. No additional-metrics toggles, mirrored commerce
cards or metric reordering are applied by the shared layout module.

Cards remain visually compact through smaller padding, gaps, heights and type
sizes. The shared layout no longer overrides light-theme link, active-control,
primary-button or error colours; the original theme supplies the palette. The
headline arrow uses SVG so its appearance does not depend on font glyph support.
The mobile section picker and prior monthly-report usability improvements remain.

Validation: build, syntax/whitespace checks and 232 automated checks passed.
All 73 browser scenarios passed: four layout/palette scenarios, three section
navigation scenarios, 55 main regressions, three monthly-report scenarios and
eight campaign-control/audit scenarios. The layout checks verify native metric
order and visibility for lead generation, Instashop and commerce, all campaign
columns, compact card height, no text clipping and viewport widths 360, 390, 768,
1024 and 1440. Computed colours/backgrounds/borders of cards, navigation, period
controls and buttons match the original theme with the compact layer disabled.
Screenshots were reviewed on desktop and phone. Tests used the locally built
Worker/Pages gateway with synthetic fixtures. No data, authorization, advertising
refresh or storage migration is involved.

Implementation: `854824e`.
Worker: `e67bc5dd-b375-4d7c-88ab-66a06dc1956a` at 100%, confirmed through Cloudflare.
SHA256: `f63d2abce76d8e8327ba94de6eddce875ecd2bb65050c19ea53f870638dd84b5`.
Rollback: `9ae8fffe-0847-42e7-be12-98b0213ca097`.
