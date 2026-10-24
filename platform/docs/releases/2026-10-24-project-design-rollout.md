# Approved design rollout — 2026-10-24

Implementation: `02a9ecc`.

The presentation approved in NOVA is now enabled for all 13 registered project dashboards. The 12 newly updated cabinets are HOUSEVIP, PROFKIT, Karlovarska Sul, BSCLINIC, Taycher, Europisol, Monorey, MurMur, VISA Agency, Wedoprofi, AM Klinika and TOYS AGENCY. Master pages retain their existing presentation. NOVA remains private to administrators and excluded from agency totals.

Both themes, compact nested metrics, highlighted existing summary, upper glass navigation, animated flat desktop selectors, mobile glass selectors/Home–CRM, opaque calendar, project subtab selection and first-paint loading behavior are shared. Original project titles, branding, native metric IDs/parents, event handlers, data requests, calculations and access checks are retained.

Leadgen and Instashop retain their own lead/inquiry groups; commerce dashboards use their native advertising/purchase groups without introducing a lead feature or inventing metrics. Native metric-group membership remains the source of every displayed tile. Large amounts fit their available width; multi-currency revenue keeps separate lines and FX/attribution annotations retain their small-text formatting. Revenue abbreviation still applies only to plain single-value revenue that overflows. Source ownership/ID changes are observed so native commerce/Instashop redraws cannot leave stale cloned values.

Native funnel stages gain the same modest stage accents and rounded surfaces while retaining their existing values, proportions and ratios. BSCLINIC monthly reporting and client business-field editing remain separate. Instashop's alternate content wrapper and class-based control strip are covered. The previously removed methodology navigation is omitted from Instashop as well.

## Validation

- Build, syntax and whitespace checks passed; all 233 automated recovery tests passed.
- `npm run unified:design:browser`: all 56 browser scenarios passed in one final run. The committed config and fixture helpers make this audit repeatable.
- All 12 newly enabled cabinets plus NOVA were exercised. Four representative data models verify exact native/displayed metric membership and value parity in both themes, including responsive widths from 320 to 1440 px, currency symbols, absent data, and all relevant native navigation flows. Additional cases cover separate EUR/CZK revenue lines and assigned team/client access; private NOVA and unassigned projects remain forbidden.
- BSCLINIC client/employee monthly entry, automatic costs, reload persistence, conflicts and new-tab navigation pass. Campaign status controls, uncertainty handling, administrator audit and mobile menus pass. Existing NOVA first-paint, reduced-motion, interrupted-slide, report, CRM and layout checks pass.
- Ten additional core-flow cases were validated: durable weekly reports, initial loading, Home/CRM memory preservation, legacy lead links, CRM cache invalidation, persistent chart instances, lazy campaign hierarchy/pagination, mobile breadcrumbs, snapshot cache reuse and large history restore. Their legacy selectors were updated for the approved header CRM entry and cleaned pagination separator; all four affected cases passed the focused recheck.
- Reviewed screenshots of HOUSEVIP desktop, PROFKIT mobile, Karlovarska Sul commerce and native BSCLINIC funnel styling. Evidence uses local Chromium fixtures and mobile emulation, not physical Safari or an authenticated live-browser session.

## Deployment

- Worker `toys-agency-platform-staging`, active at 100%: `5ac6d6ed-a239-47d3-b681-4bc0e439095f`.
- Rollback version: `8883976a-907d-4526-8bfa-6f355738fcb6`.
- Downloaded active bundle matches the tested build: SHA-256 `1cd62626785f769fac45e2ec6caee2fa8fc093c1ed191e6be57cf3895b536721`.
- All 24 bindings and compatibility settings are unchanged. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and project registry are unchanged. No database, integration, schedule or permission changes.
