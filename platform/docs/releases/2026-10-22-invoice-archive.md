# Historical invoice import — 2026-10-22

Desktop Documentation now includes an administrator-only XML/ZIP importer and a
searchable archive. The preview groups source buyers for explicit project mapping;
unmatched/retired clients stay in the private archive. Assigning a client from the
archive links its remaining valid invoices. XML transfers numbers, issue/due dates,
parties, payment details, service positions, taxes and source status. ZIPs provide
original PDFs; files without matching source IDs are reported rather than guessed.

Source account/record IDs and financial/source fingerprints deduplicate retries.
Changed source data, existing project invoice numbers and differing originals do
not overwrite saved documents. Unsupported calculations retain source data and
original files, with an explicit review marker. Provider sharing tokens are omitted
from stored metadata. Importing a historic invoice does not infer that it was paid.

Original PDFs use the existing private R2 binding and remain separate from PDFs
regenerated from source data. Assigned team members can view/download their project
invoices; clients cannot access documents. Import, archive and cross-project source
records require administrator access. Historical invoices are immutable and can be
duplicated into independent editable drafts. Downloads, navigation and the compact
paper view were checked in the desktop browser.

Each project also has an administrator-editable payment method (invoice, crypto,
mixed or unspecified) and a note. Existing saved requisites are never overwritten
by imports; empty defaults use the latest verified record. The authorized initial
HOUSEVIP migration explicitly uses Secretum requisites for services, retaining
Sachkov budget invoices separately in the history.

Migration 0032 adds archive, source mapping and billing profile tables only.
The authorized uploaded XML contained 159 invoices dated 2025-10-01–2026-10-16.
All 159 records were imported; 65 linked to seven current projects:

| Project | Invoices |
| --- | ---: |
| AM Klinika | 2 |
| BSCLINIC | 12 |
| Europisol | 11 |
| HOUSEVIP | 4 |
| Monorey | 12 |
| MurMur | 11 |
| Taycher | 13 |

The remaining 94 records are retained in the administrator archive without a
project assignment. The two ZIPs contained 50 original PDFs. All 50 were uploaded,
downloaded back from R2 and matched against the source SHA256 and byte count.
Source currency totals matched D1 exactly: EUR 65,937.00; USD 30,529.94;
GBP 7,850.00. Every number and currency appeared in its matching PDF. One source
invoice includes zero-quantity informational positions; its complete source record
and original PDF are retained without coercing it into the editable invoice model.

Seven project requisite sets were filled. Crypto notes were set for PROFKIT
Instashop, VISA Agency and Karlovarska Sul. Wedoprofi is marked invoice-based with
an explicit note that its legal entity was not identified in the supplied XML.
No placeholder invoice or unverified requisite set was created for those projects.
17 projects, 3,344 leads, 13 weekly reports, 12 monthly reports and 1,031 CRM
milestones were unchanged by the import. No source invoices were marked paid.

Validation: 226 automated tests passed; three desktop browser scenarios covered
normal invoices, permissions/unsaved edits, XML/ZIP preview, mapping, source PDF
byte equivalence, immutable historic view, archive navigation and crypto billing.
The complete real import plan was replayed twice in local SQLite without duplicates.
Browser QA used the built local Worker and Pages gateway, not production browsing.
Production data verification used Cloudflare D1 and private R2 readback.
Private source exports, mapping plan, PDF checks and receipts stay outside Git.

Implementation: `188954d`, `6e9c7bd`.
Active Worker: `c30f0443-0e53-4ea4-8bda-b77341e614ae` (100%).
Worker SHA256: `f409afeb9d70a58b0b58b4377e84e0adc27b1ef9ac227556df145793f5409e3d`.
Pre-feature rollback: `310f7887-defe-402b-8651-e32a352d96b1`.
Leave archive/invoice tables and R2 objects in place on rollback; never delete
financial records as part of code rollback. The preceding Worker lacks archive
immutability enforcement, so financial editing should be paused if rolling back.
