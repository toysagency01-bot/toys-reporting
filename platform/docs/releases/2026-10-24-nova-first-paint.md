# NOVA first paint — 2026-10-24

Implementation: `58e8a00`. Scope: private NOVA demo.

The native renderer inserted its original markup before snapshot/tab loading finished; the NOVA presentation adapter mounted only afterward. That interval painted the previous interface on both cold loads and reloads.

The initial authorized HTML now contains a lightweight branded loading screen, critical loading CSS and synchronous stored-theme selection. The original body children remain invisible until the existing initialization sequence finishes and the NOVA presentation is mounted. A short-lived observer preserves the screen when the native renderer replaces body contents; it disconnects on completion. The switch to the prepared dashboard follows actual readiness, with no artificial delay or font wait. Original loading/error text and branding are reused.

An initial failure shows the existing error message inside the themed screen instead of revealing a partial legacy interface or leaving a loading skeleton indefinitely. Completion is idempotent, so a later refresh error cannot cover an already usable dashboard. Other projects retain their original startup behavior; authentication and cache scopes are unchanged.

## Validation

- Build, syntax and whitespace checks passed; all 233 automated recovery tests passed.
- Validated 32 distinct browser scenarios, including the existing design, project, mobile, sales-demo and four other-project isolation scenarios. The full run passed 31; an existing calendar style assertion raced with replaced metric nodes. It now reads the current DOM atomically with polling. Final focused run passed all six loading/calendar cases.
- Four cold-load/reload cases cover dark/light at 1440 and 390 px. Dashboard responses are deliberately withheld while the legacy DOM exists. Frame samples verify that its header and original metric groups never become visible; the new loading screen, correct stored theme and busy state remain visible until readiness. Reload checks verify the same behavior after an initial successful visit.
- A simulated initial 503 verifies a visible error, hidden skeleton/legacy header, released busy state and successful recovery after reload. Reviewed desktop light and phone dark loading screenshots.
- Browser checks used local Chromium fixtures and viewport/touch emulation; no physical Safari validation was performed.

## Deployment

- Worker `toys-agency-platform-staging`, active at 100%: `8883976a-907d-4526-8bfa-6f355738fcb6`.
- Rollback: `aac0a480-36a1-48c2-a8a7-546578f1fc28`.
- Downloaded active bundle matches the tested build: SHA-256 `abf0f473ea96737634e2b9e396825c0023edeedfeaa5f0974c1668884604b1c4`.
- All 24 bindings and compatibility settings are unchanged. Pages deployment `2cb3c127-4941-4c28-898d-225aed0666a0` and registry are unchanged. No schema, data, schedule or access changes.
