# New brief project intake and launch preparation — 27 October 2026

New responses on the approved Google Forms response sheet can create a private
project draft and a Google Drive folder. The selected project's master overview
opens a persistent launch-preparation dialog with full original answers, editable
project details, eleven startup steps, deadlines, responsible labels and explicit
verification notes. The dialog can be closed/reopened; unsaved changes are guarded.

The source is `1SvEG8VNqmGhhND9UGyKXBbKczjTA__nG8Lla7EPtVyA`, gid `269775685`.
The 117 existing responses observed during preparation were not imported. Projects
remain `unconfigured`/`draft`, without invented account timezone/currency, client
invitations, advertising integrations, CAPI events or campaign launches.

## Activation state

The platform implementation and private administrator setup UI are deployed.
The Google owner must still install the generated bound Apps Script once:
**Master → Главная → Все проекты → Подключить брифы**. The UI supplies the code,
an intake-only key and instructions for `setupTOYSBriefIntake`. The key stays in
the encrypted Worker secret and Google Script Properties, not source or cells.

The Google trigger is **not yet confirmed installed**. Live source readback shows
`last_checked_at: null`, `last_received_at: null`, `projects_created: 0`. Do not
describe the complete automated flow as active before Google setup and a real
new submission. No synthetic submission was sent to production to obtain a green
status. Apps Script code/trigger creation tools are unavailable in this chat.

The event path uses onFormSubmit, with a five-minute retry trigger and a durable
cursor. The initial cursor skips current responses. Retries resume the same row;
completion requires both the platform record and its acknowledged Drive folder.
No hourly ChatGPT automation is used for brief intake. See `docs/BRIEF-ONBOARDING.md`
for identity, permissions, recovery and folder-owner handling.

## Access and storage

Migration `0037_project_onboarding.sql` adds brief_sources and project_onboarding.
The source cutoff is `2026-10-27T08:30:29.557197+00:00`. The source accepts only its
configured sheet. Exact timestamp identity deduplicates retries; ambiguous edits
conflict instead of overwriting a draft. Google folders carry stable project IDs.

Admin and assigned team members can read/edit project preparation. Clients,
unassigned staff and public requests cannot read the brief. Only admin can obtain
the intake setup key. Team assignment supports these private dynamic drafts in
the existing access-management UI; public project registration is unchanged.
Checklist writes/profile clarification use optimistic versions and atomic audit.
Advertising connection completion requires explicit verification notes; nothing
is marked connected from an unchecked response in the brief.

The Google parent created during preparation is `TOYS — Проекты`,
`1OrCr9Zjqz3we4cwxR6gS0Jh5lXOks_W_`, initially private under the connected agency
Google account. An installer without access creates its own root during setup;
the source can bind that root only before the first project. Folder access for
the media buyer is a separate checklist action, not an automatic broad share.

## Verification and deployment

The shared branch received independent VISA KeyCRM/Meta changes during this work.
They were merged and preserved before deployment. The onboarding migration was
renumbered to 0037 to follow the existing KeyCRM 0035/0036 migrations.

- Unified build, syntax and whitespace checks passed.
- All **298** automated recovery tests passed after merging the current branch.
- **7** onboarding browser scenarios passed on the merged bundle: complete cards,
  XSS-safe answers, persistence, required checks, dirty close, mobile fitting,
  assigned/unassigned staff access, admin-only setup and original-brief retention.
- **8** existing financial browser scenarios passed during this change, including
  financial access restrictions and revocation. Financial code/data were not
  changed by the brief setup; its separate Google backup remains outside scope.
- Browser evidence uses local synthetic Chromium fixtures, not authenticated
  production browser or physical-phone execution.

Active Worker: `1e22bb72-f5a1-4e1a-9fa9-24362067f0fa` (100%).
Previous Worker: `ecc382db-9c48-4b3f-852f-2297dc929bb9`.
Downloaded active module matches the tested merged build byte for byte:
`9fd2e0b1b49532e46fe4e08daf48927c9fb40f02c0ca5c141aa451e7b13676ca`.
Encrypted `BRIEF_INTAKE_TOKEN` binding exists; active binding count 29.
Pages deployment remains `2cb3c127-4941-4c28-898d-225aed0666a0`; its existing
generic API/master routing and registry were verified. No new public project
route or Pages publication was needed.

Source/secret preparation uses `scripts/configure-brief-intake.py apply|status`.
It makes no Google requests and imports no historical rows. Ignored deployment
receipt: `platform/dist/brief-onboarding-release.json` (metadata only).
