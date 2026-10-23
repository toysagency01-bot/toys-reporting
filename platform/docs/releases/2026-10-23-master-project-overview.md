# Compact master project overview — 2026-10-23

Selecting a project now shows its name, primary Dashboard/CRM links, secondary
report/documentation/creative-plan links, and compact source status in one panel.
The redundant one-row project table and separate large work panel are removed
from this view. Four metric cards show spend, advertising conversions, qualified
CRM leads and CRM sales. The all-project view retains its table and project count.

Spend is summed within each currency and labelled by advertising channel in the
selected-project card. Independent currencies remain independent. Missing and
restricted metrics use a dash instead of an invented zero. Internal project-type
codes are replaced by readable names. The CRM attribution explanation is available
in a compact disclosure. Recorded import/delivery problems remain expanded and
collapsible; the no-error state occupies one line.

The phone header and filters are compact enough to expose the metrics earlier.
Project destinations use normal links, including a standalone CRM fragment URL.
Navigation words wrap at word boundaries. Project panels and metric cards do not
animate on each cached-data render. These styles are scoped to the home overview;
advertising requests, refresh timing, backend calculations and authorization are
unchanged. No database or file migration is required.

Validation: build and 232 automated checks passed. Three new browser scenarios
cover the selected/all-project views, per-channel filters, independent currencies,
unknown/restricted metrics, issues, accessible links and loading the CRM URL in a
separate tab. Layouts were checked at 360, 390, 768, 1024, 1366 and 1440 pixels;
desktop and phone screenshots in both themes were reviewed. Additional regression
coverage passed: three staff-role scenarios, two CRM cohort scenarios, two
administrator-only CRM scenarios and all 12 invoice scenarios (22 browser scenarios
in total). Browser tests used the locally built Worker and Pages gateway with
synthetic fixtures; deployment activation was verified through Cloudflare.

Implementation: `a5c376d`.
Worker: `55ed356f-845e-435b-83f1-07f6dd14f328` at 100%.
SHA256: `963a60d69127266cfc901b05d1b71b6872bcaa2300f1e9b2f72201200e60c466`.
Rollback: `ce8fa292-6751-4fbf-a7ff-8b3aec27a25e`.
