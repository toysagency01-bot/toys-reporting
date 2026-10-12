# History migration: capture, reconciliation and safe resume

Scope: HOUSEVIP, Karlovarska Sul and PROFKIT Instashop. This is step 1 of
removing Sheets as the platform's source of truth. Source switching and editing
remain separate steps. Do not disable the current sync after this archive import.

## Capture and verification

Private working directory: `/workspace/toys-history-20261012`, outside Git.
Captured through the authenticated Google Drive connector, not a public export.
All 103 tabs from six workbooks were captured between 18:08:41 and 18:10:48 UTC
on October 12, 2026. Subsequent Drive metadata reads report modification times
earlier than that window. This is a bounded capture window, not a cross-workbook
transaction or a promise that the sources will remain unchanged.

The capture contains 7,423 returned row positions, 79,512 nonempty CellData
objects, 2,045 formulas and 458 explicit cell hyperlinks. Plain-text URLs and
rich-text links are also preserved. Cell formulas, evaluated values, display
values, notes, links, tab visibility and workbook timezone are retained. The
capture is not a visual XLSX backup: full formatting, merged cells, binary images
and files behind links were not downloaded.

All 103 snapshots passed local SQLite restoration and SHA-256 readback. The
production archive excludes two lead/contact and feedback tabs: 101 snapshots,
103 compressed JSON pages, 7,312 row positions, 78,821 nonempty cells, 1,990
formulas and 458 explicit hyperlinks. Reapplying the same bundle wrote zero rows. Synthetic tests cover
interrupted imports, tampering, repeated capture, project boundaries, and
concurrent content edits.

## Initial reconciliation

Compared the captured source with a readback of the three active release
manifests: 3,157 observations and 15,341 metric values. Monetary values were
compared exactly within each source/currency, without combining account and
campaign views.

| Dataset | Source rows | Active platform rows | Missing | Changed |
| --- | ---: | ---: | ---: | ---: |
| HOUSEVIP Meta | 21 | 21 | 0 | 0 |
| PROFKIT Meta | 1,636 | 1,636 | 0 | 0 |
| PROFKIT sales | 201 | 201 | 0 | 0 |
| PROFKIT exchange rates | 201 | 201 | 0 | 0 |
| Karlovarska Google | 693 | 677 | 16 | 0 |
| Karlovarska Meta | 70 | 61 | 9 | 2 |
| Karlovarska e-commerce account view | 158 | 152 | 6 | 0 |
| Karlovarska e-commerce campaign view | 222 | 208 | 14 | 0 |

Karlovarska's 45 missing observations are dated October 9–11; the two changed Meta
observations are dated October 8. No observations exist only in the active
platform release. Existing missing-currency classifications are retained.

Six existing period reports match their source. HOUSEVIP's September 1–30 report
is missing. The content plan prepares 16 existing material tabs whose display
content differs plus the missing HOUSEVIP October Stories tab and September
report: 18 operations. Display differences include formatting changes and should
not all be interpreted as missing business data. Native content revisions are
separate and are not overwritten.

Earlier PROFKIT monthly sales tabs are archived with their original titles and
lineage. Years for ambiguous early tab names and attribution to the current
Instashop project are not guessed. Backup/staging copies are not counted as new
metrics. Lead/contact sheets and feedback remain **local only**, excluded from
the production archive. Hidden historical business copies are archived privately
and are not added to public material routes.

## Production rollout

Cloudflare initially rejected migration 0016 with HTTP 400 / code 7500 (daily
row-write quota). Later in this run D1 accepted writes. No billing plan change was
made by this task; the reason writes resumed was not established.

Automatic approval review rejected uploading the original full archive because
it included personal lead/contact data outside this history-migration scope. The
safe replacement excludes both lead-related tabs and rejects contact/credential
markers on preparation and upload. That replacement was accepted and applied.

Production now contains all 101 allowed snapshots, each sealed after full
readback. All 18 content operations were applied and an independent repeat
preflight reported 18 already current, zero pending. The bundle SHA-256 is
`2156cd2e78c978e52ef1fd55f71f8aec8384e9c5faf52c704fd64909ccd16c85`.

Worker `870f7ed3-1605-4d49-8b12-ea810dd78f20` is deployed at 100%. Rollback version:
`de84a872-b68c-45d7-b4bf-417aa1811412`.

The scheduled sync had not produced a new release by the final check. A scoped
metrics importer therefore staged and verified Karlovarska's four generations
from the captured source. It published a new composite release with a pointer
compare-and-swap, without touching project settings, dashboard configuration,
CRM, materials or native editor revisions. The legacy GViz stream identity and
normalization are retained; the actual capture transport is the Google Drive
connector, recorded by the private source archive.

Final D1 readback finished at **18:44:36 UTC**. All **3,202 observations and 15,586
metric values** match the captured source: zero missing, changed or platform-only
observations across all eight source streams. All **30 allowed public material
tabs and seven period reports** match. The three native content items, their
existing revision and block are byte-for-byte unchanged. Source history step 1
is complete for business materials and reporting; the excluded personal lead
tabs are not part of this migration. Source switching remains a later step.

The runtime fix allows the legitimately empty Karlovarska monthly Google report,
which previously aborted the whole import. Advertising tables still require
their normal schema and nonempty source. A narrow privacy-parser fix accepts
valid report date ranges such as `01.09.26 - 30.09.26` while preserving contact
checks. HOUSEVIP's October Stories tab is explicitly allowlisted; lead tabs are
still excluded.

## Repeat or resume safely

Run from `platform/`. Keep raw captures, plans, local databases and audit outputs
outside the repository. No client records should be committed or uploaded as
public Worker assets.

1. Recheck source modification metadata and current D1 release pointers. If a
   source changed, recapture it and rerun reconciliation. Do not replace a newer
   platform revision with a historical capture. Keep the existing private backup.
2. Prepare and validate the immutable archive:

   ```sh
   python scripts/source-history.py prepare --root /workspace/toys-history-20261012
   python scripts/source-history.py apply --root /workspace/toys-history-20261012 --cloudflare
   python scripts/source-history.py verify --root /workspace/toys-history-20261012 --cloudflare
   ```

   The importer creates only migration 0016's private tables. It verifies page
   hashes and the reconstructed source hash before marking each snapshot complete.
   An interrupted import is resumable. Complete snapshots are never overwritten.

3. Reconcile current materials with the saved source, then preflight/apply the
   prepared plan:

   ```sh
   node scripts/reconcile-source-history.mjs /workspace/toys-history-20261012
   python scripts/apply-history-content.py /workspace/toys-history-20261012 --cloudflare
   python scripts/apply-history-content.py /workspace/toys-history-20261012 --cloudflare --apply
   ```

   Default mode is read-only preflight. Apply requires a verified archive. Existing
   rows use a comparison of every original field in the SQL predicate; concurrent
   edits stop the import and remain intact. Missing reports are inserted by period;
   existing reports are immutable. It does not change CRM, project settings,
   native content revisions, memberships, or release pointers.

4. Prefer the normal Karlovarska sync with the empty-report fix for future data.
   To resume this particular historical import from its verified capture:

   ```sh
   node --use-env-proxy scripts/import-history-metrics.mjs /workspace/toys-history-20261012 --cloudflare
   node --use-env-proxy scripts/import-history-metrics.mjs /workspace/toys-history-20261012 --cloudflare --apply
   ```

   Preflight is read-only. Apply requires the source archive, a nonregressing
   date/account/currency scope, and the expected release pointer. Generation
   readback must match exactly before publication. Repeated execution recognizes
   the active generations and performs verification only. Do not run the old
   destructive HOUSEVIP import or overwrite a newer release from a stale capture.
5. Export the new state without replacing the original backup, then reconcile:

   ```sh
   python scripts/export-history-readback.py --root /workspace/toys-history-20261012
   node scripts/reconcile-source-history.mjs /workspace/toys-history-20261012 platform-after
   ```

   The exporter pins the three active release manifests and rejects a pointer
   change during readback. After reports and metric comparisons pass, compare
   native content revisions with the original backup before marking step 1 complete.

Local validation commands:

```sh
python recovery-tests/source-history.test.py
node recovery-tests/history-sources.test.mjs
node recovery-tests/backend.test.mjs
npm run unified:build
```
