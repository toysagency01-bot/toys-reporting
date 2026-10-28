# VISA dashboard: cost per qualified CRM lead

The dashboard overview now displays `Стоимость квала` alongside `Квал-лиды CRM`.
It divides the project's advertising spend for the selected period by the
qualified KeyCRM cohort with exact `utm_source=toys`. The existing shared metric
layout keeps both values in the same group on desktop and mobile.

Spend uses the same advertising model as the overview, with imported provider
data replacing snapshot data once. The price updates when advertising data or
the reporting period changes, including when CRM arrives before advertising.
It remains project-wide because KeyCRM has no verified campaign attribution.
No qualifications, unavailable CRM, unknown spend, or multiple currencies show
an em dash; known zero spend with positive qualifications shows zero.

SELECT-only working database readback on 28 October, for 20–26 October 2026:
PLN 7,218.12 advertising spend / 7 qualified CRM leads = **PLN 1,031.16** each.
The qualification total increased through the existing automatic CRM import.
The 13 `invitee_meeting_scheduled` events remain present and the selected days
pass independent advertising reconciliation. The separate 14 October source
mismatch retains its existing warning.

Validation: 301 recovery tests passed after incorporating the current branch's
brief onboarding release. Chromium verified same-row paired placement,
desktop/mobile overflow, period/spend updates, and a zero-qualification period.
The unified build and whitespace checks passed.

Published Worker: `521b67a2-efb0-4969-aeb8-41f78756a3d7` (100%).
Prior Worker: `1e22bb72-f5a1-4e1a-9fa9-24362067f0fa`.
