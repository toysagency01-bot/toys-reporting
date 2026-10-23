# Compact project dashboards — 2026-10-23

The shared project interface now leads with the main advertising metrics, followed
by a compact, separately labelled CRM summary. Impressions, clicks, CTR and other
secondary metrics remain available through “Дополнительные показатели”. The
repeated headline and period-total panels are hidden. The highest campaign cost
remains available in a neutral disclosure instead of being presented as an alert
without a target or sample threshold. CRM attribution dates remain available in a
separate disclosure.

Desktop section tabs remain ordinary links, including native context menus,
middle-click and new-tab URLs. Phones use a labelled section picker. Report and
project-material views omit advertising filters that do not filter their content.
The monthly BSCLINIC section remains separate. Navigation cancellation preserves
unsaved monthly inputs and restores the selected mobile section.

Campaign lists show spend, results and result cost by default; commerce lists
show spend, purchases and ROAS. “Все показатели” restores the remaining columns
without a data request. The sales demo retains its complete CRM-to-sale metrics.
Commerce overview purchases and ROAS mirror the existing native funnel cards for
the matching channel and period. Hidden native funnel cards are not mirrored,
which prevents old period values from appearing when the current period has no
commerce results. The original calculators and source assets are unchanged.

Cards, headings and filters use smaller spacing, readable light-theme links and
phone touch targets. Unavailable creative sections omit inactive metric switches.
BSCLINIC has an explicit entry button that focuses appointment input, a sticky
save toolbar on desktop and a year chart sized for the phone. The chart also
resizes when reopening the section after a viewport change.

No authorization, refresh schedule, advertising cache, database or attachment
storage changes are required. Master and embedded CRM interfaces remain isolated.

## Validation

Build, syntax checks, whitespace checks and all 232 automated checks passed.
Browser validation covers 96 distinct scenarios across the locally built Worker
and Pages gateway, with synthetic fixtures:

- Main dashboard/CRM/materials/reports/cache regression: 55 scenarios, including
  successful targeted reruns of the two PROFKIT cases after moving period
  selection to the Overview view, where advertising filters now live.
- Compact lead-generation, Instashop and commerce layouts: 4; desktop/new-tab and
  mobile section navigation: 3; monthly client/team workflows: 3.
- Sales demo: 5; master project overview: 3; staff/project access rules: 3.
- Invoice workflows: 12; campaign controls and admin journal: 8.

The pending campaign-request scenario explicitly selects its starting seven-day
range before returning to that same range. Reload cache reuse is checked in the
separate reload regression. Phone/tablet/desktop layout checks cover 360, 390,
768, 1024 and 1440 pixels; relevant control/journal regressions also cover 320.
Desktop and mobile screenshots were reviewed in both themes. Tests include
extra-metric expansion without new reads, unavailable commerce periods, full
report text, client business-input saves, deferred leads, conflict handling,
unsaved-change cancellation, creative popups and focus restoration.

Implementation: `bb07f62`.
Worker: `9ae8fffe-0847-42e7-be12-98b0213ca097` at 100%, confirmed through Cloudflare.
SHA256: `09a82928c3ae87f2f877ca2d05a8ebbfb3599804ccbc8f46b730b0cde76c438a`.
Rollback: `55ed356f-845e-435b-83f1-07f6dd14f328`.
