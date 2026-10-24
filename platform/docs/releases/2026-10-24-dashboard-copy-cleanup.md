# Dashboard copy cleanup — 2026-10-24

Implementation: `421d961`.

Removed the campaign methodology footer, routine drill-in instructions, successful creative-ranking captions, redundant section subtitles and generic published-data notices from the shared project presentation. Instashop's static explanatory notes and NOVA's funnel formula prose are removed as well. Healthy creative cards retain a 16 px gap below the ranking controls.

Partial, stale, missing and failed-data messages remain visible. Actual CRM/advertising discrepancies, synthetic demo disclosure, campaign budget confirmations and uncertain-operation states are preserved. No metric, calculation, permission, database or integration changes.

Validation: build, syntax and whitespace checks passed; all 233 automated recovery tests and 18 relevant existing browser scenarios passed. Manual Chromium checks covered desktop and mobile campaigns in both themes, healthy creative captions and unavailable qualification messages. Screenshots show the removed footer without a residual text gap. Mobile checks use emulation, not physical Safari.

Worker `toys-agency-platform-staging` is active at 100% on `8e125171-3e7a-4845-9f24-e78d971a1576`. Rollback: `5ac6d6ed-a239-47d3-b681-4bc0e439095f`. The downloaded active bundle matches the tested build: SHA-256 `18625e5ed7bd3f15065ce5b35363c413369c3945d28cdeb633a88b69a2a3f0c2`. All 24 bindings and compatibility settings are unchanged. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and its project registry are unchanged.
