# Invoice age archive — 2026-10-22

Project documentation opens on invoices from the last two calendar months.
Recent, Archive and All tabs provide access to the same saved invoices without
moving or deleting records or files. Search selects All so historical invoices
remain discoverable. Older invoices retain their detail, download and duplicate
actions. Duplicating creates a current draft and returns to the recent list.

The cutoff uses today's Tbilisi date and clamps the day at the end of shorter
months. The API defaults to All for existing callers; the interface explicitly
requests its selected period. Lists now read only summary data: full requisites,
source JSON and attachment keys are fetched by the protected detail/download
routes. Financial calculations and original PDFs are unchanged.

Production storage inspection found 50 PDFs totaling 1,008,086 bytes, each about
18–24 KB. Neither the list nor HTML preview downloads those files. R2 has no
completed-object expiration rule; its only lifecycle rule aborts unfinished
multipart uploads. No cold-storage migration or destructive cleanup was needed.
For the same 50 source records, the internal D1 list result dropped from 422,535
to 22,156 bytes (94.8%). This measures query result size, not page speed.

Validation: build succeeded, 227 automated checks and all 11 desktop browser
scenarios passed. Coverage includes end-of-month/leap-year boundaries, recent/
archive/all filtering, old-invoice search, permissions, original PDF equivalence,
detail/duplicate access and zero PDF requests until explicit download. The
compact table and filter states were visually reviewed. Browser checks ran
against the local built Worker and Pages gateway; production deployment and
read-only data counts were checked through Cloudflare.

Post-deployment counts: 159 source records, 50 originals totaling 1,008,086 bytes,
65 project invoices and seven requisite sets. No migration or invoice data write.

Implementation: `c52fa74`.
Worker: `50d7db86-ecc8-4610-abb9-6eed42f0ee17` at 100%.
SHA256: `bb5115286cd14b74e605c4fc2fa811f335beb4b178504dd0ae3140b2042768eb`.
Rollback: `268c1e64-37ef-4713-83f6-6a79db98f5ef`; retain all invoice data.
