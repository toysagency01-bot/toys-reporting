# Labelled mobile project list — 2026-10-24

Implementation: `3803105`.

The master overview inherited the native dashboard's generic mobile table fallback: it hid the header and stacked cells vertically. Project cells did not supply that fallback's labels, so users scrolling the project list saw an unlabelled column of numbers. The previous QA covered selected-project layouts and master navigation but missed readability of the all-project list below the first screen.

On phones each project row now has its own compact layout: project title, four explicitly labelled metric tiles in a 2×2 grid, sources and destination links. Labels are real text nodes. The desktop table retains its column headings and native table layout. Advertising sums, currencies, unknown values and CRM access restrictions are unchanged.

## Validation

- Build, JavaScript syntax and whitespace checks passed.
- Five overview browser cases passed, including a new 12-project touch-phone scenario. It checks visible labels beside values at the first, second, middle and last projects; 360/390/430px widths; both themes; long names; multiple currencies; zero and unavailable CRM values; compact card bounds; period/channel changes; selection of a project near the end; and restoration of the desktop table.
- Visually reviewed viewport screenshots while scrolled to BSCLINIC and the last project in both themes, plus the desktop table.
- Three role/access browser scenarios and two overview aggregation tests passed.
- Browser validation used Chromium mobile/touch emulation with local fixtures. Physical iOS Safari was not available; this release does not claim a physical Safari check.

For subsequent responsive changes, a first-screen screenshot or a viewport overflow assertion alone is insufficient evidence of usability. Review the affected populated view after scrolling, and verify that values retain readable labels when desktop headers disappear.

## Deployment

- Worker: `toys-agency-platform-staging`
- Active version: `c36aeca2-92e0-4008-9037-9278fc01d36a`, confirmed at 100% through Cloudflare.
- Bundle SHA256: `9bcba9409cf5006397743de27bc8dd1d3f8e2d7bb107537a3a7d49d485dadb25`
- Previous version / rollback target: `bad15e1b-851d-4dd0-b81d-e37f56b6b390`.
- No database migration or gateway deployment required.
