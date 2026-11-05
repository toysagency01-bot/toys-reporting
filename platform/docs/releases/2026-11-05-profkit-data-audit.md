# Profkit source audit and correction

The dashboard previously read an intermediate `InstashopSales` table that mapped
the client's `Ціна` (price) row to unqualified inquiries. Adding that price to
`Заявки` inflated Direct inquiries and invented a qualification split. The
intermediate copy also lagged actual Instagram orders and revenue.

The business importer now reads the original client's monthly tabs directly:
Instagram orders from row 3, Instagram revenue from row 12, and Direct inquiries
from row 20. Website orders/revenue and the duplicate inquiries total remain
separate. The price row is never a count. Blank cells remain unknown; quality
metrics remain unknown because this source does not record qualification.

Monthly labels, date alignment, numeric types and monthly control totals must
validate before publication. Failed reads preserve the last sealed release.
The new original-workbook source uses its own source ID, preserving the old
source and sealed generations. Business-only refreshes preserve advertising,
project materials and dashboard settings.

The advertising adapter retains confirmed daily USD/UAH rates across period
changes. A missing rate hides unavailable UAH costs while current clicks and
impressions continue updating. Incomplete business periods do not display ROAS
or cost per sale as though every day were complete. Unknown qualifications and
their conversion rates display an em dash.

Validation on 2026-11-05:

- Original March–November monthly sheets reconciled for 226 calendar days.
- All five business fields on every published day matched the authenticated
  source capture, including unknown values.
- Independent Meta account reconciliation matched 29 completed days for the
  replacement account. The combined model also reconciled archived and new
  account campaign/day expenses against account totals.
- The archived account's frozen 81 snapshots remained unchanged.
- 352 recovery tests, the Instashop model suite and three focused desktop/mobile
  browser checks passed before release. Separate Monorey helper tests also pass.
- Published Worker `4409adb4-5c4d-41cc-a0a2-22a58e37cb7a` was downloaded and its
  module hash matched the tested bundle. The 226-day business correction was
  published and read back after that deployment.

The initial corrected publication used an authenticated Google Drive cell
capture. The deployed scheduled reader uses bounded public CSV requests to the
original workbook. Its first subsequent live execution succeeded at
2026-11-05T11:40:38Z, reading the original monthly business source and FX.

Private source captures and reconciliation receipts are outside Git. No Google
client spreadsheet, account campaign, credential or archived snapshot was edited.
