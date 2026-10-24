# NOVA project subtab selection — 2026-10-24

Implementation: `be3dab3`. Scope: private NOVA demo.

Desktop project subtabs retained the original `.seg button.active` fill, so the destination button lit up immediately while the separate selection indicator was still travelling. The NOVA transparent-active-button rule now includes `#projectSubNav`. Only the moving indicator paints the selected background. Animation timing, native selection/content handlers and mobile glass behavior are unchanged.

Validation: reproduced the duplicate fill with a failing browser assertion before the fix. After the fix, all five targeted browser cases passed: project selection in both themes (including a paused intermediate frame and exact settlement), secondary block layouts, desktop controls, upper glass/reduced motion, and mobile project/Home/CRM glass. Build and whitespace checks passed; both desktop theme screenshots were reviewed.

Deployment: Worker `toys-agency-platform-staging` at 100%, version `aac0a480-36a1-48c2-a8a7-546578f1fc28`. Rollback: `8e610511-65c0-4e6e-a68e-974b7fb64e63`.

Downloaded bundle matches the tested build: SHA-256 `53458fb3d759b824420826b2b915706e5378ecebafe1a39213bedb7a6f4934ea`. All 24 bindings and compatibility settings are unchanged. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and registry are unchanged. No data, schema or access changes. Browser checks used local Chromium fixtures; no physical Safari validation was performed.
