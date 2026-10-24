# Currency symbols in statistics — 2026-10-24

Implementation: `e585b77`.

A shared presentation formatter now renders currency symbols in project KPIs, CRM revenue and acquisition costs, campaign levels and parent summaries, creative statistics, sales-demo funnel outcomes, master summaries and project rows, morning reviews and generated Telegram review text. Native chart legends and currency conversion tooltips use the same formatter through the platform adapter; repository renderer originals remain intact.

Examples: EUR → €, USD → $, CZK → Kč, UAH → ₴, GBP → £, IDR → Rp. Qualified symbols distinguish dollar currencies where needed. Existing monthly-report Kč amounts already use the correct symbol.

ISO codes remain the data/grouping keys and form values. This is a display change, without conversion, aggregation, API currency-field or schema changes. Saved review evidence is formatted at display time; new generated evidence uses symbols too. No Telegram message was manually sent or edited during release.

## Validation

- Build, syntax and whitespace checks passed.
- All 232 automated checks passed, including currency-separated aggregation and review delivery formatting.
- 77 browser scenarios passed: general regression (55), compact project layouts (4), master overview and long-list scrolling (5), demo dashboards/funnel/touch flow (6), TOYS CRM (1), bulk CRM (4), and real-estate CRM (2).
- Added checks for absence of ISO codes in metric values, campaign values, CRM demo cards, funnel revenue and chart labels. Existing CRM flows verify revenue uses symbols while submitted/stored currency remains ISO.
- Visually reviewed mobile master cards with Kč/$ and zero/unavailable CRM, dark demo revenue/cost cards with €, and light HOUSEVIP cards and chart with Rp. Existing browser flows cover period changes, cached refreshes and both themes.
- Checks used local Chromium fixtures and touch/viewport emulation, not a physical Safari device or a live numerical reconciliation.

## Deployment

- Worker: `toys-agency-platform-staging`
- Active version: `c2fb8a0b-6350-46f5-990a-84cc5121974c`, confirmed through Cloudflare at 100%.
- Bundle SHA256: `818129211b489b15792816fb5f04c81041f04fbe5df85a8619402d8e97afd810`
- Previous version / rollback target: `c36aeca2-92e0-4008-9037-9278fc01d36a`.
- No database migration or gateway deployment required.
