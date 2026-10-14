# Seven-project rollout — 14 October 2026

Approved scope: publish Taycher, Europisol, Monorey, MurMur, VISA Agency,
Wedoprofi and AM Klinika. Tyver remains excluded. Cloud Run, Karlovarska and
PROFKIT source configurations were not changed. Make intake and CAPI activation
remain separate work.

| Project | Public report | Historical campaign rows | Material tabs | CRM contacts | Archived source tabs |
| --- | --- | ---: | ---: | ---: | ---: |
| Taycher | https://reports.toys-agency.com/taycher-5pxk/ | 312 | 9 | 302 | 23 |
| Europisol | https://reports.toys-agency.com/europisol-tckt/ | 142 | 6 | 0 | 9 |
| Monorey | https://reports.toys-agency.com/monorey-acdk/ | 288 | 42 | 678 | 56 |
| MurMur | https://reports.toys-agency.com/murmur-up8m/ | 199 | 59 | 674 | 71 |
| VISA Agency | https://reports.toys-agency.com/visa-agency-qa3b/ | 700 | 16 | 34 | 23 |
| Wedoprofi | https://reports.toys-agency.com/wedoprofi-p8x4/ | 0 | 4 | 0 | 6 |
| AM Klinika | https://reports.toys-agency.com/amklinika-k8m2/ | 31 Meta + 109 Google | 8 | 63 | 24 |

Total: 1,781 historical campaign rows, 144 material tabs, 1,751 contacts,
212 archived tabs in 233 verified pages, and 4 weekly reports.

## Data and imports

All seven project configurations now use D1 for dashboard history, materials,
weekly reports and CRM. The source spreadsheets were read and left unchanged.
Meta imports are active and use the verified account currency and timezone.
AM Klinika's existing Google receiver/import configuration is preserved.

The latest inspected successful import cycle was 06:40 UTC on October 14 for
all seven Meta integrations and AM Klinika Google. Independent account-level
Meta API reconciliation matched spend, impressions, clicks and configured lead
actions against ad-level totals on all 29 completed account-local days, for all
seven accounts. This does not certify an unobserved Ads Manager column setup,
attribution selection, or the still-changing current day.

Wedoprofi's last 31 stored account-local days have no campaign activity. Empty
history is valid: its dashboard still initializes, and CRM/materials remain
accessible without invented campaign rows. Monorey's reporting timezone is
America/Los_Angeles, so its current account date can differ from Tbilisi.

Existing cadence is preserved: every 20 minutes during the day, hourly from
00:00 through 09:00 Asia/Tbilisi. Historical source rows are retained separately
from newer daily provider snapshots, without re-importing the source books on
page visits.

## CRM and source preservation

Taycher uses the agreed real-estate pipeline. AM Klinika uses its existing
13-stage automotive workflow; its legacy completed-work status maps to
"Завершён". Other projects use the general pipeline.

Historical received dates use typed Sheets values where present and source
workbook timezones for naive timestamps. Original statuses, source coordinates,
comments and available feedback are preserved. Meetings/appointments are not
silently classified as qualified property viewings or sales. Historical sales
without documented amounts do not create invented revenue.

- Monorey: two exact repeated source records merged; three source rows lacking
  a usable date/contact retained only in the archive.
- MurMur: thirteen malformed/non-contact source rows retained only in the archive.
- AM Klinika: one Meta row has date `0` and remains archived. 62 feedback records
  matched contact rows; six feedback records without their contact rows remain
  archived. They were not manufactured into contacts.
- VISA: 11,360 source analytics rows have no contact/unique lead identity and
  remain archived statistics, not CRM leads.
- One credential-marked service cell in VISA's work plan is omitted from both
  the database archive and public materials; its source hash/location are
  recorded privately. The original source is untouched. Embedded email
  addresses in public business reports are masked; private archives retain
  the business history apart from the marked service cell.

No historical CAPI deliveries or conversion milestones were created. All seven
CRM connections remain CAPI-disabled until intake/optimization is configured.
CRM records require project membership; public reports cannot read CRM.

## Implementation and validation

- `prepare-rollout.mjs` normalizes bounded source captures, validates account,
  currency and tab identities, and generates deterministic releases.
- `import-rollout.mjs` stages/reconciles generations and materials before
  publishing release/config pointers. Existing edits are not overwritten.
- `restore-rollout-leads.py` restores private contacts with stable source
  identities and preserves existing status changes/deletion tombstones on retry.
- `archive-rollout.py` seals private CRM/business source snapshots using explicit
  project scope and hash-verified archive pages. The older business-only archive
  command retains its original contact/credential restrictions.
- The lead-generation dashboard reader supports separate Meta/Google history,
  native currencies, public field filtering and confirmed empty releases.
- Bootstrap accepts a valid empty period, including when the initial legacy
  period predates today's first campaign activity.

Validation: 88 backend/runtime tests and three migration tests passed. Seven
actual-data browser checks passed for dashboards, CRM and all 144 material
endpoints; unauthenticated CRM reads were rejected. Mobile empty-state check
passed at 390px without horizontal page overflow. The existing 33 browser
scenarios passed across the full run plus targeted rechecks: two test timing
issues were corrected (wait for the create modal to close before background
search; keep the BSCLINIC fixture inside its rolling seven-day window).

Production D1 readback reconciled each generation/material, all imported contact
identities and all 212 sealed archive snapshots. Nine out-of-scope project
configurations and all protected integrations were compared with the preflight
backup and remained unchanged.
The Worker routes were also exercised against production D1 through a read-only
adapter: all seven board/dashboard/material routes returned 200; all anonymous
CRM requests returned 401.

## Deployment and recovery

Active Worker version: `b5c7d912-bf04-4d8e-b400-72a2df083004` (100%).
Previous version: `cbde50c0-b740-4fce-a92a-72a4f0319c11`.
Worker SHA-256: `26585fac54f7ff6745908f5da62850308c48c6f85e1d6563fe5d29fb5b728f27`.

Cloudflare deployment readback and downloaded module bytes match the tested
bundle. Existing bindings, secrets, authentication settings and assets are
preserved; only the seven project IDs were added to the four publication scope
lists.

The initial Worker-only rollout missed the Pages gateway deployment. The
gateway's deployed registry contained the original four projects, so the seven
new short URLs fell through to the frozen legacy site and returned `not_found`.
Source-level routing tests and direct Worker checks did not cover that layer.

Corrective Pages deployment: `31d70bf8-a60f-49cc-97d6-5fa75778e850`, successful at
07:09:26 UTC on October 14. Cloudflare confirms it is the canonical production
deployment for `reports.toys-agency.com`; both service bindings are unchanged.
Previous Pages deployment: `c19b88b4-475a-4d54-b6b4-515f62137377`.
The deployed gateway was rebuilt with all eleven registry entries. Its bundled
routes were exercised through the current Worker and read-only production D1:
all seven new board/dashboard/material routes returned 200; anonymous CRM reads
returned 401. No database or advertising import settings changed in this fix.
An AM Klinika browser check against the same bundled gateway and captured data
rendered the dashboard and opened CRM with contact cards, without JavaScript
errors. Gateway verification evidence is in `/workspace/toys-routing-20261014`,
outside Git.

`unified:build` now builds the Pages gateway too. The compiled-bundle regression
test rejects stale output and verifies every registered short, index and legacy
project route, including query assets. For future project publication, both
layers must be deployed: publish the Worker, then run
`CLOUDFLARE_ACCOUNT_ID=6e1e68500c0dc88e70dde2da4117c79d npm run pages:gateway:deploy`
from `platform`. This command rebuilds and tests the gateway before deployment.
Do not use the old `pages:deploy` static-site command for this gateway.

The managed environment allows Cloudflare API but not the public report host.
Browser checks therefore used the tested bundle and captured production data
locally. Deployment verification uses Cloudflare API; it is not an independent
external HTTP/TLS smoke test of the Pages domain.

Private captures, database backups, readback evidence and quarantined source
coordinates are in `/workspace/toys-rollout-20261014`, outside Git. Never commit
these files. To revert the UI release, redeploy the previous Worker version
using `release-unified.py deploy PREVIOUS EXPECTED_CURRENT`. Leave migrated data
in place; do not delete contacts or overwrite subsequent client changes.
