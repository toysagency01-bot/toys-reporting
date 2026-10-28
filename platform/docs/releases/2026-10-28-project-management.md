# Self-service projects

Published self-service project creation and editing for admins and scoped team members. The seven-step native dialog covers basic settings, monthly targets, traffic channels, CRM choice, brief, startup plan/materials, review and verified connections. Every new project uses the normal private dashboard and subpages, without a static registry edit or redeployment. Creation assigns its creator only; existing projects and roles remain unchanged.

Direct Meta, Google Ads API, Google CSV, KeyCRM, TOYS website intake and internal-CRM CAPI configuration are available. Credentials are encrypted; site keys are hashed. External links do not automatically import Sheets or create Drive folders. Imports run on existing schedules; missing statistics remain unknown. See `../PROJECT-MANAGEMENT.md` for instructions and limits.

Validation: 325 recovery tests passed; 5 Chromium scenarios passed at desktop and 390px mobile, including saved project edits after a previous dashboard visit, unassigned-team creation, client denial, dirty forms, and checked KeyCRM status persistence. Provider requests use synthetic test adapters; no production test project was created.

Production receipt:

- Code commit: `0979cf1`.
- Additive migration: `0039_project_management.sql`; six tables confirmed, zero managed projects before user use.
- Existing encryption key and agency Meta credential confirmed present, without reading values or changing secrets.
- Pages gateway: `4a56bf24-20c7-4ed5-a105-9febec29dcad`; managed routing marker verified from its source commit.
- Worker: `f9734172-8e55-45aa-bbd9-bcf0f428aafe`, confirmed at 100%.
- Previous Worker: `cf050f98-4725-4ae7-bcf0-943d386396b9`.
- Downloaded active module matches the tested bundle, SHA-256 `3177aed3754865f307f6168fbec36d9dd7ed943036cc12679e546fe6e4874498`.
- Production anonymous setup/create namespace and dynamic project namespace returned 403. Authenticated desktop/mobile workflows were verified against local D1 fixtures, without creating production records or sending CAPI events.
