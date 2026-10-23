# Common invoices and saved clients — 2026-10-23

The master Documentation entry now opens a common invoice list across accessible
projects. It includes imported source records, including those without a project
assignment or requiring source-data review, alongside manually created invoices.
Linked imported invoices appear once. The common list defaults to All dates;
Recent and Archive filters, search and 50-row pagination remain available.
Explicit project links continue to open that project's documents.

Rows open by click or keyboard. Linked invoices retain project-scoped preview,
duplicate and download routes; unassigned sources open the existing read-only
dialog. New invoices from the common list ask for a project. Duplicating an
unassigned source asks for a destination project and prepares an unsaved current
draft without changing its original. The import-management view has a return
button to the common list.

The editor includes a native saved-client dropdown. Presets come from the latest
import for each source client, plus distinct saved/default/manual buyer details.
Full buyer addresses, tax IDs and contacts are retained, including source-only
buyers whose financial data cannot be regenerated. Selecting a client fills only
the buyer requisites: issuer, bank details, currency, dates, items and amounts are
unchanged. Custom buyer details remain editable. Historical invoices retain their
snapshots and remain read-only.

Both new read APIs enforce staff scope on the server. Administrators can see all
sources; team members see clients and invoices from assigned projects only, and
clients cannot use the endpoints. Lists omit complete source JSON, issuer/bank
details and attachment keys. PDF data is requested only for explicit downloads.
No migration, invoice rewrite, new access grant or file deletion is involved.

Validation: build succeeded; 230 automated checks and 12 desktop browser scenarios
passed. Coverage includes common-list deduplication, source-only records, exact
totals, pagination, date filters, team/client permissions, latest-client details,
dropdown substitution without changing other fields, creation/duplication,
defaults versions, original downloads, keyboard focus, project-picker cancellation,
return navigation, error recovery and description hover in both themes. Screenshots
of the common list and client form were visually reviewed. Browser QA used the
local built Worker and Pages gateway, not a production browser session.

Read-only execution of the new catalog against production D1 returned all 159
imports without duplicate rows, including 65 linked records and one source-only
record; the client selector returned 37 distinct requisite presets. Post-deployment
counts remain 159 sources, 50 original PDFs, 65 project invoices and seven saved
project requisite sets.

Implementation: `0bad34f`.
Worker: `ce8fa292-6751-4fbf-a7ff-8b3aec27a25e` at 100%.
SHA256: `19f98fa1fb071dcfa8d712cb51bf4fd37094687ed4a64159f5fc7078bc51b347`.
Rollback: `50d7db86-ecc8-4610-abb9-6eed42f0ee17`; preserve all financial records.
