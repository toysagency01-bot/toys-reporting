# Readable competitor analysis and team-created reader accounts

Reviews Plus competitor analysis now shows extracted conclusions, a comparison
of the four primary competitors, and expandable detailed cards. Source notes
are separately expandable, long links have short labels, typography is larger,
and prose width is bounded. The two additional competitors, site/brief
mismatches, methodology, limitations and source materials are all retained.
The old renderer stopped parsing after conclusions and omitted these sections.

The renderer is enabled only for Reviews Plus. Original D1 source material is
unchanged. Comparison excerpts and conclusion previews retain full wording in
details. Price strings are extracted only from each source offer, without
currency conversion or market averages. Link counts describe source links,
not proof of current advertising. Evaluative fields are labeled accordingly.
Both dark/light colors inherit the existing theme; emphasis is restrained.

Team members can reach the existing client-access screen from their project CRM
through “Доступы клиентов”. The existing master Access section remains available.
New clients granted by team members receive client_viewer memberships in the
team member's assigned projects only. Role assignment and other scopes stay
admin-only. Existing memberships keep their prior roles; administrator-created
accounts retain their prior default behavior. No existing production accounts
or grants were rewritten, and no invitation messages were sent.

Read-only client memberships now participate in project visibility and identity
authorization. The central signed-identity authorization path denies project
mutations with read_only_access, including routes that historically accepted a
viewer for CRM operations. CRM context disables editing and monthly-report
permissions disable results editing for these readers. Team/client scope
revocation, shared-client grants and existing manager behavior remain covered.

Validation: 316 automated recovery cases passed during implementation, followed
by focused checks after final changes. Six final browser scenarios passed:
desktop/mobile competitor presentation, administrator role assignment, team
client creation/invitation, assigned/unassigned/client visibility and the CRM
access shortcut. Synthetic fixtures test lossless trailing sections, escaped
content, separate source links, comparison fields and scoped reader denial.
The actual saved Reviews Plus payload was previewed locally at widths 1440,
1920 and 390; all six competitors and trailing sections are present with no page
horizontal overflow. Screenshot inspection caught and corrected inherited
nowrap table cells and heading styles. This is not a production-login session.

Published Worker: 4308e327-0424-4281-a50e-2ed5f6b02ffc (100%).
Previous Worker: 996d31a1-989d-47ce-b179-12b1f13b0020.
Pages routing registry remains compatible; no new project routes were added.
