# UI responsiveness audit — 12 October 2026

Scope: the published HOUSEVIP, Karlovarska Sul and PROFKIT client dashboards,
including the calendar, campaign hierarchy, creative approval and weekly reports.
The baseline is commit `ecce949`.

## Findings and changes

- Each native render destroyed and recreated Chart.js instances, replaying the
  chart animation. Keep the instance, update its datasets/scales without animation,
  and combine render requests made within one event turn.
- Responses with no usable new provider data still rendered the entire board.
  Preserve the existing screen; identical campaign, commerce and hierarchy data
  also skip the native render. Hierarchy changes remain part of this comparison.
- Every body mutation ran horizontal tab fade measurements and could force layout,
  including calendar changes unrelated to tabs. Track affected tab strips and their
  sizes, and batch their measurements with requestAnimationFrame.
- Calendar day cells repeatedly constructed date formatters, and campaign numbers
  constructed number formatters for every value. Reuse the same locale/precision
  formatters; retain their existing timezone and rounding rules.
- Ranking blocks and CRM aggregate cards were replaced even when unchanged. Reuse
  them; preserve image elements and preview error fallbacks. Decode previews
  asynchronously. The original icons, fonts, colors and layout are retained.
- All nested ad metrics were built into the DOM while their details were closed.
  Create groups and individual ad details on expansion, using already-loaded data.
  No extra advertising request is needed to expand a campaign.
- Returning to Meta approval or weekly reports restarted their reads and loading
  state. Keep the loaded screen for 60 seconds; writes and explicit report reloads
  force a fresh read. Project material tables share a bounded 20-minute memory
  cache. Advertising auto-refresh remains every 20 minutes. CRM's existing cache
  and server authorization remain in place; no new persistent or public cache.
- Remove duplicate insertion of platform CSS. Index PROFKIT's verified currency
  conversion ratios by date rather than scanning every source row for each ad row.

## Measurements

Local Chromium, 1440×900 viewport, CPU throttled ×4. Synthetic HOUSEVIP data:
80 campaigns / 2,400 daily rows, plus a one-campaign control. Same actions in both
runs: 30 → 7 → 30 days, campaigns → overview, three calendar open/month/close cycles.
Provider responses were intercepted locally; these are UI measurements, not live
network latency or the owner's device FPS. Each result is one comparative run;
absolute timings depend on hardware and runtime noise.

| 80-campaign scenario | Before | After |
| --- | ---: | ---: |
| Main-thread task time across the action sequence | 3.431 s | 1.662 s |
| JavaScript execution time | 1.250 s | 0.434 s |
| Tasks longer than 50 ms | 15 | 5 |
| Sum of task time above the 50 ms threshold | 844 ms | 211 ms |
| Chart instances created after initial load | 6 | 0 |
| Chart draw calls | 114 | 3 |
| Layout operations | 47 | 27 |

Main-thread task time fell about 52%; blocking time fell 75%. In the one-campaign
control, task time fell from 3.197 to 1.243 seconds. Both versions were quiet when
idle: no observer callbacks or layout operations during the idle measurement.
No idle CPU leak was established. Heap measurements varied with garbage collection,
so this audit does not claim a memory reduction or a universal FPS figure.

Reproduce from `platform/`:

```sh
npm run unified:build
node recovery-tests/server.mjs
# In another terminal:
node recovery-tests/performance-audit.mjs audit
```

The profiler writes `dist/performance-audit.json`. The original comparison outputs
are `dist/performance-before.json` and `dist/performance-after.json` in the worktree.

## Validation

42 API/model recovery tests and 21 Chromium scenarios cover the existing flows and
the added regressions: chart identity, batching, stable ranking DOM, lazy hierarchy
expansion, hierarchy updates with unchanged campaign totals, cached approval/report
navigation and fresh readback after writes. Original styles, SVG assets and board
structure retain their existing parity checks. Live browser access is unavailable
under this environment's network policy; deployment is verified via Cloudflare API.

## Published release

Worker version `ba9efebe-f9c7-40f4-9582-be7c97099ae8` is active at 100%.
The deployed module was downloaded through the Cloudflare API and matches the
locally tested bundle byte for byte (SHA-256
`3515555cbfeb06f47a822b97783b6c3d80105769fc7badec7a000721765274f8`).
Rollback version: `17d2b8af-5464-44be-a28c-ee0a37c5fe74`.
No database migration or new lead/ad ingestion was part of this release.

- [HOUSEVIP](https://reports.toys-agency.com/mvp/housevip-cxp7/)
- [Karlovarska Sul](https://reports.toys-agency.com/mvp/karlovarska-sul-k4rm/)
- [PROFKIT](https://reports.toys-agency.com/mvp/profkit-instashop-r4vk/)
