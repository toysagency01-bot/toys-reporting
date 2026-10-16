# Platform roles — 2026-10-16

The master dashboard now supports administrators and employees with assigned projects. Client access remains project-specific.

| Capability | Administrator | Team | Client |
| --- | --- | --- | --- |
| Master dashboard, CRM and morning review | All projects | Assigned projects only | No master access |
| Edit, publish and delete reports | Yes | Assigned projects | Existing client permissions |
| CRM lead actions | Yes | Assigned projects | Existing client permissions |
| Grant client access | All projects | Own assigned projects only | No |
| Assign employee projects or change roles | Yes | No | No |
| Integration settings and CAPI | Yes | No | No |

Administration is under Master → Access. Team members can enter the master even when no projects have been assigned. New employee accounts use the existing password invitation flow. Project deletion is not exposed to employees; this release does not add a project deletion endpoint.

Permissions are checked on the server, including direct project URLs, published material endpoints, report attachments, master summaries and review results. Revoking a project takes effect with the existing session; browser cache scope changes with access version and project grants. Team changes preserve client memberships outside their own scope. Password resets for shared clients with other projects require an administrator. Role changes and disabling accounts invalidate sessions. The last enabled administrator cannot be demoted or disabled.

## Rollout

Run `scripts/migrate-platform-roles.py` before releasing the Worker. Migration 0023 is additive. The rollout seeds the three existing configured owners as administrators and verifies that existing user identities/status and every project membership are preserved. It writes a sanitized verification receipt to `dist/platform-roles-rollout.json`. No import schedules, advertising accounts, Sheets or Cloud Run configuration change.

Worker rollback target: `662a2cf4-fe0c-4459-b085-3c17a48c0876`. Previous code ignores the additive role table; no destructive schema rollback is needed. The legacy Pages gateway registry remains unchanged.

## Validation

- 149 automated recovery tests passed, including native-session authorization, cross-project denial, role escalation denial, invitation guards, revocation, report publication/deletion and review isolation.
- Three role browser scenarios passed: administrator assignment/invitation, scoped employee workflows, unassigned employee and existing client workflows.
- Four adjacent browser scenarios passed: password invitation/login, existing access management, durable weekly reports and cached report/approval navigation.
- Desktop/mobile screenshots inspected; project choices have 44px touch targets and no horizontal page overflow.
- Production schema/configuration checked read-only before migration. Authenticated browser QA used local synthetic accounts, not production client identities.
