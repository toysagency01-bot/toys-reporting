# Mobile bottom navigation — 14 October 2026

At widths up to 760px, client dashboards use a bottom bar with Home and CRM.
The master uses the same layout and retains its Access tab. Content no longer
reserves a left sidebar column. Existing navigation, cached CRM state and
horizontal kanban scrolling are preserved.

Account controls move to the header on mobile. Desktop controls return to their
original parent when the viewport widens, including the theme control in the
embedded CRM header. Navigation retains the existing icons and brand colors.
Safe-area padding and viewport-fit cover support the iPhone home indicator;
focused text fields plus a reduced visual viewport hide the bottom bar while
typing. CRM inputs use 16px text to avoid iOS focus zoom. Long CRM metric labels
wrap inside their cards on narrow screens.

Validation:
- Seven existing browser scenarios passed, covering mobile layout, both original
  commerce dashboards, master CRM, cached client navigation, direct CRM links and
  agency connection settings.
- Browser checks at 320, 390 and 430px passed for both client and master: bottom
  positioning, no page overflow, separate kanban scrolling, accessible account
  controls, theme changes and no document reload on client navigation.
- Desktop/sidebar and mobile-to-desktop control restoration passed at 1440px.
- Keyboard viewport reduction was simulated; no physical iOS keyboard test was
  available. This Chromium build does not expose CDP safe-area emulation.
- Gateway bundle/source checks and build/syntax checks passed.

Active Worker: `20bc7f27-fbcf-4e39-b38e-5a382f7ed6d4` (100%).
Rollback Worker: `b5c7d912-bf04-4d8e-b400-72a2df083004`.
No project registry, database, advertising imports or Pages routes changed.
Deployment evidence and local browser captures are outside Git in
`/workspace/toys-mobile-nav-20261014`. External report-host checks remain
restricted by this environment's network policy; browser checks ran locally.
