# Compact CRM explanation — 2026-10-23

The project overview no longer generates the duplicate “Открыть CRM” link beneath
its metric cards. The existing navigation still opens the same CRM. The attribution
explanation is created inside a closed native disclosure labelled “Как считаются
показатели”, so the full paragraph never flashes in the overview while loading.
Its expanded text is 12px and uses the existing muted theme colour. The disclosure
follows CRM availability and retains the current cohort/sales-date wording.
Metric composition, order, calculations and the restored light palette are intact.

Build, syntax and whitespace checks passed, together with 10 targeted automated
checks and 13 local Worker/Pages browser scenarios: four project template/palette
cases, two cohort scenarios, five sales-demo scenarios and two CRM access cases.
Desktop and phone screenshots were reviewed. Checks cover closed/open keyboard
interaction, phone touch size, all existing metric cards, native palette matching,
CRM navigation, qualifications after intake, cached reload and restricted access.

Implementation: `5fd64d2`.
Worker: `491139b0-d566-4114-80be-599cfebc4946` at 100%, confirmed through Cloudflare.
SHA256: `f4a9b010cf7561d6eb5d3c4e881ab488706542b42da0c1c2e827641bbd6a3bf9`.
Rollback: `e67bc5dd-b375-4d7c-88ab-66a06dc1956a`.
