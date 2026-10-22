# Documentation usability and shared field focus — 2026-10-22

Invoice rows now open by clicking their non-interactive cells or pressing Enter/
Space while the row is focused. PDF and duplicate actions retain their own behavior;
selecting/copying table text does not open an invoice. A project-scoped search
queries the full saved list by number/customer, with explicit empty, retry and
clear states. Returning from an invoice restores the loaded pages and row focus.

The import archive uses compact buyer names in its list, retaining full details
in the source/preview. Project assignment controls expand on demand. Every archive
row, including an unassigned source record, opens a document dialog with source
PDF/generated PDF distinction and download actions. Escape closes it and restores
row focus. Downloads and temporary failures remain inside the dashboard.

The desktop invoice editor has shorter fields, tighter spacing, a smaller natural-
height paper preview and a sticky action toolbar. Optional discount/tax/notes are
collapsed when empty and expand when populated. Payment-method notes are compact;
PDF/source actions do not break words across lines. Light-theme links have darker
text contrast. The original invoice source and financial model were not changed.

One shared form-field stylesheet replaces the offset second outline with an inset
keyboard indicator on the existing field boundary. It is included in login/
activation, the master cabinet, native dashboards and the client CRM shadow root.
The password visibility control has reserved text space. Keyboard focus remains
visible, including forced-colors mode; button/link focus behavior is preserved.

Validation: 226 automated checks and nine desktop browser scenarios passed. Browser
coverage includes create/save/defaults, calculations, Unicode PDF download, assigned
staff/client permissions, unsaved edits, XML/ZIP import, source PDF byte equivalence,
archive preview/download/focus, 61-row pagination and return, search/clear, network
failure recovery, list duplication, line editing, automatic save before PDF and
cancelled/confirmed draft deletion without changing the source. Login focus was
checked with mouse, Tab and password visibility; native campaigns and embedded CRM
were checked separately. Desktop screenshots at 1366x900 and 1536x1100 and mobile
login at 390x844 were reviewed. A detached search-input event found during QA was
fixed and the full browser suite rerun without page errors.

Browser tests ran against the locally built Worker and Pages gateway. Deployment
was verified through Cloudflare; this is not a claim of production browser QA.
Production readback retained 65 project invoices, 159 archive records, 50 originals
and seven saved requisite sets. No migration or financial-data write was required.

Implementation: `1bcecdc`.
Worker: `1b97f69e-ddab-4cca-b690-2d74aa4bdc7c` at 100%.
SHA256: `92f0332f0052252a46ce3525697cbf7a2dfa7047d141e9c03a17604dd0cce7e4`.
Rollback: `c30f0443-0e53-4ea4-8bda-b77341e614ae` (leave all invoice data intact).

Hover follow-up (`45a968b`): the shared dashboard `tr:hover td` rule applied a dark
background to white invoice paper while its description text remained dark. The
issue was reproduced in the browser before the fix. Invoice paper cells now retain
a white background in both themes. All ten browser scenarios passed, including
hovering description/header cells in the editor, historical invoice and archive
popup, plus description textarea readability. Screenshots were inspected locally.
Updated Worker: `268c1e64-37ef-4713-83f6-6a79db98f5ef` (100%).
SHA256: `95c16c715658bf3c7f24fb3fe8827ec40e60811386b452b609d3f78b9c7738b0`.
Follow-up rollback: `1b97f69e-ddab-4cca-b690-2d74aa4bdc7c`.
