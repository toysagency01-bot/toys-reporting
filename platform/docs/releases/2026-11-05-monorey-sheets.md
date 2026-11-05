# Monorey daily Sheets mirror

Monorey's direct Meta importer continued updating D1, but no process mirrored
those snapshots into the existing client reporting Sheet after October 15.

The existing `MetaAds` tab was backfilled for October 16–November 5: 57
campaign/day rows in `A296:K352`. The first 295 rows and the other tabs were
preserved. Every inserted value was read back and checked, including blank
conversion value cells. Preparing the same capture again produced zero writes.

Two standalone helpers implement the one-way mirror:

- `scripts/export-monorey-sheets.py` reads only this project's fresh, complete
  D1 snapshots and reconciles account/campaign daily totals.
- `scripts/prepare-monorey-sheets.mjs` validates the exact workbook, tab, headers
  and account, preserves historical rows, and prepares bounded current-period
  updates without touching other sheets, formulas or structured cells.

An enabled daily automation was created and read back with the inherited cloud
environment and Asia/Tbilisi timezone. Its self-contained prompt embeds the
standalone helpers, uses connected Google Sheets tools, verifies writes and
reports failures. A future execution is not implied to have succeeded yet.
This export is scoped only to Monorey; it does not enable any Profkit export.

Data captures and connector responses are kept outside Git. The source D1 data
is unchanged. Regression checks cover historical preservation, exact project
scope, structured-cell refusal and idempotence with Google's omitted blanks.
