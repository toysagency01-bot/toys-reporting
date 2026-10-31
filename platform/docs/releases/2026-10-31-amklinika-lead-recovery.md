# AM Klinika missing current-day leads

The user reported missing leads for 31 October. Production Worker bindings were
verified against D1 `0539d3d9-844e-470e-af6e-ae256fe4c81f`. The project had no
`crm_meta_sources` row, no linked `crm_pages` row and no delivery jobs. Existing
leads were historical project-sheet imports, newest 15 October. Project settings
still marked Meta intake as `pending_authorization`.

The connected project workbook was read without modification. Its four Meta
intake tabs and website intake date column were checked. Three Czech-mechanic
form leads belong to 31 October in the project's Europe/Prague timezone; all
three were absent by exact Meta lead ID. One source timestamp says 30 October
with offset -05:00, but represents 31 October in Prague.

`scripts/recover-amklinika-current-leads.py` validates source/date/contact presence,
checks all source identities including tombstones, and inserts only absent leads.
The three verified source rows were recovered. Initial status events and audit
records were added; no qualification, sale or CAPI event was generated. A hash
comparison confirmed all preexisting lead statuses, metadata and tombstones were
preserved. Re-running the plan finds three present and zero missing. Contacts
remain outside Git in a private workspace capture.

`scripts/configure-amklinika-live-leads.py` uses the project's saved page/app IDs
and its existing active Meta account. It requests normal verification in the
existing worker, without marking the source connected or supplying a token.
The normal connection routine must verify page/app identities, lead-read access,
and callback ownership before linking credentials or subscribing the page.
Only current-day live intake is requested; older history is not automatically
replayed. Existing user roles, secrets and CAPI settings remain unchanged.

No Worker release or source workbook write was needed for recovery.

The normal connection attempt at 09:14:12 UTC failed with Meta error #10. The
provider specifically required `pages_read_engagement` (or its public-page
feature alternatives); the saved diagnostic contains no credentials or contacts.
Source state is `error`, connected_at remains null. Normal bounded retries stay
in place. Automatic lead intake is NOT claimed as working. The Meta administrator
must review app permissions and access to the AM Klinika Page, then retry the
normal project connection. Full comparison with Meta is blocked by these rights;
only the three current-day records observed in the source sheet were reconciled.

Final D1 readback confirms three active leads in the Europe/Prague current-day
window. Existing source sheets were unchanged; no Worker deployment was required.
