# Qualification checkboxes for project teams

In CRM, open the board-name menu → **Настроить доску**. Assigned team members
and administrators can mark **Квалифицированный лид** beside each eligible
stage. The same controls work when creating a board. Sale type and qualification
are separate choices; the first intake stage remains unqualified.

The controls persist the existing explicit stage semantics used by current CRM
counts and first-qualification milestones. With qualification delivery enabled
on the CAPI connection, future qualification transitions use the existing
deduplicated QualifiedLead delivery. Saving rules does not create historical
milestones/jobs, replay old cards, enable CAPI, or change external CRM mappings.
Existing project assignments, client restrictions and admin-only CRM policies
remain in force. No production stage selection was changed by this release.

Validation:

- All 68 recovery test files passed across the normal run and the seven runtime
  files rerun with local networking permission. The initial runtime failures were
  sandbox restrictions on local Worker/listener startup.
- Eight Playwright scenarios passed: assigned-team checkboxes at 1440/390 px;
  board creation/transfer/persistence; four bulk/edit flows; TOYS stage and sale
  regression. Client and foreign-project settings access were rejected.
- Synthetic Worker tests verified: changing rules updates current counts without
  creating past conversion jobs; a fresh selected-stage transition sends one
  acknowledged QualifiedLead through a mocked transport; repeated qualification
  transitions do not send another event. No production test lead/event was sent.
- The board browser test now uses the current direct CRM entrypoint and checks
  mobile visibility within the current dashboard shell.
- Unified build and `git diff --check` passed.

Released 2026-11-03 around 14:19 Asia/Tbilisi:

- Active Worker: `483b8910-2b3e-4275-a835-8dcd210ae934`, confirmed at 100%.
- Previous Worker: `27f75e65-81e8-4869-ae54-b142295e2fba`.
- Active module matches the tested local bundle, SHA-256
  `d159c6658765a5df9c1ec1499ac607f0fd1584c8c050203dcb6003698e1080fd`.
- Read-only before/after checks confirmed stored board pipelines/versions and
  CAPI configuration/access modes were unchanged.

The WIKI policy discussion remains separate from deployment. Approved content
is being collected privately for later editorial agreement; no finance/payroll
records, credentials, or project deadlines were rewritten as part of this UI
release.
