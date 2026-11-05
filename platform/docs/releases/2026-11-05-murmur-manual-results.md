# MurMur manual leads and bookings

MurMur now has a project-dashboard button **Лиды и записи**. The form contains
only a date, additional lead count and booking count. Existing values load when
a date is selected. Saving the same date replaces its values, and entering zero
removes that metric's contribution without deleting audit history.

Manual leads are added once to Meta's reported leads in the selected period.
The overview, daily lead chart, lead funnel, campaign totals and master summary
use the same additional count. Campaign details show an unassigned manual row;
counts are not assigned to individual campaigns, ads, CRM qualifications or
contacts without attribution identifiers. The existing 674 historical CRM
contacts are not automatically counted again.

The main dashboard has **Записи** and **Стоимость записи** cards. Booking count
is the sum of manually entered bookings for the selected dates. Cost per booking
is the same-period CZK advertising spend divided by that count. Zero bookings or
unknown spend display an em dash for cost. Bookings can be entered independently
of additional leads. The master project summary also shows these metrics.

Only admins and assigned team members can write. Clients can view the results.
Migration 0042 adds a separate project/date table, version guards, retry keys and
audited writes. No Meta metric, CRM contact, campaign, role, credential or CAPI
configuration is changed by saving counts. Concurrent stale saves are rejected;
a lost acknowledgement can be retried without duplicating data. No example
business counts were inserted into the deployed database.

Scope is only `murmur-up8m` / `prj_murmur_up8m`. Its verified Meta source remains
account `844818919266098`, CZK, Europe/Prague. The traffic filter lists the actual
Meta source. Browser caches are invalidated after saving and the overview updates
without a page reload.

Validation: 364 recovery tests passed. Four browser scenarios cover desktop and
mobile create/edit/zero flows, bookings without extra leads, lost-response retry
and client read-only access. Synthetic example: 5 Meta leads plus 8 manual leads
becomes 13, while CZK 1,000 spend and 2 bookings gives CZK 500 per booking. These
figures are test fixtures, not customer data.

Published Worker version: `a6950f0a-7d0e-469e-9e51-2316ab16439a`.
Post-release read-only verification exercised the normal advertising service
against working D1, including manual count/booking aggregation. The downloaded
active Worker module matched the tested bundle; the existing Meta integration
identity, currency, timezone and status were unchanged.
