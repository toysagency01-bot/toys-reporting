# Profkit USA 2.0 replacement — pending Meta access

The user requested future imports from 1736244500266269 (Profkit USA 2.0), with
old 394051718160331 history preserved. The target is the working dashboard
profkit-instashop-r4vk; the unrelated Profkit draft was not changed.

Prepared the replacement as pending metadata verification, never active in
reporting. Existing source remains active. Meta returned provider_unauthorized,
provider code 200, at 10:36 UTC. Currency/timezone could not yet be verified;
therefore no expense import or account switch is claimed. The account needs
access assigned to the same integration identity/partner used for the old one.

All 81 old snapshot rows (including the retained earlier timezone scope) remain
with identical content hashes as the private before capture. Historical facts
from 25 March, source generations, sales and exchange-rate data are preserved.
The initial proposed parallel-active registration and later premature old-source
disabling were rejected by automatic approval review; neither command executed.
The safe alternative leaves old active and replacement pending until access is
verified, then permits a single guarded switch statement.

Added read-only archive support, account-created coverage bounds, cache revision,
and an atomic write guard that prevents a deactivated integration's in-flight
import overwriting frozen snapshots. Archive rendering combines distinct account
costs but never alternative hierarchy levels or two timezone copies of a day.

Validation: 338 recovery tests passed, including pending metadata-only checking,
blocked in-flight writes and archive/new date coverage. The SQL switch guard was
also checked in SQLite: no rows change during a lease; both statuses change in
one update once the lease is absent. A MATERIALIZED guard avoids self-referential
status reads changing halfway through an update.

Code: 9c2e3d6 plus the guarded script follow-up. Worker:
bfde3628-0f21-471d-8cd9-2f96b5aa605f, active at 100%; prior version:
5e76f9a0-ca7a-4302-9478-908d70364807. Existing Pages routes already support the
project. Operations are in scripts/switch-profkit-account.py; reconciliation is
scripts/verify-profkit-switch.mjs. Captures stay outside Git.
