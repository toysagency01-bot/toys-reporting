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

## Manual conversions follow-up

The user clarified that `MetaAds!J:J` is manually maintained. Four existing
campaign/day cells for October 30–November 2 had been changed from zero to two.
The automation was paused before further writes, then updated and re-enabled
with a new self-contained helper that writes A:I only. It preserves existing row
positions, J:K values/formulas, and rows absent from Meta. Fresh preparation
against the edited Sheet produced zero writes.

The platform now stores versioned, project-scoped Report Sheet conversion
snapshots in migration 0041. The initial capture of all 351 populated source rows
was imported and read back. Explicit numbers, including zero, replace Meta's
campaign/day conversion count; blanks fall back to Meta. They are not added to
Meta a second time. Expenses, clicks and impressions remain direct Meta data.
Raw advertising snapshots are unchanged. Manual counts are not assigned to
groups, ads, qualifications or individual CRM records without source identifiers.

The ordinary reporting refresh slots now read this one bounded Google CSV source.
Invalid schemas, wrong accounts, ambiguous campaign/day rows and failed reads
preserve the previous snapshot. The UI identifies the Report Sheet basis and
warns when the last read failed. An older capture cannot replace a newer pointer.
The first live scheduled execution of this new Monorey reader remains pending
at the time of deployment; the initial import used authenticated connector data.

Validation: 359 recovery tests and a desktop/mobile browser scenario passed.
Comparing actual stored Meta data for October 30–November 2 with the manual
source changed conversions from 5 to 13 (+8), with identical expenses, clicks
and impressions. Source matching uses date, account and exact campaign name;
ambiguous names are not guessed. Worker version
`c5696981-3321-4604-b90e-6571bd423ffc` contains the new reader and overlays.
